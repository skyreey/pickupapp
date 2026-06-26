// ============================================================
// Pro 激活码 — v3: 远程优先 + 本地离线降级
//
// v3 改进（相对 v2）：
//   1. verifyActivationCode() 远程优先（POST /api/verify）
//   2. 服务端不可用时自动降级到本地 HASH 验证
//   3. 保留限速 / 防重用 / 设备盐 / 常量时间比较
//   4. 保留管理端生码能力 generateActivationCode()
// ============================================================
import type { MembershipTier } from '../models';
import { getSetting, setSetting } from '../../modules/expo-notification-reader';
import { createLogger } from '../utils/logger';
import {
  isServerAvailable,
  remoteVerifyActivationCode,
  clearHealthCache,
} from './remote-activation';

const log = createLogger('ProActivation');

// ===== 密钥碎片（拆散存储，运行时组装） =====
const K1 = 'pick';
const K2 = 'up-pro';
const K3 = '-2026-v2';
const SECRET = () => K1 + K2 + K3;

const TIER_PREFIX: Record<MembershipTier, string> = {
  monthly: 'PM',
  yearly: 'PY',
  lifetime: 'PF',
};

const RATE_LIMIT_KEY = 'ac_rate_v2';
const USED_CODES_KEY = 'ac_used_v2';
const DEVICE_SALT_KEY = 'ac_dsalt';
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 300_000;

const ZERO_SALT = '00000000000000000000000000000000';
let deviceSalt: string | null = null;

// ===== 设备盐 =====
async function getDeviceSalt(): Promise<string> {
  if (deviceSalt) return deviceSalt;
  try {
    const raw = await getSetting(DEVICE_SALT_KEY);
    if (raw && raw.length >= 32) { deviceSalt = raw; return deviceSalt; }
  } catch {}
  const chars = '0123456789abcdef';
  let salt = '';
  for (let i = 0; i < 32; i++) salt += chars[Math.floor(Math.random() * chars.length)];
  deviceSalt = salt;
  await setSetting(DEVICE_SALT_KEY, salt).catch(() => {});
  return salt;
}

// ===== 限速 =====
async function checkRateLimit(): Promise<boolean> {
  try {
    const raw = await getSetting(RATE_LIMIT_KEY);
    if (!raw) {
      await setSetting(RATE_LIMIT_KEY, JSON.stringify({ attempts: [Date.now()] }));
      return true;
    }
    const record = JSON.parse(raw);
    const now = Date.now();
    const recent = (record.attempts || []).filter((t: number) => now - t < COOLDOWN_MS);
    if (recent.length >= MAX_ATTEMPTS) {
      log.warn('激活码限速触发', { attempts: recent.length });
      return false;
    }
    recent.push(now);
    await setSetting(RATE_LIMIT_KEY, JSON.stringify({ attempts: recent }));
    return true;
  } catch {
    await setSetting(RATE_LIMIT_KEY, JSON.stringify({ attempts: [Date.now()] }));
    return true;
  }
}

async function isCodeUsed(code: string): Promise<boolean> {
  try {
    const raw = await getSetting(USED_CODES_KEY);
    if (!raw) return false;
    return new Set(JSON.parse(raw)).has(code);
  } catch { return false; }
}

async function markCodeUsed(code: string): Promise<void> {
  try {
    const raw = await getSetting(USED_CODES_KEY);
    const set: string[] = raw ? JSON.parse(raw) : [];
    if (!set.includes(code)) {
      set.push(code);
      if (set.length > 500) set.splice(0, set.length - 500);
      await setSetting(USED_CODES_KEY, JSON.stringify(set));
    }
  } catch {
    await setSetting(USED_CODES_KEY, JSON.stringify([code]));
  }
}

// ===== 常量时间比较 =====
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ===== 本地 HASH 验证（离线降级用） =====
const CORE_RAND_LEN = 8;
const CORE_SIG_LEN = 8;

