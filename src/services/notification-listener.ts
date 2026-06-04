// ============================================================
// 通知监听服务
//
// 连接原生 NotificationListenerService → 解析推送 → 建包裹
// ============================================================
import { Platform, AppState } from 'react-native';
import {
  hasPermission,
  startListening,
  stopListening,
  addNotificationListener,
  getActiveNotifications,
} from '../../modules/expo-notification-reader';
import type { NotificationData } from '../../modules/expo-notification-reader';
import { parseNotification, isShoppingApp } from './notification-parser';
import {
  insertPackage,
  getPackageByTrackingNumber,
} from '../database/dao';
import { createPackage } from '../utils/package-factory';
import { canAddPackage, FREE_PACKAGE_LIMIT, getIsPro } from './settings-store';
import { createLogger } from '../utils/logger';
const Notifications = require('expo-notifications');

const log = createLogger('NotificationListener');

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

let listenerActive = false;
let unsubscribe: (() => void) | null = null;

/** 初始化通知监听（App 启动时调用一次） */
export function initNotificationListener(): () => void {
  if (Platform.OS !== 'android') return () => {};

  hasPermission().then(granted => {
    if (granted) {
      startNotificationListening();
      // 启动时抓取通知栏快照（已存在的购物平台通知）
      scanActiveNotifications();
    }
  });

  // App 回到前台时重新检查权限 + 重新抓取通知栏
  const appStateSub = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      hasPermission().then(granted => {
        if (granted) {
          if (!listenerActive) {
            startNotificationListening();
          }
          scanActiveNotifications();
        }
      });
    }
  });

  return () => {
    appStateSub.remove();
  };
}

/** 抓取通知栏当前所有活跃通知（打开 App 时的快照扫描） */
async function scanActiveNotifications(): Promise<void> {
  try {
    const notifications = await getActiveNotifications();
    for (const data of notifications) {
      handleIncomingNotification(data);
    }
  } catch (e) {
    log.warn('扫描活跃通知失败', { error: String(e) });
  }
}

/** 启动通知监听 */
function startNotificationListening(): void {
  if (listenerActive) return;

  startListening();
  unsubscribe = addNotificationListener((data: NotificationData) => {
    handleIncomingNotification(data);
  });
  listenerActive = true;
}

/** 停止通知监听 */
function stopNotificationListening(): void {
  if (!listenerActive) return;

  stopListening();
  unsubscribe?.();
  unsubscribe = null;
  listenerActive = false;
}

// ============================================================
// 通知处理逻辑
// ============================================================

const processedHashes = new Set<string>();

function handleIncomingNotification(data: NotificationData): void {
  const { packageName, title, text, timestamp } = data;

  // 快速过滤：非购物 App 跳过
  if (!isShoppingApp(packageName)) return;

  // 去重
  const hash = `${packageName}-${title.slice(0, 20)}-${text.slice(0, 20)}-${Math.floor(timestamp / 60000)}`;
  if (processedHashes.has(hash)) return;
  processedHashes.add(hash);

  if (processedHashes.size > 200) {
    const arr = [...processedHashes];
    processedHashes.clear();
    arr.slice(-100).forEach(h => processedHashes.add(h));
  }

  // 解析通知内容（商品名 + 快递单号 + 快递公司）
  const result = parseNotification(packageName, title, text);
  if (!result) return;

  // 检查是否已有相同单号
  const existing = getPackageByTrackingNumber(result.trackingNumber);
  if (existing) return;

  // 新建包裹
  if (!canAddPackage(1)) { _notifyLimitReached(); return; } // 免费版超限
  const pkg = createPackage({
    trackingNumber: result.trackingNumber,
    carrier: result.carrier,
    carrierName: result.carrierName,
    orderSource: result.orderSource,
    productName: result.productName,
    pickupAddress: result.address,
    pickupPointName: result.stationName,
    pickupPointPhone: result.phone,
    currentStatus: 'shipped',
    source: 'notification',
    createdAt: timestamp > 0 ? timestamp : undefined,
  });
  insertPackage(pkg);
}
