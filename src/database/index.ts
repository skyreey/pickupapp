// ============================================================
// 数据库初始化 + 建表 + 版本化迁移
//
// v4 改进：用 PRAGMA user_version 管理迁移版本，
// 替代之前「盲跑 13 条 ALTER 靠吞异常判断列是否存在」的做法。
// 迁移按版本号顺序执行，每条在事务内完成，失败即报错不静默吞。
// ============================================================
import * as SQLite from 'expo-sqlite';
import { createLogger } from '../utils/logger';

const log = createLogger('Database');

let db: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('pickup.db');
  }
  return db;
}

/** 读取当前数据库 schema 版本 */
function getUserVersion(database: SQLite.SQLiteDatabase): number {
  const row = database.getAllSync<{ user_version: number }>('PRAGMA user_version');
  return row[0]?.user_version ?? 0;
}

/** 设置数据库 schema 版本 */
function setUserVersion(database: SQLite.SQLiteDatabase, version: number): void {
  database.execSync(`PRAGMA user_version = ${version};`);
}

// ============================================================
// 迁移定义：每个迁移对应一个版本号，按顺序执行
// ============================================================

/** v1: 初始建表（全新安装时执行） */
function migrateV1(database: SQLite.SQLiteDatabase): void {
  database.execSync(`
    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY NOT NULL,
      tracking_number TEXT NOT NULL DEFAULT '',
      carrier TEXT NOT NULL DEFAULT 'unknown',
      carrier_name TEXT NOT NULL DEFAULT '',
      order_source TEXT NOT NULL DEFAULT '',
      product_name TEXT NOT NULL DEFAULT '',
      pickup_code TEXT,
      pickup_address TEXT,
      current_status TEXT NOT NULL DEFAULT 'pending',
      status_updated_at INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at INTEGER NOT NULL DEFAULT 0
    );
  `);
  database.execSync(`
    CREATE TABLE IF NOT EXISTS tracking_events (
      id TEXT PRIMARY KEY NOT NULL,
      package_id TEXT NOT NULL,
      time INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      raw_description TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
    );
  `);
}

/** v2: 扩展站点信息 + 取件时间 + 备注 */
function migrateV2(database: SQLite.SQLiteDatabase): void {
  const cols = [
    'pickup_point_name TEXT',
    'pickup_point_phone TEXT',
    'picked_up_at INTEGER NOT NULL DEFAULT 0',
    'business_hours TEXT',
    'notes TEXT',
    'expires_at INTEGER NOT NULL DEFAULT 0',
    'pinned INTEGER NOT NULL DEFAULT 0',
    'sms_raw_text TEXT',
    'screenshot_paths TEXT',
  ];
  for (const col of cols) {
    const colName = col.split(' ')[0];
    // 先检查列是否已存在，避免 ALTER 报错
    const existing = database.getAllSync<{ name: string }>(
      `PRAGMA table_info(packages)`,
    );
    if (!existing.some((r) => r.name === colName)) {
      database.execSync(`ALTER TABLE packages ADD COLUMN ${col};`);
    }
  }
}

/** v3: 家庭共享 + 代取功能 */
function migrateV3(database: SQLite.SQLiteDatabase): void {
  const cols = ['assigned_to TEXT', 'assigned_to_name TEXT', 'pushed_by TEXT', 'push_status TEXT'];
  for (const col of cols) {
    const colName = col.split(' ')[0];
    const existing = database.getAllSync<{ name: string }>(`PRAGMA table_info(packages)`);
    if (!existing.some((r) => r.name === colName)) {
      database.execSync(`ALTER TABLE packages ADD COLUMN ${col};`);
    }
  }
}

/** v4: 索引（与建表分离，方便后续调整） */
function migrateV4(database: SQLite.SQLiteDatabase): void {
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(current_status);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_packages_created ON packages(created_at DESC);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_packages_tracking ON packages(tracking_number);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_packages_pickup_code ON packages(pickup_code);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_events_package ON tracking_events(package_id, time DESC);`);
}

const MIGRATIONS: { version: number; fn: (db: SQLite.SQLiteDatabase) => void }[] = [
  { version: 1, fn: migrateV1 },
  { version: 2, fn: migrateV2 },
  { version: 3, fn: migrateV3 },
  { version: 4, fn: migrateV4 },
];

const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

// ============================================================
// 公开 API
// ============================================================

/**
 * 初始化数据库，执行所有待应用的迁移。
 *
 * 全新安装：从 v1 依次执行到 LATEST_VERSION。
 * 已有数据库：根据 PRAGMA user_version 跳过已执行的迁移。
 * 迁移失败会抛出异常，不静默吞错误。
 */
export function initDatabase(): void {
  const database = getDatabase();
  const current = getUserVersion(database);

  if (current >= LATEST_VERSION) {
    log.debug('数据库已是最新版本', { version: current });
    return;
  }

  log.info('开始数据库迁移', { from: current, to: LATEST_VERSION });

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    try {
      // 每个迁移在事务内执行，失败可回滚
      database.withTransactionSync(() => {
        migration.fn(database);
        setUserVersion(database, migration.version);
      });
      log.debug('迁移完成', { version: migration.version });
    } catch (e) {
      log.error('数据库迁移失败', { version: migration.version, error: String(e) });
      throw new Error(`数据库迁移失败 (v${migration.version}): ${e}`);
    }
  }

  log.info('数据库迁移全部完成', { version: LATEST_VERSION });
}

/** 获取当前数据库版本（调试用） */
export function getDbVersion(): number {
  return getUserVersion(getDatabase());
}
