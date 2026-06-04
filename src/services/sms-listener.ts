// ============================================================
// SMS 监听服务
//
// 连接原生模块 → 解析取件码 → 匹配已有包裹 → 写入数据库
// ============================================================
import { Platform, AppState } from 'react-native';
import {
  hasPermission,
  startListening,
  stopListening,
  getPendingSms,
  scanSmsInbox,
  addSmsListener,
} from '../../modules/expo-sms-reader';
import type { SmsData } from '../../modules/expo-sms-reader';
import { parseSms, parseHistoricalSms } from './sms-parser';
import {
  insertPackage,
  getPackageByPickupCode,
  findMatchingPackage,
  updatePickupCode,
  getPackageById,
  getPackageByTrackingNumber,
  findPackageByTailNumber,
  markAsPickedUp,
  deduplicateAllPickupCodes,
  deduplicateAllTrackingNumbers,
} from '../database/dao';
import { createPackage } from '../utils/package-factory';
import { sendPickupNotification } from './notification-service';
import { getHistoryDays, isBackgroundMonitoringEnabled, canAddPackage, FREE_PACKAGE_LIMIT, getIsPro } from './settings-store';
import { refreshWidget } from './widget-refresh';
import { createLogger } from '../utils/logger';
import * as Notifications from 'expo-notifications';

const log = createLogger('SmsListener');

// 限流通知：每小时最多弹一次
let _lastLimitNotifyTs = 0;
function _notifyLimitReached(): void {
  if (getIsPro()) return;
  const now = Date.now();
  if (now - _lastLimitNotifyTs < 60 * 60 * 1000) return;
  _lastLimitNotifyTs = now;
  log.info('免费版包裹超限，发送通知提醒');
  Notifications.scheduleNotificationAsync({
    content: {
      title: '包裹超限',
      body: `免费版最多记录 ${FREE_PACKAGE_LIMIT} 个包裹，新的取件码未录入。\n升级 Pro 解锁无限包裹。`,
      data: { type: 'limit_reached' },
    },
    trigger: null,
  }).catch(() => {});
}

// 防抖 Widget 刷新：多次调用合并为一次，间隔500ms
let widgetRefreshTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedRefreshWidget(): void {
  if (widgetRefreshTimer) clearTimeout(widgetRefreshTimer);
  widgetRefreshTimer = setTimeout(() => refreshWidget(), 500);
}

let listenerActive = false;
let unsubscribe: (() => void) | null = null;

/** 初始化 SMS 监听（App 启动时调用一次） */
export function initSmsListener(): () => void {
  if (Platform.OS !== 'android') return () => {};

  // 如果用户关闭了后台监听，跳过所有扫描和实时监听
  if (!isBackgroundMonitoringEnabled()) return () => {};

  // 处理后台期间积累的 SMS
  void processPendingSms().catch(e => log.error('processPendingSms failed', e));

  // 扫描收件箱已有短信（需要 READ_SMS 权限）
  void scanAndProcessInboxSms().catch(e => log.error('scanInboxSms failed', e));

  // 启动前台实时监听（异步检查权限）
  hasPermission().then(granted => {
    if (granted) {
      startRealtimeListener();
    }
  }).catch(e => log.error('hasPermission check failed', e));

  // App 回到前台时，检查后台积累的 SMS
  const appStateSub = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      if (!isBackgroundMonitoringEnabled()) return;
      void processPendingSms().catch(e => log.error('processPendingSms on resume failed', e));
      hasPermission().then(granted => {
        if (granted && !listenerActive) {
          startRealtimeListener();
        }
      }).catch(e => log.error('hasPermission check on resume failed', e));
    }
  });

  return () => {
    appStateSub.remove();
  };
}

/** 启动前台实时 SMS 监听 */
function startRealtimeListener(): void {
  if (listenerActive) return;

  startListening();
  unsubscribe = addSmsListener((data: SmsData) => {
    handleIncomingSms(data);
  });
  listenerActive = true;
}

function stopRealtimeListener(): void {
  if (!listenerActive) return;

  stopListening();
  unsubscribe?.();
  unsubscribe = null;
  listenerActive = false;
}

// ============================================================
// 内部函数
// ============================================================

/** 处理后台积累的 SMS */
async function processPendingSms(): Promise<void> {
  const pending = await getPendingSms();
  for (const sms of pending) {
    handleIncomingSms(sms);
  }
}

/** 扫描收件箱已有短信（每次启动执行，已处理过的自动跳过） */
async function scanAndProcessInboxSms(): Promise<void> {
  // 计算时间窗口：N 天前的时间戳（毫秒）
  const days = getHistoryDays();
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const smsList = await scanSmsInbox(since);
  for (const sms of smsList) {
    handleHistoricalSms(sms);
  }
  // 全局去重：清理同一取件码/快递单号的多余包裹
  deduplicateAllPickupCodes();
  deduplicateAllTrackingNumbers();
  refreshWidget();
}

/** 强制重新扫描历史短信（供设置页调用） */
export async function rescanInboxSms(): Promise<void> {
  processedHashes.clear();
  await scanAndProcessInboxSms();
}

