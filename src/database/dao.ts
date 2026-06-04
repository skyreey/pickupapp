// ============================================================
// 数据访问层 —— 包裹和物流轨迹的 CRUD
// ============================================================
import { getDatabase } from './index';
import type { Package, PackageStatus, TrackingEvent, CarrierCode, PackageSource } from '../models';

// ---------- 包裹操作 ----------

/** 插入一个包裹 */
export function insertPackage(pkg: Package): void {
  const db = getDatabase();
  db.runSync(
    `INSERT OR REPLACE INTO packages
       (id, tracking_number, carrier, carrier_name, order_source, product_name,
        pickup_code, pickup_address, pickup_point_name, pickup_point_phone,
        business_hours, notes, current_status, status_updated_at, source, created_at, picked_up_at, expires_at, pinned, sms_raw_text, screenshot_paths, assigned_to, assigned_to_name, pushed_by, push_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      pkg.id, pkg.trackingNumber, pkg.carrier, pkg.carrierName,
      pkg.orderSource, pkg.productName, pkg.pickupCode ?? null,
      pkg.pickupAddress ?? null, pkg.pickupPointName ?? null,
      pkg.pickupPointPhone ?? null, pkg.businessHours ?? null, pkg.notes ?? null,
      pkg.currentStatus, pkg.statusUpdatedAt,
      pkg.source, pkg.createdAt, pkg.pickedUpAt ?? 0,
      pkg.expiresAt ?? 0, pkg.pinned ? 1 : 0,
      pkg.smsRawText ?? null, pkg.screenshotPaths ?? null,
      pkg.assignedTo ?? null, pkg.assignedToName ?? null,
      pkg.pushedBy ?? null, pkg.pushStatus ?? null,
    ],
  );
}

/** 根据 ID 查询包裹 */
export function getPackageById(id: string): Package | null {
  const db = getDatabase();
  const row = db.getFirstSync<Record<string, unknown>>(
    'SELECT * FROM packages WHERE id = ?',
    [id],
  );
  return row ? rowToPackage(row) : null;
}

export type PackageSort = 'time-desc' | 'time-asc' | 'station' | 'deadline';

/** 查询所有包裹，可按状态筛选、排序 */
export function getAllPackages(status?: PackageStatus | 'all' | 'active' | 'expired' | 'proxy', sort?: PackageSort): Package[] {
  const db = getDatabase();
  let sql = 'SELECT * FROM packages';
  const params: (string | number)[] = [];
  const now = Date.now();

  if (status && status !== 'all') {
    if (status === 'active') {
      sql += " WHERE current_status IN ('shipped', 'in_transit', 'arrived', 'stored')";
    } else if (status === 'expired') {
      sql += " WHERE current_status IN ('stored', 'arrived') AND expires_at > 0 AND expires_at < ?";
      params.push(now);
    } else if (status === 'proxy') {
      sql += " WHERE pushed_by IS NOT NULL AND current_status != 'picked_up'";
    } else {
      sql += ' WHERE current_status = ?';
      params.push(status);
    }
  }

  // 排序：置顶优先 → 用户选择排序
  const orderBy = (() => {
    switch (sort) {
      case 'time-asc': return 'ORDER BY pinned DESC, created_at ASC';
      case 'station': return 'ORDER BY pinned DESC, pickup_point_name ASC, created_at DESC';
      case 'deadline': return 'ORDER BY pinned DESC, expires_at ASC, created_at DESC';
      default: return 'ORDER BY pinned DESC, created_at DESC';
    }
  })();
  sql += ` ${orderBy}`;

  const rows = db.getAllSync<Record<string, unknown>>(sql, ...params);
  return rows.map(rowToPackage);
}

/** 搜索包裹（按商品名/单号/取件码） */
export function searchPackages(query: string): Package[] {
  const db = getDatabase();
  const like = `%${query}%`;
  const rows = db.getAllSync<Record<string, unknown>>(
    `SELECT * FROM packages
     WHERE product_name LIKE ? OR tracking_number LIKE ? OR pickup_code LIKE ?
     ORDER BY created_at DESC`,
    [like, like, like],
  );
  return rows.map(rowToPackage);
}

/** 根据快递单号查找 */
export function getPackageByTrackingNumber(tn: string): Package | null {
  const db = getDatabase();
  const row = db.getFirstSync<Record<string, unknown>>(
    'SELECT * FROM packages WHERE tracking_number = ?',
    [tn],
  );
  return row ? rowToPackage(row) : null;
}

/** 根据取件码查找（最近7天） */
export function getPackageByPickupCode(code: string): Package | null {
  const db = getDatabase();
  const row = db.getFirstSync<Record<string, unknown>>(
    `SELECT * FROM packages
     WHERE pickup_code = ? AND created_at > ?
     ORDER BY created_at DESC LIMIT 1`,
    [code, Date.now() - 7 * 24 * 60 * 60 * 1000],
  );
  return row ? rowToPackage(row) : null;
}

/** 检测并删除同一取件码的重复包裹，保留信息最完整的那条 */
function deduplicateByPickupCode(code: string): void {
  const db = getDatabase();
  const rows = db.getAllSync<Record<string, unknown>>(
    `SELECT * FROM packages
     WHERE pickup_code = ? AND created_at > ?
     ORDER BY created_at ASC`,
    [code, Date.now() - 30 * 24 * 60 * 60 * 1000],
  );
  if (rows.length < 2) return;

  // 按信息完整度打分，保留最高分（同分保留最早创建的）
  let best = rows[0];
  let bestScore = -1;
  for (const row of rows) {
    let score = 0;
    if (row.tracking_number) score += 2;
    if (row.pickup_address) score += 1;
    if (row.carrier_name && !['unknown', '其他', '快递'].includes(row.carrier_name as string)) score += 1;
    if (row.product_name) score += 1;
    if (row.order_source) score += 1;
    if (row.pickup_point_name) score += 1;
    if (row.pickup_point_phone) score += 1;
    if (row.current_status === 'stored') score += 2;
    if (score > bestScore) { bestScore = score; best = row; }
  }

  for (const row of rows) {
    if (row.id === best.id) continue;
    db.runSync('DELETE FROM tracking_events WHERE package_id = ?', [row.id as string]);
    db.runSync('DELETE FROM packages WHERE id = ?', [row.id as string]);
  }
}

/** 检测并删除同一快递单号的重复包裹，保留信息最完整的那条 */
function deduplicateByTrackingNumber(tn: string): void {
  const db = getDatabase();
  const rows = db.getAllSync<Record<string, unknown>>(
    `SELECT * FROM packages
     WHERE tracking_number = ?
     ORDER BY created_at ASC`,
    [tn],
  );
  if (rows.length < 2) return;

  let best = rows[0];
  let bestScore = -1;
  for (const row of rows) {
    let score = 0;
    if (row.pickup_code) score += 3;
    if (row.pickup_address) score += 1;
    if (row.carrier_name && !['unknown', '其他', '快递'].includes(row.carrier_name as string)) score += 1;
    if (row.product_name) score += 1;
    if (row.order_source) score += 1;
    if (row.pickup_point_name) score += 1;
    if (row.pickup_point_phone) score += 1;
    if (row.current_status === 'stored') score += 2;
    if (score > bestScore) { bestScore = score; best = row; }
  }

  for (const row of rows) {
    if (row.id === best.id) continue;
    db.runSync('DELETE FROM tracking_events WHERE package_id = ?', [row.id as string]);
    db.runSync('DELETE FROM packages WHERE id = ?', [row.id as string]);
  }
}

/** 全局去重：扫描所有快递单号，删除多余重复包裹 */
export function deduplicateAllTrackingNumbers(): void {
  const db = getDatabase();
  const rows = db.getAllSync<Record<string, unknown>>(
    `SELECT tracking_number FROM packages
     WHERE tracking_number IS NOT NULL AND tracking_number != ''
     GROUP BY tracking_number
     HAVING COUNT(*) > 1`
  );
  for (const row of rows) {
    deduplicateByTrackingNumber(row.tracking_number as string);
  }
}

/** 全局去重：扫描所有取件码，删除多余重复包裹 */
export function deduplicateAllPickupCodes(): void {
  const db = getDatabase();
  const rows = db.getAllSync<Record<string, unknown>>(
    `SELECT pickup_code FROM packages
     WHERE pickup_code IS NOT NULL AND pickup_code != ''
       AND created_at > ?
     GROUP BY pickup_code
     HAVING COUNT(*) > 1`,
    [Date.now() - 30 * 24 * 60 * 60 * 1000],
  );
  for (const row of rows) {
    deduplicateByPickupCode(row.pickup_code as string);
  }
}

/** 查找可匹配的包裹（同一快递公司，最近3天） */
export function findMatchingPackage(
  carrier: CarrierCode,
  address?: string | null,
  trackingNumber?: string | null,
): Package | null {
  const db = getDatabase();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

  // 1. 按快递单号匹配（最高优先级，单号是唯一标识）
  if (trackingNumber) {
    const row = db.getFirstSync<Record<string, unknown>>(
      `SELECT * FROM packages
       WHERE tracking_number = ? AND created_at > ?
       ORDER BY created_at DESC LIMIT 1`,
      [trackingNumber, cutoff],
    );
    if (row) return rowToPackage(row);
  }

  // 2. 按地址模糊匹配（不限快递公司，同一个地址就是同一个包裹）
  if (address && address.length >= 4) {
    const row = db.getFirstSync<Record<string, unknown>>(
      `SELECT * FROM packages
       WHERE pickup_address LIKE ? AND pickup_code IS NULL AND created_at > ?
       ORDER BY created_at DESC LIMIT 1`,
      [`%${address.slice(0, 20)}%`, cutoff],
    );
    if (row) return rowToPackage(row);
  }

  // 3. 兜底：同快递公司 + 同地址
  if (address) {
    const row = db.getFirstSync<Record<string, unknown>>(
      `SELECT * FROM packages
       WHERE carrier = ? AND pickup_address LIKE ? AND created_at > ? AND pickup_code IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [carrier, `%${address}%`, cutoff],
    );
    if (row) return rowToPackage(row);
  }

  // 4. 最后：同快递公司（无取件码的最近包裹）
  const row = db.getFirstSync<Record<string, unknown>>(
    `SELECT * FROM packages
     WHERE carrier = ? AND pickup_code IS NULL AND created_at > ?
     ORDER BY created_at DESC LIMIT 1`,
    [carrier, cutoff],
  );
  return row ? rowToPackage(row) : null;
}

