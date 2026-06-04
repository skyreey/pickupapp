// ============================================================
// 本地设置存储（内存 + SharedPreferences 持久化）
// 会员体系：月度VIP / 年度VIP / 永久VIP
// ============================================================
import { getSetting, setSetting } from '../../modules/expo-notification-reader';
import { getAllPackages } from '../database/dao';
import type { Membership, MembershipTier, ActivationMethod } from '../models';
import { createLogger } from '../utils/logger';

const log = createLogger('SettingsStore');

const HISTORY_DAYS_KEY = 'history_days';
const HAS_SCANNED_SMS_KEY = 'has_scanned_sms';
const BACKGROUND_MONITORING_KEY = 'background_monitoring';
const SCHEDULER_ENABLED_KEY = 'scheduler_enabled';
const REMINDER_DAYS_KEY = 'reminder_days';
const AUTO_PICKUP_DAYS_KEY = 'auto_pickup_days';
const HAS_SEEN_ONBOARDING_KEY = 'has_seen_onboarding';
const MEMBERSHIP_KEY = 'membership';
const MEMBERSHIP_SIG_KEY = 'membership_sig';
const LARGE_FONT_KEY = 'large_font_mode';

let historyDays = 7;
let hasScannedSms = false;
let backgroundMonitoring = true;
let schedulerEnabled = true;
let reminderDays = 2;
let autoPickupDays = 7;
let hasSeenOnboarding = false;
let largeFontMode = false;

// ========== 会员状态 ==========

const DEFAULT_MEMBERSHIP: Membership = {
  active: false,
  tier: null,
  activatedAt: 0,
  expiresAt: 0,
  method: null,
  code: null,
};

let membership: Membership = { ...DEFAULT_MEMBERSHIP };

// 免费版包裹上限
export const FREE_PACKAGE_LIMIT = 5;

// ========== 定价 & 等级配置 ==========

export const PRICING = {
  monthly: { price: '¥3.99', period: '月', amount: 3.99 },
  yearly: { price: '¥29.9', period: '年', amount: 29.90 },
  lifetime: { price: '¥68', period: '永久', amount: 68.00 },
};

export const MEMBERSHIP_TIERS: Array<{
  key: MembershipTier; amount: number; durationDays: number; rank: number;
}> = [
  { key: 'monthly', amount: 3.99, durationDays: 31, rank: 1 },
  { key: 'yearly', amount: 29.90, durationDays: 366, rank: 2 },
  { key: 'lifetime', amount: 68.00, durationDays: 0, rank: 3 },
];

// ========== 会员 API ==========

/** 获取完整会员信息 */
export function getMembership(): Membership {
  return { ...membership };
}

/** 是否已激活且未过期（含防篡改校验） */
export function isMembershipActive(): boolean {
  // 仅在开发模式下自动激活，生产环境必须通过正常激活流程
  if (__DEV__ && !membership.active) {
    membership = { active: true, tier: 'lifetime', activatedAt: Date.now(), expiresAt: 0, method: 'code', code: 'DEV-AUTO' };
    membership._sig = membershipSign(membership);
    setSetting(MEMBERSHIP_KEY, JSON.stringify(membership)).catch(() => {});
  }
  if (!membership.active) return false;
  // 防篡改校验
  if (!verifyMembershipSig(membership)) {
    membership = { ...DEFAULT_MEMBERSHIP };
    setSetting(MEMBERSHIP_KEY, JSON.stringify(membership));
    return false;
  }
  if (membership.tier === 'lifetime') return true;
  if (membership.expiresAt > 0 && Date.now() > membership.expiresAt) {
    // 已过期，自动标记为非活跃
    membership.active = false;
    membership._sig = membershipSign(membership);
    setSetting(MEMBERSHIP_KEY, JSON.stringify(membership));
    return false;
  }
  return true;
}

/** 剩余天数（永久会员返回 -1） */
export function getRemainingDays(): number {
  if (!membership.active) return 0;
  if (membership.tier === 'lifetime') return -1;
  if (!membership.expiresAt) return 0;
  const days = Math.ceil((membership.expiresAt - Date.now()) / 86400000);
  return Math.max(0, days);
}

/** 获取到期时间文案 */
export function getExpiryText(): string {
  if (!membership.active) return '';
  if (membership.tier === 'lifetime') return '永久有效';
  const remaining = getRemainingDays();
  const date = new Date(membership.expiresAt).toLocaleDateString('zh-CN');
  if (remaining <= 0) return '已过期';
  if (remaining <= 30) return `剩余 ${remaining} 天（${date} 到期）`;
  return `${date} 到期`;
}

