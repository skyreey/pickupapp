// ============================================================
// 购物 App 推送通知解析引擎
//
// 输入: 通知包名 + 标题 + 内容
// 输出: 商品名 + 快递单号 + 快递公司 + 购买平台 + 地址 + 电话 + 站点名
// ============================================================
import {
  NOTIFICATION_RULES,
  SHOPPING_APPS,
} from '../patterns/notification-patterns';
import type { NotificationRule } from '../patterns/notification-patterns';
import type { ParsedNotificationResult } from '../models';
import { guessCarrierByTrackingNumber } from './carrier-utils';
import { normalizeText, isValidAddress } from '../utils/formatters';

/**
 * 解析购物 App 推送通知
 */
export function parseNotification(
  packageName: string,
  title: string,
  content: string,
): ParsedNotificationResult | null {
  const rule = findAppRule(packageName);
  if (!rule) return null;

  const fullText = normalizeText(title + '\n' + content);
  if (!fullText) return null;

  // 快速过滤：内容必须含物流关键词
  const hasKeyword = rule.titleKeywords.some(kw => fullText.includes(kw));
  if (!hasKeyword) return null;

  // 提取各字段
  const productName = extractProductName(fullText, rule);
  const trackingNumber = extractTrackingNumber(fullText, rule);
  if (!trackingNumber) return null;

  const { carrierName, carrier } = extractCarrier(fullText, trackingNumber, rule);
  const address = extractAddress(fullText, rule);
  const phone = extractPhone(fullText, rule);
  const stationName = extractStationName(fullText, rule);

  return {
    productName: productName || '未知商品',
    trackingNumber,
    carrier,
    carrierName: carrierName || '未知快递',
    orderSource: rule.app.name,
    address,
    phone,
    stationName,
  };
}

export function isShoppingApp(packageName: string): boolean {
  return packageName in SHOPPING_APPS || findAppRule(packageName) !== null;
}

// ============================================================
// 内部函数
// ============================================================

function findAppRule(packageName: string): NotificationRule | null {
  const exact = NOTIFICATION_RULES.find(r => r.app.packageName === packageName);
  if (exact) return exact;
  const generic = NOTIFICATION_RULES.find(r => r.app.packageName === '*');
  return generic || null;
}

function extractProductName(text: string, rule: NotificationRule): string | null {
  for (const pattern of rule.contentPatterns.productPatterns) {
    const match = text.match(pattern);
    if (match) {
      const name = match[1].trim();
      if (name.length >= 1 && name.length <= 80 && !/^\d+$/.test(name)) {
        return name;
      }
    }
  }
  return null;
}

function extractTrackingNumber(text: string, rule: NotificationRule): string | null {
  for (const pattern of rule.contentPatterns.trackingPatterns) {
    const match = text.match(pattern);
    if (match) {
      const tn = match[1].trim().toUpperCase().replace(/\s/g, '');
      // 必须是字母+数字组合，长度 8-30，不含中文
      if (/[A-Z0-9]{8,30}/.test(tn) && !/[一-龥]/.test(tn)) {
        return tn;
      }
    }
  }
  return null;
}

function extractCarrier(
  text: string,
  trackingNumber: string,
  rule: NotificationRule,
): { carrierName: string; carrier: ReturnType<typeof guessCarrierByTrackingNumber>['code'] } {
  for (const pattern of rule.contentPatterns.carrierPatterns) {
    const match = text.match(pattern);
    if (match) {
      const name = match[1].trim();
      if (name.length >= 2 && name.length <= 15 && !/^\d+$/.test(name)) {
        const cleanName = name.replace(/(?:快递|速运|物流|配送|承运)$/, '');
        const guess = guessCarrierByTrackingNumber(trackingNumber);
        return { carrierName: cleanName, carrier: guess.code };
      }
    }
  }
  const guess = guessCarrierByTrackingNumber(trackingNumber);
  return { carrierName: guess.name, carrier: guess.code };
}

/** 去掉地址尾部的快递品牌名 */
function cleanAddress(addr: string): string {
  return addr.replace(
    /(?:兔喜(?:生活|快递|超市)?|菜鸟(?:驿站|裹裹)?|丰巢(?:快递柜|智能柜)?|妈妈驿站|韵达超市|快递超市|邻里驿站|自提柜|代收点|快递柜|驿站)$/,
    '',
  );
}

function extractAddress(text: string, rule: NotificationRule): string | null {
  for (const pattern of rule.contentPatterns.addressPatterns) {
    const match = text.match(pattern);
    if (match) {
      const raw = match[1].trim().replace(/\s+/g, '');
      const addr = cleanAddress(raw);
      if (addr.length >= 2 && addr.length <= 100 && isValidAddress(addr)) {
        return addr;
      }
    }
  }
  return null;
}

function extractPhone(text: string, rule: NotificationRule): string | null {
  for (const pattern of rule.contentPatterns.phonePatterns) {
    const match = text.match(pattern);
    if (match) {
      const phone = match[1].replace(/[\s\-\(\)（）]/g, '');
      if (/^1[3-9]\d{9}$/.test(phone)) return phone;
      if (/^0\d{2,3}\d{7,8}$/.test(phone)) return phone;
      if (/^\d{3,4}\d{7,8}$/.test(phone)) return phone;
    }
  }
  return null;
}

function extractStationName(text: string, rule: NotificationRule): string | null {
  for (const pattern of rule.contentPatterns.stationNamePatterns) {
    const match = text.match(pattern);
    if (match) {
      const name = match[1].trim().replace(/\s+/g, '');
      if (name.length >= 2 && name.length <= 60) return name;
    }
  }
  return null;
}