/** 按快递单号尾号匹配（短信中只有尾号时用于关联已有包裹） */
export function findPackageByTailNumber(tailNumber: string, carrier?: string): Package | null {
  const db = getDatabase();
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  // 优先匹配同快递公司 + tracking_number 以尾号结尾的
  if (carrier && carrier !== 'unknown') {
    const row = db.getFirstSync<Record<string, unknown>>(
      `SELECT * FROM packages
       WHERE tracking_number LIKE ? AND carrier = ? AND created_at > ?
       ORDER BY created_at DESC LIMIT 1`,
      [`%${tailNumber}`, carrier, cutoff],
    );
    if (row) return rowToPackage(row);
  }
  // 兜底：不限制快递公司
  const row2 = db.getFirstSync<Record<string, unknown>>(
    `SELECT * FROM packages
     WHERE tracking_number LIKE ? AND created_at > ?
     ORDER BY created_at DESC LIMIT 1`,
    [`%${tailNumber}`, cutoff],
  );
  return row2 ? rowToPackage(row2) : null;
}

/** 更新包裹状态 */
export function updatePackageStatus(id: string, status: PackageStatus): void {
  const db = getDatabase();
  db.runSync(
    'UPDATE packages SET current_status = ?, status_updated_at = ? WHERE id = ?',
    [status, Date.now(), id],
  );
}

