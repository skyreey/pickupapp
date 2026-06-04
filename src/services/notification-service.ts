// ============================================================
// 本地通知服务
// 当检测到快递入站/取件码时，发送系统通知提醒用户
//
// v2: 合并通知 —— 5秒内多条到站合并为一条「有N个新包裹到达」
// ============================================================
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Package } from '../models';
import { markAsPickedUp } from '../database/dao';

// ===== 注册通知类别（快捷操作按钮） =====
Notifications.setNotificationCategoryAsync('pickup', [
  {
    identifier: 'mark_picked',
    buttonTitle: '已取件',
    options: { opensAppToForeground: false },
  },
  {
    identifier: 'remind_later',
    buttonTitle: '1小时后提醒',
    options: { opensAppToForeground: false },
  },
]).catch(() => {});

// 通知操作响应处理
Notifications.addNotificationResponseReceivedListener(response => {
  const { actionIdentifier, notification } = response;
  const data = notification.request.content.data || {};

  if (actionIdentifier === 'mark_picked') {
    const pkgId = (data as any).packageId as string;
    const ids = (data as any).packageIds as string[];
    if (pkgId) markAsPickedUp(pkgId);
    if (ids?.length) ids.forEach(id => markAsPickedUp(id));
    // 取消通知
    Notifications.dismissNotificationAsync(notification.request.identifier).catch(() => {});
  }

  if (actionIdentifier === 'remind_later') {
    // 1小时后重发提醒
    Notifications.scheduleNotificationAsync({
      content: {
        ...notification.request.content,
        categoryIdentifier: notification.request.content.categoryIdentifier || undefined,
      } as any,
      trigger: { seconds: 3600, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL },
    }).catch(() => {});
    Notifications.dismissNotificationAsync(notification.request.identifier).catch(() => {});
  }
});

// 配置通知行为
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * 请求通知权限（iOS 必须，Android 13+ 需要）
 */
async function requestNotificationPermissionAsync(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ===== 合并通知机制 =====

/** 待合并的包裹列表 */
let _pendingBatch: Package[] = [];
/** 合并计时器 */
let _batchTimer: ReturnType<typeof setTimeout> | null = null;
/** 合并延迟（毫秒） */
const BATCH_DELAY = 5000;

/**
 * 发送单条快递到站通知
 */
async function sendSingleNotification(pkg: Package): Promise<void> {
  if (!pkg.pickupCode) return;

  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    await requestNotificationPermissionAsync();
  }

  const bodyParts: string[] = [];
  bodyParts.push(`取件码：${pkg.pickupCode}`);
  if (pkg.pickupPointName) bodyParts.push(`取件点：${pkg.pickupPointName}`);
  if (pkg.pickupAddress) bodyParts.push(`地址：${pkg.pickupAddress}`);
  if (pkg.pickupPointPhone) bodyParts.push(`电话：${pkg.pickupPointPhone}`);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `📦 ${pkg.carrierName}包裹已到站`,
      body: bodyParts.join('\n'),
      data: { packageId: pkg.id, type: 'pickup' },
      sound: 'default',
      badge: 1,
      categoryIdentifier: 'pickup',
    },
    trigger: null, // 立即发送
  });
}

/**
 * 发送合并通知
 */
async function sendBatchNotification(pkgs: Package[]): Promise<void> {
  if (pkgs.length === 0) return;
  if (pkgs.length === 1) {
    await sendSingleNotification(pkgs[0]);
    return;
  }

  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    await requestNotificationPermissionAsync();
  }

  const uniqueCodes = [...new Set(pkgs.map(p => p.pickupCode).filter(Boolean))];
  const packageIds = pkgs.map(p => p.id);

  // 摘要：显示前3个取件码
  const codePreview = pkgs
    .filter(p => p.pickupCode)
    .slice(0, 3)
    .map(p => `· ${p.carrierName}: ${p.pickupCode}`)
    .join('\n');

  const moreHint = pkgs.length > 3 ? `\n· ...还有${pkgs.length - 3}个` : '';

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `📦 有 ${uniqueCodes.length} 个新包裹到达`,
      body: `${codePreview}${moreHint}\n\n共 ${pkgs.length} 个包裹，打开 App 查看详情`,
      data: { packageIds, type: 'pickup_batch' },
      sound: 'default',
      badge: pkgs.length,
      categoryIdentifier: 'pickup',
    },
    trigger: null,
  });
}

/**
 * 强制刷新合并队列（App 进入后台时调用，避免通知丢失）
 */
export function flushNotifications(): void {
  if (_batchTimer) {
    clearTimeout(_batchTimer);
    _batchTimer = null;
  }
  const batch = _pendingBatch;
  _pendingBatch = [];
  if (batch.length > 0) {
    sendBatchNotification(batch);
  }
}

/**
 * 发送取件码通知 — 合并版
 *
 * 调用此函数不会立即发送通知，而是将包裹加入待合并队列。
 * 5 秒内如果没有新的包裹加入，则发送合并通知。
 * 如果只有 1 个包裹，发送标准单条通知。
 */
export async function sendPickupNotification(pkg: Package): Promise<void> {
  if (!pkg.pickupCode) return;

  _pendingBatch.push(pkg);

  // 重置计时器
  if (_batchTimer) clearTimeout(_batchTimer);
  _batchTimer = setTimeout(() => {
    _batchTimer = null;
    const batch = _pendingBatch;
    _pendingBatch = [];
    sendBatchNotification(batch);
  }, BATCH_DELAY);
}