function strongHash(input: string): string {
  const baseRounds = 500;
  const rounds = baseRounds + (input.length % 50) * 31;
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  const encoder = new TextEncoder();
  const bytes = encoder.encode(input);

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      const ri = r & 0xff;
      h0 = ((h0 << 7) - h0 + b + ri + i) | 0;
      h0 = ((h0 ^ (h0 >>> 16)) * 0x85ebca6b) | 0;
      h0 = ((h0 ^ (h0 >>> 13)) * 0xc2b2ae35) | 0;
      h0 = (h0 ^ (h0 >>> 16)) | 0;
      h1 = ((h1 << 5) - h1 + b * 31 + ri * 7 + i * 3) | 0;
      h1 = ((h1 ^ (h1 >>> 17)) * 0xed5ad4bb) | 0;
      h1 = ((h1 ^ (h1 >>> 11)) * 0xac4c1b51) | 0;
      h1 = (h1 ^ (h1 >>> 15)) | 0;
      h2 = ((h2 << 9) - h2 + b * 17 + ri * 13 + i * 5) | 0;
      h2 = ((h2 ^ (h2 >>> 19)) * 0xa5b1c7d3) | 0;
      h2 = ((h2 ^ (h2 >>> 7)) * 0xe8173b2d) | 0;
      h2 = (h2 ^ (h2 >>> 21)) | 0;
    }
    const mix = ((h0 & 0xffff) * (h1 & 0xffff) + (h2 & 0xffff)) | 0;
    h0 = (h0 ^ mix) | 0;
    h1 = (h1 ^ (mix >>> 1)) | 0;
    h2 = (h2 ^ (mix >>> 2)) | 0;
    if (bytes.length > 0) bytes[bytes.length - 1] = (bytes[bytes.length - 1] + (r & 0xff) + 1) & 0xff;
  }

  const hex = [
    Math.abs(h0).toString(16).padStart(8, '0'),
    Math.abs(h1).toString(16).padStart(8, '0'),
    Math.abs(h2).toString(16).padStart(8, '0'),
  ].join('');
  const doubled = hex + hex;
  return doubled + doubled.split('').reverse().join('');
}

function computeSignature(data: string): string {
  return strongHash(data).slice(0, CORE_SIG_LEN).toUpperCase();
}

function verifyLocal(code: string, tier: MembershipTier, salt: string): boolean {
  const core = code
    .replace('PICKUP-', '')
    .replace(/^(PM|PY|PF)-/, '')
    .replace(/-/g, '');
  if (core.length < CORE_RAND_LEN + CORE_SIG_LEN) return false;
  const randomPart = core.slice(0, CORE_RAND_LEN);
  const claimedSig = core.slice(CORE_RAND_LEN);
  const expectedSig = computeSignature(SECRET() + tier + salt + randomPart);
  return constantTimeEqual(claimedSig, expectedSig);
}

// ============================================================
// 公开 API
// ============================================================

export interface VerifyResult {
  tier: MembershipTier | null;
  verified: 'remote' | 'local' | null;  // 验证来源
  reason?: string;
}

/**
 * 验证激活码 — 远程优先 + 本地离线降级
 *
 * 流程：
 *   1. 格式检查 + 限速（本地）
 *   2. 尝试远程验证 POST /api/verify
 *   3. 网络异常 → 降级本地 HASH 验证
 *   4. 返回等级或 null
 */
