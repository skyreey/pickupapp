// ============================================================
// 桌面挂件刷新服务
// 数据变更后调用，推送最新包裹快照到挂件
// ============================================================
import { getAllPackages } from '../database/dao';
import { updateWidgetData } from '../../modules/expo-pickup-widget';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 500;

/**
 * 查询待取件包裹并推送 JSON 快照到原生挂件模块
 *
 * 在以下时机调用：
 * - App 启动时
 * - 插入新包裹后
 * - 标记取件 / 删除后
 * - SMS 处理完成后
 *
 * 内置 500ms 防抖，避免批量操作时重复触发。
 */
export function refreshWidget(): void {
  // Debounce: coalesce rapid successive calls into a single update
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    doRefreshWidget();
  }, DEBOUNCE_MS);
}

function doRefreshWidget(): void {
  try {
    const stored = getAllPackages('stored');
    const arrived = getAllPackages('arrived');
    const pending = [...stored, ...arrived];

    const data = {
      pendingCount: pending.length,
      packages: pending.slice(0, 10).map(pkg => ({
        id: pkg.id,
        pickupCode: pkg.pickupCode || '',
        pickupPointName: pkg.pickupPointName || '',
        carrierName: pkg.carrierName || '',
      })),
    };

    updateWidgetData(JSON.stringify(data));
  } catch {
    // Widget refresh is non-critical, fail silently
  }
}