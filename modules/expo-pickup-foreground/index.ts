// ============================================================
// 前台服务通知栏常驻 —— JS 接口
// ============================================================
import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

const ForegroundModule = Platform.OS === 'android'
  ? requireNativeModule('ExpoPickupForeground')
  : null;

/** 启动前台服务，通知栏显示"当前有 N 个包裹待取" */
export function startForeground(count: number): void {
  ForegroundModule?.startForeground(count);
}

/** 更新通知栏中的待取包裹数量 */
export function updatePendingCount(count: number): void {
  ForegroundModule?.updatePendingCount(count);
}

/** 停止前台服务，移除通知栏常驻通知 */
export function stopForeground(): void {
  ForegroundModule?.stopForeground();
}
