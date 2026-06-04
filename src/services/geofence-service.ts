// ============================================================
// GPS 地理围栏服务 — 靠近快递点自动汇总提醒
// ============================================================
import { getAllPackages } from '../database/dao';
import { getSetting, setSetting } from '../../modules/expo-notification-reader';
import type { Package } from '../models';
import { createLogger } from '../utils/logger';

const log = createLogger('GeofenceService');

// ========== 类型 ==========
export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface PickupLocation {
  address: string;        // 地址 key
  stationName: string;    // 驿站名称
  point: GeoPoint | null; // 坐标（null=未设置）
  updatedAt: number;       // 坐标设置时间
}

export interface GeofenceSettings {
  enabled: boolean;
  radiusMeters: number;      // 触发半径（默认500米）
  cooldownMinutes: number;   // 同一点通知冷却（默认60分钟）
}

export interface GeofenceAlert {
  stationName: string;
  address: string;
  distance: number;          // 距离（米）
  packageCount: number;       // 该点待取包裹数
  packages: Array<{ id: string; productName: string; pickupCode: string | null }>;
}

// ========== 常量 ==========
const LOCATIONS_KEY = 'geofence_locations';
const LAST_NOTIFY_KEY = 'geofence_last_notify';
const SETTINGS_KEY = 'geofence_settings';

const DEFAULT_SETTINGS: GeofenceSettings = {
  enabled: false,
  radiusMeters: 500,
  cooldownMinutes: 60,
};

// ========== Haversine 公式（计算两点球面距离） ==========
export function haversineDistance(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000; // 地球半径（米）
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinDlat = Math.sin(dLat / 2);
  const sinDlng = Math.sin(dLng / 2);
  const aVal = sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlng * sinDlng;
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return R * c;
}

// ========== 坐标存储 ==========

/** 获取所有已存坐标的取件点 */
export async function getStoredLocations(): Promise<Record<string, PickupLocation>> {
  try {
    const raw = await getSetting(LOCATIONS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    log.warn('获取存储位置失败', { error: String(e) });
    return {};
  }
}

/** 保存取件点坐标 */
export async function savePickupLocation(
  address: string,
  stationName: string,
  point: GeoPoint,
): Promise<void> {
  const locations = await getStoredLocations();
  locations[address] = {
    address,
    stationName,
    point,
    updatedAt: Date.now(),
  };
  await setSetting(LOCATIONS_KEY, JSON.stringify(locations));
}

/** 从包裹数据中提取所有取件点（去重） */
export function extractPickupPoints(packages: Package[]): Array<{
  address: string;
  stationName: string;
}> {
  const seen = new Set<string>();
  const points: Array<{ address: string; stationName: string }> = [];

  for (const pkg of packages) {
    const addr = pkg.pickupAddress || '';
    if (!addr || seen.has(addr)) continue;
    seen.add(addr);
    points.push({
      address: addr,
      stationName: pkg.pickupPointName || addr,
    });
  }
  return points;
}

// ========== 围栏检查 ==========

/** 获取围栏设置 */
export async function getGeofenceSettings(): Promise<GeofenceSettings> {
  try {
    const raw = await getSetting(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    log.warn('获取围栏设置失败', { error: String(e) });
    return { ...DEFAULT_SETTINGS };
  }
}

/** 保存围栏设置 */
export async function setGeofenceSettings(settings: GeofenceSettings): Promise<void> {
  await setSetting(SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * 执行围栏检查：给定当前位置，返回所有在范围内的取件点
 */
export async function checkGeofence(
  currentLocation: GeoPoint,
): Promise<GeofenceAlert[]> {
  const settings = await getGeofenceSettings();
  if (!settings.enabled) return [];

  const locations = await getStoredLocations();
  const lastNotifyRaw = await getSetting(LAST_NOTIFY_KEY);
  const lastNotify: Record<string, number> = lastNotifyRaw
    ? JSON.parse(lastNotifyRaw) : {};

  const allPackages = getAllPackages();
  const storedPackages = allPackages.filter(
    p => p.currentStatus === 'stored' || p.currentStatus === 'arrived',
  );

  const alerts: GeofenceAlert[] = [];
  const now = Date.now();
  const cooldownMs = settings.cooldownMinutes * 60000;

  for (const [address, location] of Object.entries(locations)) {
    if (!location.point) continue;

    // 检查冷却
    const lastTime = lastNotify[address] || 0;
    if (now - lastTime < cooldownMs) continue;

    const distance = haversineDistance(currentLocation, location.point);
    if (distance > settings.radiusMeters) continue;

    // 查该取件点的待取包裹
    const nearPackages = storedPackages.filter(
      p => (p.pickupAddress || '') === address,
    );

    if (nearPackages.length === 0) continue;

    alerts.push({
      stationName: location.stationName,
      address,
      distance: Math.round(distance),
      packageCount: nearPackages.length,
      packages: nearPackages.map(p => ({
        id: p.id,
        productName: p.productName,
        pickupCode: p.pickupCode,
      })),
    });
  }

  return alerts;
}

/** 记录通知时间（防重复提醒） */
export async function markNotified(addresses: string[]): Promise<void> {
  const lastNotifyRaw = await getSetting(LAST_NOTIFY_KEY);
  const lastNotify: Record<string, number> = lastNotifyRaw
    ? JSON.parse(lastNotifyRaw) : {};
  for (const addr of addresses) {
    lastNotify[addr] = Date.now();
  }
  await setSetting(LAST_NOTIFY_KEY, JSON.stringify(lastNotify));
}

// ========== 通知内容生成 ==========

export function buildGeofenceNotification(alerts: GeofenceAlert[]): {
  title: string;
  body: string;
} {
  const total = alerts.reduce((sum, a) => sum + a.packageCount, 0);
  const stationList = alerts
    .slice(0, 3)
    .map(a => `${a.stationName}(${a.packageCount}件·${a.distance}m)`)
    .join('、');

  return {
    title: `📍 附近有 ${total} 个包裹待取`,
    body: `${stationList}${alerts.length > 3 ? ` 等${alerts.length}个驿站` : ''}`,
  };
}
