// ============================================================
// 前台服务管理器 —— 通知栏常驻
// ============================================================
import { startForeground, updatePendingCount, stopForeground } from '../../modules/expo-pickup-foreground';
import { getAllPackages } from '../database/dao';

// WARNING: isRunning is a JS-side flag and may get out of sync if the Android system
// kills the foreground Service independently. Consider querying native Service state.
let isRunning = false;

/** 启动前台服务（通知栏显示待取数量） */
export function startForegroundService(): void {
  const stored = getAllPackages('stored');
  startForeground(stored.length);
  isRunning = true;
}

/** 刷新通知栏中的待取数量（从 DB 实时查询） */
export function refreshPendingCount(): void {
  if (!isRunning) return;
  const stored = getAllPackages('stored');
  updatePendingCount(stored.length);
}

/** 停止前台服务 */
export function stopForegroundService(): void {
  stopForeground();
  isRunning = false;
}

/** 前台服务是否正在运行 */
export function isForegroundServiceRunning(): boolean {
  return isRunning;
}
