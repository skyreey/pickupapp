// ============================================================
// 桌面挂件原生模块 JS 接口
// ============================================================
import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

const WidgetModule = Platform.OS === 'android'
  ? requireNativeModule('ExpoPickupWidget')
  : null;

/**
 * 推送包裹数据到桌面挂件
 * @param jsonData JSON 字符串，格式：
 *   { pendingCount: number, packages: [{ pickupCode, pickupPointName, carrierName }] }
 */
export function updateWidgetData(jsonData: string): void {
  if (!WidgetModule) return;
  try {
    WidgetModule.updateWidgetData(jsonData);
  } catch (e) {
    console.warn('updateWidgetData 失败:', e);
  }
}

/** 读取挂件当前数据（调试用） */
export function getWidgetData(): string {
  if (!WidgetModule) return '';
  try {
    return WidgetModule.getWidgetData() ?? '';
  } catch {
    return '';
  }
}
