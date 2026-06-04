// ============================================================
// 支付通知监听 — 防伪造加固版 v2
//
// 改进点（相对 v1）：
//   1. 金额容差从 ¥0.05 收紧到 ¥0.02
//   2. 至少需要 2 条不同交易参考号的通知才激活
//   3. 通知文本最少长度从15提升到30
//   4. 排除更多非支付通知模式（红包/退款/转账给你等）
//   5. 所有验证步骤记录审计日志
//   6. 时间窗口内通知数量异常检测
// ============================================================
import { extractPaymentAmount } from '../patterns/notification-patterns';
import { isMembershipActive } from './settings-store';
import { addNotificationListener } from '../../modules/expo-notification-reader';
import { createLogger } from '../utils/logger';

const log = createLogger('PaymentMonitor');

let listenerCleanup: (() => void) | null = null;
let expectedAmount: number | null = null;
let onActivated: (() => void) | null = null;
let payStartTime: number = 0;
let notificationCount: number = 0;
/** 收集到的交易参考号（用于去重 + 多笔交叉验证） */
const seenRefs = new Set<string>();

// ===== 安全参数（收紧） =====
const TIME_WINDOW_MS = 120_000;         // 2分钟内有效
const AMOUNT_TOLERANCE = 0.02;          // ¥0.02容差（原¥0.05）
const MIN_TEXT_LENGTH = 30;              // 最少30字符（原15）
const MIN_NOTIFICATIONS = 2;             // 至少收到2条不同交易参考号的通知才激活（原1）
const MAX_NOTIFICATIONS = 20;            // 异常检测：超过此数视为攻击

/**
 * 从支付通知中提取交易参考号
 * 支付宝：订单号/交易号后8位
 * 微信：转账单号/交易单号片段
 * 银行：流水号
 */
function extractTransactionRef(text: string): string | null {
  // 支付宝
  const aliMatch = text.match(/(?:交易号|订单号|流水号|商户订单号)[:\s]*(\d{4,})/);
  if (aliMatch) return aliMatch[1].slice(-8);

  // 微信
  const wxMatch = text.match(/(?:转账单号|收款单号|交易单号|微信支付单号)[:\s]*(\d{4,})/);
  if (wxMatch) return wxMatch[1].slice(-8);

  // 银行
  const bankMatch = text.match(/(?:网银流水号|银行流水号|交易流水号)[:\s]*(\d{4,})/);
  if (bankMatch) return bankMatch[1].slice(-8);

  // 兜底：提取连续数字串（至少8位）
  const numMatch = text.match(/\d{8,}/);
  return numMatch ? numMatch[0].slice(-8) : null;
}

// ===== 非支付通知黑名单（扩展版） =====
const NON_PAYMENT_PATTERNS = [
  /红包/,
  /退款/,
  /提现/,
  /免密/,
  /代扣/,
  /自动扣/,
  /亲属卡/,
  /转账给你/,
  /转账给我/,
  /收到转账/,
  /奖金/,
  /补贴/,
  /奖励/,
  /优惠券/,
  /抵扣/,
  /减免/,
  /分期/,
  /额度/,
  /账单提醒/,
  /还款/,
  /利息/,
  /理财/,
  /基金/,
  /保险/,
];

function isNonPaymentNotification(text: string): boolean {
  return NON_PAYMENT_PATTERNS.some(p => p.test(text));
}

/**
 * 开始监听支付通知
 * @param amount 期望的支付金额（元）
 * @param onSuccess 激活成功回调
 */
