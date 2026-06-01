// ============================================================
// 本地通知服务
// 当检测到快递入站/取件码时，发送系统通知提醒用户
// ============================================================
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Package } from '../models';

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

/**
 * 发送取件码通知 — 快递已入站
 */
export async function sendPickupNotification(pkg: Package): Promise<void> {
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
    },
    trigger: null, // 立即发送
  });
}

