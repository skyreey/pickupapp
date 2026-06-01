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
  markAsPickedUp,
  deduplicateAllPickupCodes,
} from '../database/dao';
import type { Package } from '../models';
import { generateId } from '../utils/formatters';
import { sendPickupNotification } from './notification-service';
import { getHistoryDays, isBackgroundMonitoringEnabled, canAddPackage } from './settings-store';
import { refreshWidget } from './widget-refresh';

let listenerActive = false;
let unsubscribe: (() => void) | null = null;

/** 初始化 SMS 监听（App 启动时调用一次） */
export function initSmsListener(): () => void {
  if (Platform.OS !== 'android') return () => {};

  // 如果用户关闭了后台监听，跳过所有扫描和实时监听
  if (!isBackgroundMonitoringEnabled()) return () => {};

  // 处理后台期间积累的 SMS
  processPendingSms();

  // 扫描收件箱已有短信（需要 READ_SMS 权限）
  scanAndProcessInboxSms();

  // 启动前台实时监听（异步检查权限）
  hasPermission().then(granted => {
    if (granted) {
      startRealtimeListener();
    }
  });

  // App 回到前台时，检查后台积累的 SMS
  const appStateSub = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      if (!isBackgroundMonitoringEnabled()) return;
      processPendingSms();
      hasPermission().then(granted => {
        if (granted && !listenerActive) {
          startRealtimeListener();
        }
      });
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
  // 全局去重：清理同一取件码的多余包裹
  deduplicateAllPickupCodes();
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

    // 标准路径：检测是否重复
    if (getPackageByPickupCode(standardResult.code)) return;
    const matched = findMatchingPackage(standardResult.company, standardResult.address, standardResult.trackingNumber);
    if (matched) {
      updatePickupCode(matched.id, standardResult.code, standardResult.address, standardResult.stationName, standardResult.stationPhone, standardResult.businessHours);
      if (isAlreadyPickedUp) {
        markAsPickedUp(matched.id);
      }
      const updated = getPackageById(matched.id);
      if (updated?.pickupCode && !isAlreadyPickedUp) sendPickupNotification(updated);
    } else {
      if (!canAddPackage(1)) return; // 免费版超限，静默跳过
      const now = Date.now();
      const pkg: Package = {
        id: generateId(),
        trackingNumber: standardResult.trackingNumber || '',
        carrier: standardResult.company,
        carrierName: standardResult.companyName,
        orderSource: '',
        productName: '',
        pickupCode: standardResult.code,
        pickupAddress: standardResult.address,
        pickupPointName: standardResult.stationName || null,
        pickupPointPhone: standardResult.stationPhone || null,
        businessHours: standardResult.businessHours || null,
        notes: null,
        currentStatus: isAlreadyPickedUp ? 'picked_up' : 'stored',
        statusUpdatedAt: now,
        source: 'sms',
        createdAt: timestamp > 0 ? timestamp : now,
        pickedUpAt: isAlreadyPickedUp ? (timestamp > 0 ? timestamp : now) : 0,
        expiresAt: standardResult.expiresAt ?? 0,
        pinned: false,
        smsRawText: body,
        screenshotPaths: null,
        assignedTo: null,
        assignedToName: null,
        pushedBy: null,
        pushStatus: null,
      };
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

  const now = Date.now();
  if (!canAddPackage(1)) return; // 免费版超限，静默跳过
  const pkg: Package = {
    id: generateId(),
    trackingNumber: histResult.trackingNumber || '',
    carrier: histResult.company,
    carrierName: histResult.companyName,
    orderSource: '',
    productName: '',
    pickupCode: histResult.code || null,
    pickupAddress: histResult.address,
    pickupPointName: histResult.stationName || null,
    pickupPointPhone: histResult.stationPhone || null,
    businessHours: histResult.businessHours || null,
    notes: null,
    currentStatus: histResult.status,
    statusUpdatedAt: now,
    source: 'sms',
    createdAt: timestamp > 0 ? timestamp : now,
    pickedUpAt: histResult.status === 'picked_up' ? (timestamp > 0 ? timestamp : now) : 0,
    expiresAt: histResult.expiresAt ?? 0,
    pinned: false,
    smsRawText: body,
    screenshotPaths: null,
    assignedTo: null,
    assignedToName: null,
    pushedBy: null,
    pushStatus: null,
  };
  insertPackage(pkg);
}

// 去重用的 hash 集合
const processedHashes = new Set<string>();

/** 处理单条 SMS：解析 → 去重 → 匹配已有包裹 → 新建或更新 */
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

  // 检查是否已有相同取件码
  const existing = getPackageByPickupCode(result.code);
  if (existing) return;

  // 尝试匹配已有包裹
  const matched = findMatchingPackage(result.company, result.address, result.trackingNumber);

  if (matched) {
    updatePickupCode(matched.id, result.code, result.address, result.stationName, result.stationPhone);
    // 发送到站通知
    const updated = getPackageById(matched.id);
    if (updated?.pickupCode) {
      sendPickupNotification(updated);
    }
  } else {
    if (!canAddPackage(1)) return; // 免费版超限，静默跳过
    const now = Date.now();
    const pkg: Package = {
      id: generateId(),
      trackingNumber: result.trackingNumber || '',
      carrier: result.company,
      carrierName: result.companyName,
      orderSource: '',
      productName: '',
      pickupCode: result.code,
      pickupAddress: result.address,
      pickupPointName: result.stationName || null,
      pickupPointPhone: result.stationPhone || null,
      businessHours: result.businessHours || null,
      notes: null,
      currentStatus: 'stored',
      statusUpdatedAt: now,
      source: 'sms',
      createdAt: timestamp > 0 ? timestamp : now,
      pickedUpAt: 0,
      expiresAt: result.expiresAt ?? 0,
      pinned: false,
      smsRawText: body,
      screenshotPaths: null,
      assignedTo: null,
      assignedToName: null,
      pushedBy: null,
      pushStatus: null,
    };
    insertPackage(pkg);
    // 发送到站通知
    sendPickupNotification(pkg);
  }
  // 实时短信处理后也去重
  deduplicateAllPickupCodes();
  refreshWidget();
}
