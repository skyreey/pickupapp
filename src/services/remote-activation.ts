// ============================================================
// 远程激活码验证 + 会员云端同步 v3
//
// v3 改进（相对 v2）：
//   1. isServerAvailable() — 带缓存的健康检查
//   2. remoteVerifyActivationCode() 统一返回类型
//   3. 错误码细化
//   4. 超时控制 8 秒（移动网络下合理）
//
// 保留（v2）：
//   syncMembership() / restoreMembership() / checkCloudMembership()
//   getDeviceId() / getStoredToken() / clearLocalToken()
// ============================================================
import { getSetting, setSetting } from '../../modules/expo-notification-reader';
import { createLogger } from '../utils/logger';
import type { MembershipTier } from '../models';

const log = createLogger('RemoteActivation');

// ============================================================
// API 地址配置
//
// 发布前必须替换为真实服务端地址。可通过环境变量 EXPO_PUBLIC_API_BASE
// 覆盖（EAS build 会自动注入），或直接修改下方默认值。
// 如果仍为占位域名，远程验证将始终失败，激活退化为本地哈希验证。
// ============================================================
const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://api.pickupapp.example.com';
export const IS_API_CONFIGURED = !API_BASE.includes('example.com');

if (!IS_API_CONFIGURED) {
  log.warn('API_BASE 仍为占位域名，远程验证不可用，将退化为本地离线验证');
}

const TOKEN_KEY = 'ac_jwt_token';
const DEVICE_ID_KEY = 'ac_device_id';

// ===== 设备 ID =====
let cachedDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    const stored = await getSetting(DEVICE_ID_KEY);
    if (stored && stored.length > 8) { cachedDeviceId = stored; return cachedDeviceId; }
  } catch {}
  const id = `dvc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  cachedDeviceId = id;
  await setSetting(DEVICE_ID_KEY, id).catch(() => {});
  return id;
}

// ===== 服务端可达性检查 =====
let lastHealthCheck: { time: number; available: boolean } | null = null;
const HEALTH_CACHE_MS = 30_000;
const FETCH_TIMEOUT_MS = 8_000;

/**
 * 检查服务端是否可达（30 秒缓存）
 * 激活码验证前调用，决定走远程还是离线降级
 */
export async function isServerAvailable(): Promise<boolean> {
  const now = Date.now();
  if (lastHealthCheck && now - lastHealthCheck.time < HEALTH_CACHE_MS) {
    return lastHealthCheck.available;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(`${API_BASE}/api/public-key`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timer);
    lastHealthCheck = { time: now, available: res.ok };
    return res.ok;
  } catch {
    lastHealthCheck = { time: now, available: false };
    return false;
  }
}

/** 清除健康检查缓存 */
export function clearHealthCache(): void {
  lastHealthCheck = null;
}

// ===== 远程验证激活码 =====
export interface RemoteVerifyResult {
  valid: boolean;
  tier?: MembershipTier;
  token?: string;
  activatedAt?: number;
  expiresAt?: number;
  reason?: string;
}

export async function remoteVerifyActivationCode(
  code: string,
  phone?: string,
): Promise<RemoteVerifyResult> {
  try {
    const deviceId = await getDeviceId();
    log.info('远程验证激活码');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(`${API_BASE}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim().toUpperCase(), deviceId, phone: phone || null }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return { valid: false, reason: 'SERVER_ERROR' };
    const data = await res.json();

    if (data.valid && data.token) {
      await setSetting(TOKEN_KEY, data.token).catch(() => {});
      log.info('远程验证成功', { tier: data.tier });
      return {
        valid: true,
        tier: data.tier as MembershipTier,
        token: data.token,
        activatedAt: data.activatedAt,
        expiresAt: data.expiresAt || 0,
      };
    }

    return {
      valid: false,
      reason: data.reason || 'INVALID_CODE',
    };
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      log.warn('远程验证超时');
      return { valid: false, reason: 'TIMEOUT' };
    }
    log.warn('远程验证网络异常', { error: String(e) });
    return { valid: false, reason: 'NETWORK_ERROR' };
  }
}

// ===== 云端同步会员 =====
export async function syncMembership(
  tier: MembershipTier,
  activatedAt: number,
  expiresAt: number,
  phone?: string,
): Promise<boolean> {
  try {
    const token = await getSetting(TOKEN_KEY);
    if (!token) { log.warn('无Token，跳过同步'); return false; }

    const deviceId = await getDeviceId();
    const res = await fetch(`${API_BASE}/api/sync-membership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId, phone: phone || null, tier,
        activatedAt: Math.floor(activatedAt / 1000),
        expiresAt: expiresAt > 0 ? Math.floor(expiresAt / 1000) : 0,
        token,
      }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    log.info('会员同步到云端', { ok: data.ok });
    return data.ok === true;
  } catch (e) {
    log.warn('云端同步失败', { error: String(e) });
    return false;
  }
}

// ===== 云端恢复会员 =====
export interface RestoreResult {
  found: boolean;
  tier?: MembershipTier;
  token?: string;
  activatedAt?: number;
  expiresAt?: number;
  reason?: string;
}

export async function restoreMembership(phone?: string): Promise<RestoreResult> {
  try {
    const deviceId = await getDeviceId();
    log.info('尝试云端恢复会员');

    const res = await fetch(`${API_BASE}/api/restore-membership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, phone: phone || null }),
    });

    if (!res.ok) return { found: false, reason: 'SERVER_ERROR' };
    const data = await res.json();

    if (data.found) {
      await setSetting(TOKEN_KEY, data.token).catch(() => {});
      log.info('云端恢复成功', { tier: data.tier });
      return {
        found: true,
        tier: data.tier as MembershipTier,
        token: data.token,
        activatedAt: data.activatedAt,
        expiresAt: data.expiresAt || 0,
      };
    }

    return { found: false, reason: data.reason };
  } catch (e) {
    log.warn('云端恢复失败', { error: String(e) });
    return { found: false, reason: 'NETWORK_ERROR' };
  }
}

// ===== 检查云端会员状态 =====
export async function checkCloudMembership(): Promise<{
  active: boolean; tier?: string;
}> {
  try {
    const deviceId = await getDeviceId();
    const res = await fetch(`${API_BASE}/api/membership/${deviceId}`);
    if (!res.ok) return { active: false };
    return res.json();
  } catch {
    return { active: false };
  }
}

// ===== 获取/清除本地凭证 =====
export async function getStoredToken(): Promise<string | null> {
  try { return await getSetting(TOKEN_KEY); } catch { return null; }
}

export async function clearLocalToken(): Promise<void> {
  await setSetting(TOKEN_KEY, '').catch(() => {});
  log.info('本地凭证已清除');
}
