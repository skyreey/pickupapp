// ============================================================
// 远程激活码验证 + 会员云端同步 v2
//
// 新增（相对 v1）：
//   1. syncMembership() — 激活后将会员状态同步到云端
//   2. restoreMembership() — 换手机/清数据后恢复会员
//   3. checkCloudMembership() — 启动时检查云端会员状态
// ============================================================
import { getSetting, setSetting } from '../../modules/expo-notification-reader';
import { createLogger } from '../utils/logger';
import type { MembershipTier } from '../models';

const log = createLogger('RemoteActivation');

const API_BASE = 'https://api.pickupapp.example.com';
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
  // 生成新设备ID
  const id = `dvc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  cachedDeviceId = id;
  await setSetting(DEVICE_ID_KEY, id).catch(() => {});
  return id;
}

// ===== 远程验证激活码 =====
export async function remoteVerifyActivationCode(
  code: string,
  phone?: string,
): Promise<{
  valid: boolean; tier?: string; token?: string;
  activatedAt?: number; expiresAt?: number; reason?: string;
}> {
  try {
    const deviceId = await getDeviceId();
    log.info('远程验证激活码');

    const res = await fetch(`${API_BASE}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim().toUpperCase(), deviceId, phone: phone || null }),
    });

    if (!res.ok) return { valid: false, reason: 'SERVER_ERROR' };
    const data = await res.json();

    if (data.valid && data.token) {
      await setSetting(TOKEN_KEY, data.token).catch(() => {});
      log.info('远程验证成功', { tier: data.tier });
    }

    return data;
  } catch (e) {
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
export async function restoreMembership(phone?: string): Promise<{
  found: boolean;
  tier?: MembershipTier;
  token?: string;
  activatedAt?: number;
  expiresAt?: number;
  reason?: string;
}> {
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
      // 恢复成功：保存 JWT + 触发本地激活
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

// ===== 获取保存的 JWT =====
export async function getStoredToken(): Promise<string | null> {
  try { return await getSetting(TOKEN_KEY); } catch { return null; }
}

// ===== 清除本地凭证 =====
export async function clearLocalToken(): Promise<void> {
  await setSetting(TOKEN_KEY, '').catch(() => {});
  log.info('本地凭证已清除');
}
