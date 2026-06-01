// ============================================================
// SMS 监听原生模块 JS 接口
// ============================================================
import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

const SmsModule = Platform.OS === 'android'
  ? requireNativeModule('ExpoSmsReader')
  : null;

export interface SmsData {
  sender: string;
  body: string;
  timestamp: number;
}

/** 检查是否有 RECEIVE_SMS 权限（异步） */
export async function hasPermission(): Promise<boolean> {
  if (!SmsModule) return false;
  try {
    return await SmsModule.hasPermission();
  } catch {
    return false;
  }
}

/** 启动前台实时 SMS 监听（App 运行时） */
export function startListening(): void {
  SmsModule?.startListening();
}

/** 停止前台实时 SMS 监听 */
export function stopListening(): void {
  SmsModule?.stopListening();
}

/** 获取并清空后台期间积累的待处理 SMS */
export function getPendingSms(): SmsData[] {
  if (!SmsModule) return [];
  return SmsModule.getPendingSms();
}

/**
 * 扫描收件箱已有短信（需要 READ_SMS 权限）
 * @param since 起始时间戳（毫秒），只返回该时间之后的短信，传 0 表示不限时间
 */
export function scanSmsInbox(since?: number): SmsData[] {
  if (!SmsModule) return [];
  return SmsModule.scanSmsInbox(since ?? 0);
}

/**
 * 注册 SMS 事件监听器（前台实时通知）
 * 返回取消订阅的函数
 */
export function addSmsListener(
  callback: (data: SmsData) => void,
): () => void {
  if (!SmsModule) return () => {};

  const subscription = SmsModule.addListener('onSmsReceived', callback);
  return () => subscription.remove();
}