/** 处理历史 SMS（不跳过已取件包裹，用于首次扫描统计） */
function handleHistoricalSms(data: SmsData): void {
  const { sender, body, timestamp } = data;

  const hash = `${sender}-${body.slice(0, 30)}-${Math.floor(timestamp / 60000)}`;
  if (processedHashes.has(hash)) return;
  processedHashes.add(hash);

  // 先尝试标准解析（提取取件码）
  const standardResult = parseSms(body, sender);
  if (standardResult) {
    // 历史扫描：检测短信本身是否是"已签收/已取件"通知，避免把旧已取件短信标成待取件
    const isAlreadyPickedUp = /已签收|已取件|已取出|已领取|已提货|被签收|已收货/.test(body);

    // 过滤无上下文的假包裹（无站点、无地址、快递公司未识别）
    if (!standardResult.stationName && !standardResult.address && standardResult.company === 'unknown') return;

    // === 去重1：按取件码 ===
    const dupByCode = getPackageByPickupCode(standardResult.code);
    if (dupByCode) {
      mergeExtraInfo(dupByCode.id, standardResult.code, standardResult.address,
        standardResult.stationName, standardResult.stationPhone,
        standardResult.trackingNumber, standardResult.businessHours,
        standardResult.tailNumber);
      return;
    }
    // === 去重2：按快递单号 ===
    if (standardResult.trackingNumber) {
      const dupByTn = getPackageByTrackingNumber(standardResult.trackingNumber);
      if (dupByTn) {
        if (!dupByTn.pickupCode && standardResult.code) {
          updatePickupCode(dupByTn.id, standardResult.code, standardResult.address,
            standardResult.stationName, standardResult.stationPhone, standardResult.businessHours);
        } else {
          mergeExtraInfo(dupByTn.id, standardResult.code, standardResult.address,
            standardResult.stationName, standardResult.stationPhone,
            standardResult.trackingNumber, standardResult.businessHours,
            standardResult.tailNumber);
        }
        return;
      }
    }
    // === 去重2.5：尾号匹配（短信只有尾号时用于匹配已有包裹） ===
    if (!standardResult.trackingNumber && standardResult.tailNumber) {
      const dupByTail = findPackageByTailNumber(standardResult.tailNumber, standardResult.company);
      if (dupByTail) {
        if (dupByTail.pickupCode && dupByTail.pickupCode === standardResult.code) {
          // 完全匹配的取件码，已经是同一条
          return;
        }
        mergeExtraInfo(dupByTail.id, standardResult.code, standardResult.address,
          standardResult.stationName, standardResult.stationPhone,
          standardResult.trackingNumber, standardResult.businessHours,
          standardResult.tailNumber);
        return;
      }
    }
    // === 去重3：模糊匹配 ===
    const matched = findMatchingPackage(standardResult.company, standardResult.address, standardResult.trackingNumber);
    if (matched) {
      updatePickupCode(matched.id, standardResult.code, standardResult.address, standardResult.stationName, standardResult.stationPhone, standardResult.businessHours);
      if (isAlreadyPickedUp) {
        markAsPickedUp(matched.id);
      }
      const updated = getPackageById(matched.id);
      if (updated?.pickupCode && !isAlreadyPickedUp) sendPickupNotification(updated);
    } else {
      if (!canAddPackage(1)) { _notifyLimitReached(); return; } // 免费版超限
      const pkg = createPackage({
        trackingNumber: standardResult.trackingNumber || '',
        carrier: standardResult.company,
        carrierName: standardResult.companyName,
        pickupCode: standardResult.code,
        pickupAddress: standardResult.address,
        pickupPointName: standardResult.stationName,
        pickupPointPhone: standardResult.stationPhone,
        businessHours: standardResult.businessHours,
        tailNumber: standardResult.tailNumber,
        currentStatus: isAlreadyPickedUp ? 'picked_up' : 'stored',
        source: 'sms',
        createdAt: timestamp > 0 ? timestamp : undefined,
        pickedUpAt: isAlreadyPickedUp ? (timestamp > 0 ? timestamp : Date.now()) : 0,
        expiresAt: standardResult.expiresAt ?? 0,
        smsRawText: body,
      });
      insertPackage(pkg);
      if (!isAlreadyPickedUp) sendPickupNotification(pkg);
    }
    return;
  }

  // 历史扫描：尝试宽松解析（已取件/已签收等消息）
  const histResult = parseHistoricalSms(body, sender);
  if (!histResult) return;

  // 最低质量：至少要有取件码或快递单号
  if (!histResult.code && !histResult.trackingNumber) return;

  // 有单号的查重
  if (histResult.code) {
    if (getPackageByPickupCode(histResult.code)) return;
  }

  if (!canAddPackage(1)) { _notifyLimitReached(); return; } // 免费版超限
  const pkg = createPackage({
    trackingNumber: histResult.trackingNumber || '',
    carrier: histResult.company,
    carrierName: histResult.companyName,
    pickupCode: histResult.code || null,
    pickupAddress: histResult.address,
    pickupPointName: histResult.stationName,
    pickupPointPhone: histResult.stationPhone,
    businessHours: histResult.businessHours,
    tailNumber: histResult.tailNumber,
    currentStatus: histResult.status,
    source: 'sms',
    createdAt: timestamp > 0 ? timestamp : undefined,
    pickedUpAt: histResult.status === 'picked_up' ? (timestamp > 0 ? timestamp : Date.now()) : 0,
    expiresAt: histResult.expiresAt ?? 0,
    smsRawText: body,
  });
  insertPackage(pkg);
}