/** 获取等级中文名 */
export function getTierName(): string {
  switch (membership.tier) {
    case 'monthly': return '月度VIP';
    case 'yearly': return '年度VIP';
    case 'lifetime': return '永久VIP';
    default: return '';
  }
}

/** 激活结果 */
export interface ActivateResult {
  success: boolean;
  reason?: 'downgrade' | 'same_tier';
  currentTier?: MembershipTier;
  targetTier?: MembershipTier;
}

/** 获取等级权重（越高越高级） */
function getTierRank(tier: MembershipTier): number {
  return MEMBERSHIP_TIERS.find(t => t.key === tier)?.rank || 0;
}

/** 为会员数据生成防篡改签名 */
function membershipSign(m: Membership): string {
  const payload = `${m.active}|${m.tier || ''}|${m.activatedAt}|${m.expiresAt}|${m.method || ''}|${m.code || ''}`;
  let h = 0x9e3779b9;
  for (let i = 0; i < payload.length; i++) {
    h = ((h << 7) - h + payload.charCodeAt(i) + i * 31) | 0;
    h = ((h ^ (h >>> 16)) * 0x85ebca6b) | 0;
    h = ((h ^ (h >>> 13)) * 0xc2b2ae35) | 0;
  }
  return Math.abs(h).toString(36);
}

/** 验证会员数据是否被篡改 */
function verifyMembershipSig(m: Membership): boolean {
  if (!m.active) return true; // 未激活状态无需验证
  const expected = membershipSign(m);
  return m._sig === expected;
}

/**
 * 激活会员（带等级保护）
 * - 高等级可覆盖低等级
 * - 低等级不能覆盖高等级 → 返回 downgrade
 * - 相同等级 → 返回 same_tier（调用方应弹出确认框）
 */
export async function activateMembership(
  tier: MembershipTier,
  method: ActivationMethod,
  code: string | null = null,
): Promise<ActivateResult> {
  const currentRank = membership.active && membership.tier ? getTierRank(membership.tier) : 0;
  const targetRank = getTierRank(tier);

  // 已激活 + 目标等级低于当前 → 拒绝降级
  if (membership.active && targetRank < currentRank) {
    return {
      success: false,
      reason: 'downgrade',
      currentTier: membership.tier!,
      targetTier: tier,
    };
  }

  // 已激活 + 相同等级 → 提示续费
  if (membership.active && targetRank === currentRank) {
    return {
      success: false,
      reason: 'same_tier',
      currentTier: membership.tier!,
      targetTier: tier,
    };
  }

  // 允许激活：新用户 / 升级 / 已过期后重新激活
  return forceActivateMembership(tier, method, code);
}

/**
 * 强制激活（绕过等级保护，用于续费确认后执行）
 * 相同等级续费：在原到期时间基础上叠加
 * 升级/新用户：重置激活时间
 */
export async function forceActivateMembership(
  tier: MembershipTier,
  method: ActivationMethod,
  code: string | null = null,
): Promise<ActivateResult> {
  const tierConfig = MEMBERSHIP_TIERS.find(t => t.key === tier);
  const now = Date.now();

  // 相同等级续费：在原到期时间上叠加
  const isSameTier = membership.active && membership.tier === tier;
  const baseTime = isSameTier && membership.expiresAt > now
    ? membership.expiresAt
    : now;

  const expiresAt = tierConfig && tierConfig.durationDays > 0
    ? baseTime + tierConfig.durationDays * 86400000
    : 0;

  membership = {
    active: true,
    tier,
    activatedAt: isSameTier ? membership.activatedAt : now,
    expiresAt,
    method,
    code,
  };
  // 追加防篡改签名
  membership._sig = membershipSign(membership);

  await setSetting(MEMBERSHIP_KEY, JSON.stringify(membership));
  await setSetting(MEMBERSHIP_SIG_KEY, membership._sig);

  // 后台同步到云端（不阻塞激活流程）
  syncMembershipToCloud(tier, method, code);

  return { success: true };
}

/**
 * 后台同步会员状态到云端
 */