/** 更新包裹取件码和取件点信息 */
export function updatePickupCode(
  id: string,
  code: string,
  address: string | null,
  stationName?: string | null,
  stationPhone?: string | null,
  businessHours?: string | null,
): void {
  const db = getDatabase();
  db.runSync(
    `UPDATE packages
     SET pickup_code = ?, pickup_address = COALESCE(?, pickup_address),
         pickup_point_name = COALESCE(?, pickup_point_name),
         pickup_point_phone = COALESCE(?, pickup_point_phone),
         business_hours = COALESCE(?, business_hours),
         current_status = 'stored', status_updated_at = ?
     WHERE id = ?`,
    [code, address, stationName ?? null, stationPhone ?? null, businessHours ?? null, Date.now(), id],
  );
}

/** 更新包裹的商品名和备注 */
export function updatePackageInfo(id: string, productName: string, notes: string): void {
  const db = getDatabase();
  db.runSync(
    'UPDATE packages SET product_name = ?, notes = ? WHERE id = ?',
    [productName, notes, id],
  );
}

/** 标记为已取件 */
export function markAsPickedUp(id: string): void {
  const db = getDatabase();
  const now = Date.now();
  db.runSync(
    "UPDATE packages SET current_status = 'picked_up', status_updated_at = ?, picked_up_at = ? WHERE id = ?",
    [now, now, id],
  );
}

