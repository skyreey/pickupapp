// ============================================================
// 通知监听原生模块 JS 接口
// ============================================================
import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

const NotifModule = Platform.OS === 'android'
  ? requireNativeModule('ExpoNotificationReader')
  : null;

export interface NotificationData {
  packageName: string;
  title: string;
  text: string;
  timestamp: number;
}

/** 跳转系统设置页，引导用户开启通知使用权 */
export function requestPermission(): boolean {
  if (!NotifModule) return false;
  try {
    NotifModule.requestPermission();
    return true;
  } catch {
    return false;
  }
}

/** 检查通知监听权限是否已开启（异步，返回 Promise<boolean>） */
export async function hasPermission(): Promise<boolean> {
  if (!NotifModule) return false;
  try {
    return await NotifModule.hasPermission();
  } catch {
    return false;
  }
}

/** 设置回调桥接（NotificationListenerService → JS Event） */
export function startListening(): void {
  NotifModule?.startListening();
}

export function stopListening(): void {
  NotifModule?.stopListening();
}

/** 读取状态栏中当前所有活跃通知（App 启动时抓取快照） */
export async function getActiveNotifications(): Promise<NotificationData[]> {
  if (!NotifModule) return [];
  try {
    return await NotifModule.getActiveNotifications();
  } catch {
    return [];
  }
}

/**
 * 注册通知事件监听器
 * 返回取消订阅的函数
 */
export function addNotificationListener(
  callback: (data: NotificationData) => void,
): () => void {
  if (!NotifModule) return () => {};

  const subscription = NotifModule.addListener('onNotificationPosted', callback);
  return () => subscription.remove();
}

// ============================================================
// 分 App 监控开关
// ============================================================

/** 设置某个 App 是否被监控 */
export async function setAppMonitored(packageName: string, enabled: boolean): Promise<void> {
  if (!NotifModule) return;
  try {
    await NotifModule.setAppMonitored(packageName, enabled);
  } catch {}
}

/** 获取所有 App 的监控状态 */
export async function getAllMonitoredStatus(): Promise<Record<string, boolean>> {
  if (!NotifModule) return {};
  try {
    return await NotifModule.getAllMonitoredStatus();
  } catch {
    return {};
  }
}

/** 一键全开/全关所有 App 监控 */
export async function setAllMonitored(enabled: boolean): Promise<void> {
  if (!NotifModule) return;
  try {
    await NotifModule.setAllMonitored(enabled);
  } catch {}
}

// ============================================================
// 通用设置存储
// ============================================================

/** 读取一个设置值 */
export async function getSetting(key: string): Promise<string | null> {
  if (!NotifModule) return null;
  try {
    return await NotifModule.getSetting(key);
  } catch {
    return null;
  }
}

/** 写入一个设置值 */
export async function setSetting(key: string, value: string): Promise<void> {
  if (!NotifModule) return;
  try {
    await NotifModule.setSetting(key, value);
  } catch {}
}