async function syncMembershipToCloud(tier: MembershipTier, method: ActivationMethod, code: string | null): Promise<void> {
  try {
    const { syncMembership, getDeviceId } = require('./remote-activation');
    const deviceId = await getDeviceId();
    log.info('后台同步会员到云端', { tier, deviceId });
    await syncMembership(tier, membership.activatedAt, membership.expiresAt);
  } catch {
    // 云端同步失败不影响本地激活
  }
}

/**
 * 从云端恢复会员（换手机/清数据后调用）
 * 返回 true 表示恢复成功
 */
export async function restoreFromCloud(phone?: string): Promise<boolean> {
  try {
    const { restoreMembership } = require('./remote-activation');
    const result = await restoreMembership(phone);
    if (!result.found) {
      log.info('云端无会员记录');
      return false;
    }

    // 恢复本地 Membership
    membership = {
      active: true,
      tier: result.tier || 'yearly',
      activatedAt: result.activatedAt || Date.now(),
      expiresAt: result.expiresAt || 0,
      method: 'code',
      code: null,
    };
    membership._sig = membershipSign(membership);
    await setSetting(MEMBERSHIP_KEY, JSON.stringify(membership));
    await setSetting(MEMBERSHIP_SIG_KEY, membership._sig);
    log.info('会员从云端恢复成功', { tier: result.tier });
    return true;
  } catch (e) {
    log.warn('云端恢复失败', { error: String(e) });
    return false;
  }
}

/** 获取等级中文名（静态版本，可传参） */
export function getTierNameFor(tier: MembershipTier): string {
  switch (tier) {
    case 'monthly': return '月度VIP';
    case 'yearly': return '年度VIP';
    case 'lifetime': return '永久VIP';
    default: return '';
  }
}

/** 反激活（用于测试/重置） */
export async function deactivateMembership(): Promise<void> {
  membership = { ...DEFAULT_MEMBERSHIP };
  await setSetting(MEMBERSHIP_KEY, JSON.stringify(membership));
  await setSetting(MEMBERSHIP_SIG_KEY, '');
}

// ========== 向后兼容（旧 isPro 调用点仍可用） ==========

/** @deprecated 用 isMembershipActive() 替代 */
export function getIsPro(): boolean {
  return isMembershipActive();
}

/** @deprecated 用 activateMembership() 替代，默认激活为年度会员 */
export async function setIsPro(value: boolean): Promise<void> {
  if (value) {
    await forceActivateMembership('yearly', 'code');
  } else {
    await deactivateMembership();
  }
}

// ========== 业务限制 ==========

/** 检查是否可以添加新包裹（会员无限制） */
export function canAddPackage(incomingCount: number = 1): boolean {
  if (isMembershipActive()) return true;
  const all = getAllPackages();
  return all.length + incomingCount <= FREE_PACKAGE_LIMIT;
}

/** 获取当前包裹总数 */
export function getTotalPackageCount(): number {
  return getAllPackages().length;
}

// ========== 设置存取 ==========

export function getHistoryDays(): number {
  return historyDays;
}

export async function setHistoryDays(days: number): Promise<void> {
  historyDays = days;
  await setSetting(HISTORY_DAYS_KEY, String(days));
}

export async function setHasScannedSms(value: boolean): Promise<void> {
  hasScannedSms = value;
  await setSetting(HAS_SCANNED_SMS_KEY, value ? '1' : '0');
}

export function isBackgroundMonitoringEnabled(): boolean {
  return backgroundMonitoring;
}

export async function setBackgroundMonitoringEnabled(enabled: boolean): Promise<void> {
  backgroundMonitoring = enabled;
  await setSetting(BACKGROUND_MONITORING_KEY, enabled ? '1' : '0');
}

// ---------- 取件提醒 ----------

export function isSchedulerEnabled(): boolean {
  return schedulerEnabled;
}

export async function setSchedulerEnabled(enabled: boolean): Promise<void> {
  schedulerEnabled = enabled;
  await setSetting(SCHEDULER_ENABLED_KEY, enabled ? '1' : '0');
}

export function getReminderDays(): number {
  return reminderDays;
}

export async function setReminderDays(days: number): Promise<void> {
  reminderDays = days;
  await setSetting(REMINDER_DAYS_KEY, String(days));
}

export function getAutoPickupDays(): number {
  return autoPickupDays;
}

export async function setAutoPickupDays(days: number): Promise<void> {
  autoPickupDays = days;
  await setSetting(AUTO_PICKUP_DAYS_KEY, String(days));
}

export function getHasSeenOnboarding(): boolean {
  return hasSeenOnboarding;
}