/** 批量标记为已取件 */
export function batchMarkAsPickedUp(ids: string[]): void {
  if (ids.length === 0) return;
  const db = getDatabase();
  const now = Date.now();
  const placeholders = ids.map(() => '?').join(',');
  db.runSync(
    `UPDATE packages SET current_status = 'picked_up', status_updated_at = ?, picked_up_at = ? WHERE id IN (${placeholders})`,
    [now, now, ...ids],
  );
}

/** 批量删除 */
export function batchDeletePackages(ids: string[]): void {
  if (ids.length === 0) return;
  const db = getDatabase();
  const placeholders = ids.map(() => '?').join(',');
  db.runSync(`DELETE FROM tracking_events WHERE package_id IN (${placeholders})`, [...ids]);
  db.runSync(`DELETE FROM packages WHERE id IN (${placeholders})`, [...ids]);
}

/** 删除包裹 */
export function deletePackage(id: string): void {
  const db = getDatabase();
  // 先删轨迹
  db.runSync('DELETE FROM tracking_events WHERE package_id = ?', [id]);
  // 再删包裹
  db.runSync('DELETE FROM packages WHERE id = ?', [id]);
}

/** 分配包裹给家庭成员 */
export function assignPackage(id: string, memberId: string | null, memberName: string | null): void {
  const db = getDatabase();
  db.runSync(
    'UPDATE packages SET assigned_to = ?, assigned_to_name = ? WHERE id = ?',
    [memberId ?? null, memberName ?? null, id],
  );
}

/** 切换包裹置顶状态 */
export function togglePin(id: string): void {
  const db = getDatabase();
  db.runSync(
    'UPDATE packages SET pinned = CASE WHEN pinned = 0 THEN 1 ELSE 0 END WHERE id = ?',
    [id],
  );
}

/** 清空所有包裹和轨迹 */
export function deleteAllPackages(): void {
  const db = getDatabase();
  db.runSync('DELETE FROM tracking_events');
  db.runSync('DELETE FROM packages');
}

/** 统计各状态数量 */
export function getStatusCounts(): Record<string, number> {
  const db = getDatabase();
  const rows = db.getAllSync<{ current_status: string; cnt: number }>(
    'SELECT current_status, COUNT(*) as cnt FROM packages GROUP BY current_status',
  );
  const counts: Record<string, number> = { all: 0 };
  for (const r of rows) {
    counts[r.current_status] = r.cnt;
    counts.all += r.cnt;
  }
  // active 汇总（运输中）
  counts.active = (counts.shipped || 0) + (counts.in_transit || 0)
    + (counts.arrived || 0);
  // stored = 待取件（给筛选用）
  counts.stored = (counts.stored || 0);
  // expired = stored/arrived 中已过期的
  const now = Date.now();
  const expiredRow = db.getFirstSync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM packages WHERE current_status IN ('stored', 'arrived') AND expires_at > 0 AND expires_at < ?",
    [now],
  );
  counts.expired = expiredRow?.cnt ?? 0;
  const proxyRow = db.getFirstSync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM packages WHERE pushed_by IS NOT NULL AND current_status != 'picked_up'",
  );
  counts.proxy = proxyRow?.cnt ?? 0;
  return counts;
}

