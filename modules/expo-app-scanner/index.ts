// ============================================================
// App 扫描器 JS 接口
// 扫描已安装的购物平台 App
// ============================================================
import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

let AppScanner: any = null;
if (Platform.OS === 'android') {
  try {
    AppScanner = requireNativeModule('ExpoAppScanner');
  } catch {
    // 模块未注册时静默降级
  }
}

/**
 * 获取 App 自身的安装时间（毫秒时间戳）
 * 用于 SMS 历史扫描的起始时间参考
 */
export async function getSelfInstallTime(): Promise<number> {
  if (!AppScanner) return 0;
  try {
    return await AppScanner.getSelfInstallTime();
  } catch {
    return 0;
  }
}