export function startPaymentMonitor(amount: number, onSuccess: () => void): void {
  if (isMembershipActive()) {
    onSuccess();
    return;
  }
  stopPaymentMonitor();

  expectedAmount = amount;
  onActivated = onSuccess;
  payStartTime = Date.now();
  notificationCount = 0;
  seenRefs.clear();

  log.info('开始支付监听', { amount, timeWindowMs: TIME_WINDOW_MS });

  try {
    listenerCleanup = addNotificationListener(
      (data: { packageName: string; title: string; text: string; timestamp: number }) => {
        const fullText = `${data.title} ${data.text}`;

        // ==== 校验1：来源必须是支付App ====
        const validApps = ['com.tencent.mm', 'com.eg.android.AlipayGphone'];
        if (!validApps.includes(data.packageName)) return;

        // ==== 校验2：文本长度检查（过滤短伪造，30字符） ====
        if (fullText.length < MIN_TEXT_LENGTH) {
          log.debug('通知文本过短，跳过', { length: fullText.length, app: data.packageName });
          return;
        }

        // ==== 校验3：时间窗口检查 ====
        const elapsed = Date.now() - payStartTime;
        if (elapsed > TIME_WINDOW_MS) {
          log.debug('超出时间窗口，跳过', { elapsedMs: elapsed });
          return;
        }

        // ==== 校验4：通知时间戳合理性（系统时间±3分钟内，收紧） ====
        const now = Date.now();
        const notifTime = data.timestamp || 0;
        if (notifTime > 0 && Math.abs(now - notifTime) > 180_000) {
          log.warn('通知时间戳异常', {
            systemTime: now,
            notifTime,
            diff: Math.abs(now - notifTime),
          });
          return;
        }

        // ==== 校验5：排除非支付通知（扩展黑名单） ====
        if (isNonPaymentNotification(fullText)) {
          log.debug('非支付通知，跳过', { app: data.packageName });
          return;
        }

        // ==== 校验6：提取金额并精确比对 ====
        const paid = extractPaymentAmount(data.packageName, fullText);
        if (paid === null || expectedAmount === null) return;

        const diff = Math.abs(paid - expectedAmount);
        if (diff > AMOUNT_TOLERANCE) {
          log.debug('金额不匹配', {
            paid,
            expected: expectedAmount,
            diff,
            tolerance: AMOUNT_TOLERANCE,
          });
          return;
        }

        // ==== 校验7：提取交易参考号并去重 ====
        const ref = extractTransactionRef(fullText);
        if (!ref) {
          log.debug('未提取到交易参考号，跳过');
          return;
        }

        // 如果已经见过同样的参考号，跳过（防止同一笔通知的重复推送）
        if (seenRefs.has(ref)) return;
        seenRefs.add(ref);

        // ==== 校验8：异常数量检测 ====
        notificationCount++;
        if (notificationCount > MAX_NOTIFICATIONS) {
          log.error('支付通知数量异常，疑似攻击', {
            count: notificationCount,
            maxAllowed: MAX_NOTIFICATIONS,
            seenRefs: [...seenRefs],
          });
          stopPaymentMonitor();
          return;
        }

        log.info('支付通知验证通过', {
          count: notificationCount,
          ref,
          amount: paid,
          app: data.packageName,
        });

        // ==== 触发激活：至少 MIN_NOTIFICATIONS 条不同交易参考号 ====
        if (notificationCount >= MIN_NOTIFICATIONS) {
          log.info('支付验证完成，触发激活', {
            notifications: notificationCount,
            refs: [...seenRefs],
          });
          stopPaymentMonitor();
          onActivated?.();
        }
      },
    );
  } catch (e) {
    log.error('启动支付监听失败', { error: String(e) });
  }
}

/** 停止监听 */
export function stopPaymentMonitor(): void {
  if (listenerCleanup) {
    listenerCleanup();
    listenerCleanup = null;
  }
  const duration = Date.now() - payStartTime;
  log.info('支付监听停止', {
    durationMs: duration,
    totalNotifications: notificationCount,
    uniqueRefs: seenRefs.size,
    activated: !!onActivated,
  });
  expectedAmount = null;
  onActivated = null;
  payStartTime = 0;
  notificationCount = 0;
  seenRefs.clear();
}

/** 获取当前监听状态（供调试） */
export function getMonitorStatus(): {
  active: boolean;
  expectedAmount: number | null;
  elapsedMs: number;
  notificationCount: number;
  uniqueRefs: number;
} {
  return {
    active: listenerCleanup !== null,
    expectedAmount,
    elapsedMs: payStartTime > 0 ? Date.now() - payStartTime : 0,
    notificationCount,
    uniqueRefs: seenRefs.size,
  };
}
