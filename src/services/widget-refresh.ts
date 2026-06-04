// ============================================================
// 桌面挂件刷新服务
// 数据变更后调用，推送最新包裹快照到挂件
// ============================================================
import { getAllPackages } from '../database/dao';
import { updateWidgetData } from '../../modules/expo-pickup-widget';
import { createLogger } from '../utils/logger';

const log = createLogger('WidgetRefresh');

/**
 * 查询待取件包裹并推送 JSON 快照到原生挂件模块
 *
 * 在以下时机调用：
 * - App 启动时
 * - 插入新包裹后
 * - 标记取件 / 删除后
 * - SMS 处理完成后
 */
export function refreshWidget(): void {
  try {
    // 需要取件的包裹：stored（已入库）+ arrived（已到达）
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
  } catch (e) {
    log.warn('挂件刷新失败', { error: String(e) });
  }
}