/** 获取累计取件统计 */
export function getPickupStats(): {
  totalPickedUp: number;
  pickedUpThisMonth: number;
  pickedUpLastMonth: number;
} {
  const db = getDatabase();
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

  const total = db.getFirstSync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM packages WHERE current_status = 'picked_up'",
  );
  const thisMonth = db.getFirstSync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM packages WHERE current_status = 'picked_up' AND picked_up_at >= ?",
    [thisMonthStart],
  );
  const lastMonth = db.getFirstSync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM packages WHERE current_status = 'picked_up' AND picked_up_at >= ? AND picked_up_at < ?",
    [lastMonthStart, thisMonthStart],
  );

  return {
    totalPickedUp: total?.cnt ?? 0,
    pickedUpThisMonth: thisMonth?.cnt ?? 0,
    pickedUpLastMonth: lastMonth?.cnt ?? 0,
  };
}

// ---------- 物流轨迹操作 ----------

/** 批量替换物流轨迹（先删旧数据，再插入新数据） */
export function replaceTrackingEvents(packageId: string, events: TrackingEvent[]): void {
  const db = getDatabase();
  db.runSync('DELETE FROM tracking_events WHERE package_id = ?', [packageId]);
  for (const e of events) {
    db.runSync(
      `INSERT INTO tracking_events (id, package_id, time, status, location, raw_description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [e.id, e.packageId, e.time, e.status, e.location, e.rawDescription],
    );
  }
}

/** 获取包裹的物流轨迹 */
export function getTrackingEvents(packageId: string): TrackingEvent[] {
  const db = getDatabase();
  const rows = db.getAllSync<Record<string, unknown>>(
    'SELECT * FROM tracking_events WHERE package_id = ? ORDER BY time DESC',
    [packageId],
  );
  return rows.map(rowToTrackingEvent);
}

// ---------- 内部转换函数 ----------

function rowToPackage(row: Record<string, unknown>): Package {
  return {
    id: row.id as string,
    trackingNumber: row.tracking_number as string,
    carrier: row.carrier as CarrierCode,
    carrierName: row.carrier_name as string,
    orderSource: row.order_source as string,
    productName: row.product_name as string,
    pickupCode: (row.pickup_code as string) || null,
    pickupAddress: (row.pickup_address as string) || null,
    pickupPointName: (row.pickup_point_name as string) || null,
    pickupPointPhone: (row.pickup_point_phone as string) || null,
    businessHours: (row.business_hours as string) || null,
    notes: (row.notes as string) || null,
    currentStatus: row.current_status as PackageStatus,
    statusUpdatedAt: row.status_updated_at as number,
    source: row.source as PackageSource,
    createdAt: row.created_at as number,
    pickedUpAt: (row.picked_up_at as number) || 0,
    expiresAt: (row.expires_at as number) || 0,
    pinned: (row.pinned as number) === 1,
    smsRawText: (row.sms_raw_text as string) || null,
    screenshotPaths: (row.screenshot_paths as string) || null,
    assignedTo: (row.assigned_to as string) || null,
    assignedToName: (row.assigned_to_name as string) || null,
    pushedBy: (row.pushed_by as string) || null,
    pushStatus: (row.push_status as string) || null,
  };
}

function rowToTrackingEvent(row: Record<string, unknown>): TrackingEvent {
  return {
    id: row.id as string,
    packageId: row.package_id as string,
    time: row.time as number,
    status: row.status as string,
    location: row.location as string,
    rawDescription: row.raw_description as string,
  };
}
