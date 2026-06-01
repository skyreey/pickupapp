// ============================================================
// 本地设置存储（内存 + SharedPreferences 持久化）
// ============================================================
import { getSetting, setSetting } from '../../modules/expo-notification-reader';
import { getAllPackages } from '../database/dao';

const HISTORY_DAYS_KEY = 'history_days';
const HAS_SCANNED_SMS_KEY = 'has_scanned_sms';
const BACKGROUND_MONITORING_KEY = 'background_monitoring';
const SCHEDULER_ENABLED_KEY = 'scheduler_enabled';
const REMINDER_DAYS_KEY = 'reminder_days';
const AUTO_PICKUP_DAYS_KEY = 'auto_pickup_days';
const HAS_SEEN_ONBOARDING_KEY = 'has_seen_onboarding';
const IS_PRO_KEY = 'is_pro';
let historyDays = 7;
let hasScannedSms = false;
let backgroundMonitoring = true;
let schedulerEnabled = true;
let reminderDays = 2;
let autoPickupDays = 7;
let hasSeenOnboarding = false;
let isPro = false;

// 免费版包裹上限
export const FREE_PACKAGE_LIMIT = 5;

// 定价信息
export const PRICING = {
  monthly: { price: '¥3.99', period: '月' },
  yearly: { price: '¥29.9', period: '年' },
  lifetime: { price: '¥68', period: '永久' },
};

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

export function getIsPro(): boolean {
  return isPro;
}

export async function setIsPro(value: boolean): Promise<void> {
  isPro = value;
  await setSetting(IS_PRO_KEY, value ? '1' : '0');
}

/** 检查是否可以添加新包裹（免费版有上限） */
export function canAddPackage(incomingCount: number = 1): boolean {
  if (getIsPro()) return true;
  const all = getAllPackages();
  return all.length + incomingCount <= FREE_PACKAGE_LIMIT;
}

/** 获取当前包裹总数 */
export function getTotalPackageCount(): number {
  return getAllPackages().length;
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
  } catch {}
  return [];
}

export async function saveAutoProcessedSet(ids: string[]): Promise<void> {
  await setSetting(AUTO_PROCESSED_SET_KEY, JSON.stringify(ids));
}

export async function loadAutoProcessedSet(): Promise<string[]> {
  try {
    const raw = await getSetting(AUTO_PROCESSED_SET_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

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
    const savedPro = await getSetting(IS_PRO_KEY);
    isPro = savedPro === '1';
  } catch {}
}
