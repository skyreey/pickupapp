// ============================================================
// 支付通知监听 — 检测微信/支付宝付款 → 自动激活Pro
// ============================================================
import { extractPaymentAmount } from '../patterns/notification-patterns';
import { setIsPro, getIsPro } from './settings-store';

let listenerCleanup: (() => void) | null = null;
let expectedAmount: number | null = null;
let onActivated: (() => void) | null = null;

/**
 * 开始监听支付通知
 * @param amount 期望的支付金额（元）
 * @param onSuccess 激活成功回调
 */
export function startPaymentMonitor(amount: number, onSuccess: () => void): void {
  if (getIsPro()) { onSuccess(); return; }
  stopPaymentMonitor();

  expectedAmount = amount;
  onActivated = onSuccess;

  try {
    const { addNotificationListener } = require('../../modules/expo-notification-reader');

    listenerCleanup = addNotificationListener(
      (data: { packageName: string; title: string; text: string; timestamp: number }) => {
        const fullText = `${data.title} ${data.text}`;
        const paid = extractPaymentAmount(data.packageName, fullText);

        if (paid !== null && expectedAmount !== null) {
          // 允许±1元的误差（手续费等）
          if (Math.abs(paid - expectedAmount) <= 1) {
            // ✅ 支付成功！
            setIsPro(true);
            stopPaymentMonitor();
            onActivated?.();
          }
        }
      },
    );
  } catch {
    // 通知监听不可用
  }
}

/** 停止监听 */
export function stopPaymentMonitor(): void {
  listenerCleanup?.();
  listenerCleanup = null;
  expectedAmount = null;
  onActivated = null;
}