export async function setHasSeenOnboarding(value: boolean): Promise<void> {
  hasSeenOnboarding = value;
  await setSetting(HAS_SEEN_ONBOARDING_KEY, value ? '1' : '0');
}

// ---------- 大字模式 ----------

export function getLargeFontMode(): boolean {
  return largeFontMode;
}

export async function setLargeFontMode(enabled: boolean): Promise<void> {
  largeFontMode = enabled;
  await setSetting(LARGE_FONT_KEY, enabled ? '1' : '0');
}

// ---------- 提醒/自动取件状态持久化 ----------

const REMINDED_SET_KEY = 'reminded_set';
const AUTO_PROCESSED_SET_KEY = 'auto_processed_set';

export async function saveRemindedSet(ids: string[]): Promise<void> {
  await setSetting(REMINDED_SET_KEY, JSON.stringify(ids));
}

export async function loadRemindedSet(): Promise<string[]> {
  try {
    const raw = await getSetting(REMINDED_SET_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { log.warn('加载提醒集合失败', { error: String(e) }); }
  return [];
}

export async function saveAutoProcessedSet(ids: string[]): Promise<void> {
  await setSetting(AUTO_PROCESSED_SET_KEY, JSON.stringify(ids));
}

export async function loadAutoProcessedSet(): Promise<string[]> {
  try {
    const raw = await getSetting(AUTO_PROCESSED_SET_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { log.warn('加载自动处理集合失败', { error: String(e) }); }
  return [];
}

// ========== 加载全部设置 ==========

export async function loadSettings(): Promise<void> {
  try {
    const savedDays = await getSetting(HISTORY_DAYS_KEY);
    if (savedDays) historyDays = parseInt(savedDays, 10) || 7;
    const savedScan = await getSetting(HAS_SCANNED_SMS_KEY);
    hasScannedSms = savedScan === '1';
    const savedBg = await getSetting(BACKGROUND_MONITORING_KEY);
    if (savedBg) backgroundMonitoring = savedBg === '1';
    const savedScheduler = await getSetting(SCHEDULER_ENABLED_KEY);
    if (savedScheduler) schedulerEnabled = savedScheduler === '1';
    const savedReminder = await getSetting(REMINDER_DAYS_KEY);
    if (savedReminder) reminderDays = parseInt(savedReminder, 10) || 2;
    const savedAuto = await getSetting(AUTO_PICKUP_DAYS_KEY);
    if (savedAuto) autoPickupDays = parseInt(savedAuto, 10) || 7;
    const savedOnboarding = await getSetting(HAS_SEEN_ONBOARDING_KEY);
    hasSeenOnboarding = savedOnboarding === '1';

    const savedLargeFont = await getSetting(LARGE_FONT_KEY);
    largeFontMode = savedLargeFont === '1';

    // 加载会员：优先新格式，回退旧 is_pro
    const savedMembership = await getSetting(MEMBERSHIP_KEY);
    if (savedMembership) {
      try {
        const parsed = JSON.parse(savedMembership);
        membership = { ...DEFAULT_MEMBERSHIP, ...parsed };
        // 防篡改验证
        if (membership.active && !verifyMembershipSig(membership)) {
          // 签名不匹配 → 可能被手动修改 SharedPreferences
          membership = { ...DEFAULT_MEMBERSHIP };
          await setSetting(MEMBERSHIP_KEY, JSON.stringify(membership));
        }
      } catch (e) {
        log.warn('解析会员数据失败', { error: String(e) });
        membership = { ...DEFAULT_MEMBERSHIP };
      }
    } else {
      // 回退：旧版本 isPro 记录
      const savedPro = await getSetting('is_pro');
      if (savedPro === '1') {
        membership = {
          active: true,
          tier: 'yearly',
          activatedAt: Date.now() - 86400000 * 365,
          expiresAt: Date.now() + 86400000 * 366,
          method: 'code',
          code: null,
        };
        membership._sig = membershipSign(membership);
        await setSetting(MEMBERSHIP_KEY, JSON.stringify(membership));
      }
    }

    // 检查是否过期
    if (membership.active && membership.tier !== 'lifetime' && membership.expiresAt > 0 && Date.now() > membership.expiresAt) {
      membership.active = false;
      membership._sig = membershipSign(membership);
      await setSetting(MEMBERSHIP_KEY, JSON.stringify(membership));
    }
  } catch (e) { log.error('加载设置失败', { error: String(e) }); }
}
