// ============================================================
// 取件提醒调度器 —— 定时检查已入库包裹
// ============================================================
import { getAllPackages, markAsPickedUp } from '../database/dao';
import {
  getReminderDays, getAutoPickupDays, isSchedulerEnabled,
  loadRemindedSet, loadAutoProcessedSet,
  saveRemindedSet, saveAutoProcessedSet,
} from './settings-store';
import { refreshPendingCount, startForegroundService, stopForegroundService } from './foreground-service';
import * as Notifications from 'expo-notifications';
import type { Package } from '../models';

const CHECK_INTERVAL = 2 * 60 * 60 * 1000; // 每 2 小时
const ONE_DAY = 24 * 60 * 60 * 1000;

let intervalId: ReturnType<typeof setInterval> | null = null;

// 已提醒过的包裹（持久化）
const reminded = new Set<string>();
// 已自动取件的包裹（持久化）
const autoProcessed = new Set<string>();

/**
 * 启动调度器 —— 启动前从持久化存储加载状态
 */
export async function startScheduler(): Promise<void> {
  if (intervalId) return;

  // 从 SharedPreferences 恢复 Set
  (await loadRemindedSet()).forEach(id => reminded.add(id));
  (await loadAutoProcessedSet()).forEach(id => autoProcessed.add(id));

  // 启动前台服务（通知栏常驻）
  startForegroundService();

  setTimeout(checkPackages, 30_000);
  intervalId = setInterval(checkPackages, CHECK_INTERVAL);
}

/**
 * 持久化两个 Set 到 SharedPreferences
 */
function persistState(): void {
  saveRemindedSet([...reminded]);
  saveAutoProcessedSet([...autoProcessed]);
}

/**
 * 停止调度器
 */
export function stopScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  stopForegroundService();
}

// ========== 取件提醒逻辑 ==========

function checkPackages(): void {
  try {
    if (!isSchedulerEnabled()) return;

    const reminderDays = getReminderDays();
    const autoPickupDays = getAutoPickupDays();
    if (reminderDays <= 0 && autoPickupDays <= 0) return;

    const stored = getAllPackages('stored');
    const now = Date.now();

    for (const pkg of stored) {
      if (autoProcessed.has(pkg.id)) continue;
      const elapsed = now - pkg.statusUpdatedAt;

      // 自动标记已取件（按入库天数）
      if (autoPickupDays > 0 && elapsed >= autoPickupDays * ONE_DAY) {
        markAsPickedUp(pkg.id);
        autoProcessed.add(pkg.id);
        reminded.delete(pkg.id);
        continue;
      }

      // 取件截止时间已过 → 自动标记 + 提醒
      if (pkg.expiresAt > 0 && pkg.expiresAt < now && !reminded.has(pkg.id)) {
        reminded.add(pkg.id);
        sendExpiryNotification(pkg);
        if (autoPickupDays > 0) {
          markAsPickedUp(pkg.id);
          autoProcessed.add(pkg.id);
        }
        continue;
      }

      // 截止前提醒：截止时间在未来 24h 内，且还没提醒过
      if (pkg.expiresAt > 0 && pkg.expiresAt > now) {
        const deadlineKey = `${pkg.id}--deadline`;
        if (!reminded.has(deadlineKey)) {
          const hoursLeft = (pkg.expiresAt - now) / (60 * 60 * 1000);
          if (hoursLeft <= 24) {
            reminded.add(deadlineKey);
            sendDeadlineReminder(pkg, hoursLeft);
          }
        }
      }

      // 常规到站天数提醒
      if (reminderDays > 0 && elapsed >= reminderDays * ONE_DAY && !reminded.has(pkg.id)) {
        reminded.add(pkg.id);
        sendReminderNotification(pkg);
      }
    }

    persistState();
    refreshPendingCount();
  } catch (e) {
    console.error('tracker-scheduler 检查失败:', e);
  }
}


// Dedicated notification channel for pickup reminders (user-controllable in system settings)
const CHANNEL_ID = "pickup-reminders";
import { Platform } from "react-native";

async function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "取件提醒",
      description: "包裹到站、截止时间和过期提醒",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
    });
  } catch {}
}
ensureNotificationChannel();
/** 截止前提醒：距截止不到24小时 */
async function sendDeadlineReminder(pkg: Package, hoursLeft: number): Promise<void> {
  try {
    const urgency = hoursLeft <= 4 ? '⚠' : hoursLeft <= 12 ? '⏰' : '📅';
    const timeLabel = hoursLeft <= 4
      ? `${Math.floor(hoursLeft)}小时后截止`
      : hoursLeft <= 12
        ? `今晚截止`
        : '明天截止';

    const title = pkg.productName
      ? `${urgency} "${pkg.productName}" ${timeLabel}`
      : `${urgency} ${pkg.carrierName}包裹${timeLabel}`;

    const bodyParts = ['请尽快取件，避免超时！'];
    if (pkg.pickupCode) bodyParts.push(`取件码：${pkg.pickupCode}`);
    if (pkg.pickupPointName) bodyParts.push(`取件点：${pkg.pickupPointName}`);
    if (pkg.pickupPointPhone) bodyParts.push(`电话：${pkg.pickupPointPhone}`);

    await Notifications.scheduleNotificationAsync({
      content: {
        channelId: CHANNEL_ID,
        title,
        body: bodyParts.join('\n'),
        data: { packageId: pkg.id, type: 'deadline' },
        sound: 'default',
      },
      trigger: null,
    });
  } catch {
    // 静默失败
  }
}

/** 过期通知 */
async function sendExpiryNotification(pkg: Package): Promise<void> {
  try {
    const title = pkg.productName
      ? `⚠ "${pkg.productName}" 取件已过期`
      : `⚠ ${pkg.carrierName}包裹取件已过期`;

    const bodyParts = ['取件截止时间已过，请确认是否已取件'];
    if (pkg.pickupCode) bodyParts.push(`取件码：${pkg.pickupCode}`);
    if (pkg.pickupPointName) bodyParts.push(`取件点：${pkg.pickupPointName}`);

    await Notifications.scheduleNotificationAsync({
      content: {
        channelId: CHANNEL_ID,
        title,
        body: bodyParts.join('\n'),
        data: { packageId: pkg.id, type: 'expiry' },
        sound: 'default',
      },
      trigger: null,
    });
  } catch {
    // 静默失败
  }
}

/** 常规到站天数提醒 */
async function sendReminderNotification(pkg: Package): Promise<void> {
  try {
    const days = Math.floor((Date.now() - pkg.statusUpdatedAt) / ONE_DAY);
    const title = pkg.productName
      ? `📦 "${pkg.productName}" 已到站 ${days} 天`
      : `📦 ${pkg.carrierName}包裹已到站 ${days} 天`;

    const bodyParts = ['记得去取件哦！'];
    if (pkg.pickupCode) bodyParts.push(`取件码：${pkg.pickupCode}`);
    if (pkg.pickupPointName) bodyParts.push(`取件点：${pkg.pickupPointName}`);

    await Notifications.scheduleNotificationAsync({
      content: {
        channelId: CHANNEL_ID,
        title,
        body: bodyParts.join('\n'),
        data: { packageId: pkg.id, type: 'reminder' },
        sound: 'default',
      },
      trigger: null,
    });
  } catch {
    // 静默失败
  }
}