// 去重用的 hash 集合
const processedHashes = new Set<string>();

/** 当前短信是否携带了比已有包裹更多的信息，有则补充 */
function mergeExtraInfo(existingId: string, code: string, address: string | null, stationName?: string | null, stationPhone?: string | null, trackingNumber?: string, businessHours?: string, tailNumber?: string): boolean {
  const existing = getPackageById(existingId);
  if (!existing) return false;
  let updated = false;

  // 补充快递单号
  if (trackingNumber && !existing.trackingNumber) {
    // SQLite 没有直接更新单字段的 API，用 updatePickupCode 也算更新
    updated = true;
  }
  // 补充电话
  if (stationPhone && !existing.pickupPointPhone) {
    updated = true;
  }
  // 补充地址
  if (address && !existing.pickupAddress) {
    updated = true;
  }
  // 补充营业时间
  if (businessHours && !existing.businessHours) {
    updated = true;
  }

  // 如果包裹已被用户标记为取件，不再回退状态
  if (updated && existing.currentStatus !== 'picked_up') {
    updatePickupCode(existingId, code,
      address || existing.pickupAddress,
      stationName || existing.pickupPointName,
      stationPhone || existing.pickupPointPhone,
      businessHours || existing.businessHours);
  }
  return updated;
}

/** 处理单条 SMS：解析 → 去重（取件码+单号+模糊匹配） → 匹配已有包裹 → 新建或更新 */
function handleIncomingSms(data: SmsData): void {
  const { sender, body, timestamp } = data;

  // 去重：相同内容的短信不重复处理
  const hash = `${sender}-${body.slice(0, 30)}-${Math.floor(timestamp / 60000)}`;
  if (processedHashes.has(hash)) return;
  processedHashes.add(hash);

  if (processedHashes.size > 200) {
    const arr = [...processedHashes];
    processedHashes.clear();
    arr.slice(-100).forEach(h => processedHashes.add(h));
  }

  // 解析短信
  const result = parseSms(body, sender);
  if (!result) return;

  // === 去重1：按取件码 ===
  const dupByCode = getPackageByPickupCode(result.code);
  if (dupByCode) {
    // 已有取件码 → 合并补充信息（单号、电话等）
    mergeExtraInfo(dupByCode.id, result.code, result.address,
      result.stationName, result.stationPhone,
      result.trackingNumber, result.businessHours,
      result.tailNumber);
    return;
  }

  // === 去重2：按快递单号 ===
  if (result.trackingNumber) {
    const dupByTn = getPackageByTrackingNumber(result.trackingNumber);
    if (dupByTn) {
      // 已有单号 → 补充取件码
      if (!dupByTn.pickupCode) {
        updatePickupCode(dupByTn.id, result.code, result.address,
          result.stationName, result.stationPhone, result.businessHours);
        const updated = getPackageById(dupByTn.id);
        if (updated?.pickupCode) sendPickupNotification(updated);
      } else {
        mergeExtraInfo(dupByTn.id, result.code, result.address,
          result.stationName, result.stationPhone,
          result.trackingNumber, result.businessHours,
          result.tailNumber);
      }
      return;
    }
  }

  // === 去重3：模糊匹配 ===
  const matched = findMatchingPackage(result.company, result.address, result.trackingNumber);

  if (matched) {
    updatePickupCode(matched.id, result.code, result.address, result.stationName, result.stationPhone);
    // 发送到站通知
    const updated = getPackageById(matched.id);
    if (updated?.pickupCode) {
      sendPickupNotification(updated);
    }
  } else {
    if (!canAddPackage(1)) { _notifyLimitReached(); return; } // 免费版超限
    const pkg = createPackage({
      trackingNumber: result.trackingNumber || '',
      carrier: result.company,
      carrierName: result.companyName,
      pickupCode: result.code,
      pickupAddress: result.address,
      pickupPointName: result.stationName,
      pickupPointPhone: result.stationPhone,
      businessHours: result.businessHours,
      tailNumber: result.tailNumber,
      currentStatus: 'stored',
      source: 'sms',
      createdAt: timestamp > 0 ? timestamp : undefined,
      expiresAt: result.expiresAt ?? 0,
      smsRawText: body,
    });
    insertPackage(pkg);
    // 发送到站通知
    sendPickupNotification(pkg);
  }
  // 实时短信处理后也去重
  deduplicateAllPickupCodes();
  deduplicateAllTrackingNumbers();
  debouncedRefreshWidget();
}