export async function verifyActivationCode(code: string): Promise<MembershipTier | null> {
  if (!code || typeof code !== 'string') return null;
  const trimmed = code.trim().toUpperCase();

  // 基础格式
  if (trimmed.length < 16 || trimmed.length > 32) {
    log.debug('激活码长度不合法', { length: trimmed.length });
    return null;
  }

  // 限速
  if (!(await checkRateLimit())) {
    log.warn('激活码验证被限速拦截');
    return null;
  }

  // 开发码
  if (__DEV__) {
    if (trimmed === 'DEV-LIFETIME' || trimmed === 'DEV-LIFETIME') return 'lifetime';
    if (trimmed === 'DEV-YEARLY') return 'yearly';
    if (trimmed === 'DEV-MONTHLY') return 'monthly';
  }

  // 防重用（本地记录）
  if (await isCodeUsed(trimmed)) {
    log.warn('激活码已被使用');
    return null;
  }

  // ===== Step 1: 远程验证（首选） =====
  const serverUp = await isServerAvailable();

  if (serverUp) {
    log.info('服务端可达，走远程验证');
    const remoteResult = await remoteVerifyActivationCode(trimmed);

    if (remoteResult.valid && remoteResult.tier) {
      await markCodeUsed(trimmed);
      log.info('远程验证成功', { tier: remoteResult.tier });
      return remoteResult.tier;
    }

    // 远程明确拒绝（非网络故障）
    if (remoteResult.reason && remoteResult.reason !== 'NETWORK_ERROR' && remoteResult.reason !== 'TIMEOUT') {
      log.warn('远程验证拒绝', { reason: remoteResult.reason });
      clearHealthCache(); // 远程返回了结果，不是网络问题，不降级
      return null;
    }

    // 网络异常 → 降级本地
    log.warn('远程验证网络异常，降级本地');
  } else {
    log.info('服务端不可达，走离线本地验证');
  }

  // ===== Step 2: 离线降级 — 本地 HASH 验证 =====
  const salt = await getDeviceSalt();
  let tierKey: MembershipTier | null = null;

  const stripped = trimmed.replace(/-/g, '');
  const newMatch = stripped.match(/^PICKUP(PM|PY|PF)([0-9A-Z]{16})$/);
  if (newMatch) {
    const prefix = newMatch[1];
    const entry = Object.entries(TIER_PREFIX).find(([, p]) => p === prefix);
    tierKey = (entry?.[0] as MembershipTier | undefined) || null;
    if (tierKey) {
      if (!verifyLocal(trimmed, tierKey, ZERO_SALT) && !verifyLocal(trimmed, tierKey, salt)) {
        tierKey = null;
      }
    }
  }

  if (tierKey) {
    await markCodeUsed(trimmed);
    log.info('本地验证成功（离线）', { tier: tierKey });
  } else {
    log.warn('本地验证也失败');
  }

  return tierKey;
}

/**
 * 获取剩余尝试次数
 */
export async function getRemainingAttempts(): Promise<number> {
  try {
    const raw = await getSetting(RATE_LIMIT_KEY);
    if (!raw) return MAX_ATTEMPTS;
    const record = JSON.parse(raw);
    const recent = (record.attempts || []).filter(
      (t: number) => Date.now() - t < COOLDOWN_MS,
    );
    return Math.max(0, MAX_ATTEMPTS - recent.length);
  } catch { return MAX_ATTEMPTS; }
}

/**
 * 重置限速（管理端用）
 */
export async function resetRateLimit(): Promise<void> {
  await setSetting(RATE_LIMIT_KEY, JSON.stringify({ attempts: [] }));
}

// ===== 管理端生码 =====

function generateCore(tier: MembershipTier, salt: string): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let randomPart = '';
  for (let i = 0; i < CORE_RAND_LEN; i++) {
    randomPart += chars[Math.floor(Math.random() * chars.length)];
  }
  const sig = computeSignature(SECRET() + tier + salt + randomPart);
  return randomPart + sig;
}

function formatCode(core: string): string {
  return `${core.slice(0, 4)}-${core.slice(4, 8)}-${core.slice(8, 12)}-${core.slice(12, 16)}`;
}

/**
 * 生成激活码（管理端用，离线兼容）
 */
export function generateActivationCode(
  tier: MembershipTier,
  salt: string = ZERO_SALT,
): string {
  const prefix = TIER_PREFIX[tier];
  const core = generateCore(tier, salt);
  return `PICKUP-${prefix}-${formatCode(core)}`;
}
