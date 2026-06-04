// ============================================================
// 快递取件码短信解析引擎
//
// Pipeline: 过滤 → 正则匹配 → 字段提取
// 正则失败 → 分词兜底（cn-tokenizer）
// ============================================================
import { extractByTokenizer } from './cn-tokenizer';
import { guessCarrierByTrackingNumber } from './carrier-utils';
import { SMS_PATTERN_RULES, COURIER_INFO } from '../patterns/sms-patterns';
import type { SmsPatternRule } from '../patterns/sms-patterns';
import type { ParsedSmsResult, CarrierCode } from '../models';
import { normalizeText, isValidAddress } from '../utils/formatters';

// ============================================================
// 公开 API
// ============================================================

/**
 * 解析短信，返回取件码信息，或 null（非快递短信）
 */
export function parseSms(body: string, sender?: string): ParsedSmsResult | null {
  const core = _parseSmsCore(body, sender);
  if (!core || !core.code) return null;  // 必须提取到取件码
  const { code, text: _, matchedRule: __, extractedCourier: ___, ...result } = core;
  return { ...result, code };
}

/**
 * 解析历史短信（不要求取件码 — 处理已取件/已签收等消息）
 * 返回 ParsedSmsResult 但 code 可能为空，status 字段指示包裹状态
 */
export function parseHistoricalSms(
  body: string,
  sender?: string,
): (ParsedSmsResult & { status: 'stored' | 'picked_up' | 'shipped' }) | null {
  const core = _parseSmsCore(body, sender);
  if (!core) return null;

  // 检测包裹状态
  let status: 'stored' | 'picked_up' | 'shipped' = 'stored';
  if (/已签收|已取件|已取出|已领取|已提货|被签收|已收货/.test(core.text)) {
    status = 'picked_up';
  } else if (/已发货|已发出|已揽收|运输中|派送中|正在配送/.test(core.text)) {
    status = 'shipped';
  }

  const { text: _, matchedRule: __, extractedCourier: ___, ...result } = core;
  return { ...result, code: core.code || '', status };
}

// ============================================================
// 核心解析（parseSms + parseHistoricalSms 共享逻辑）
// ============================================================

interface CoreParseResult extends ParsedSmsResult {
  text: string;
  matchedRule: SmsPatternRule | null;
  extractedCourier: { code: CarrierCode; name: string } | null;
}

function _parseSmsCore(body: string, sender: string | undefined): CoreParseResult | null {
  const text = normalizeText(body);
  if (!text) return null;

  if (isNonDeliverySms(text)) return null;

  const matchedRule = findMatchingRule(text, sender || '');

  // 正则匹配失败 → 分词兜底
  if (!matchedRule) {
    const tokenResult = extractByTokenizer(text);
    if (!tokenResult) return null;
    return {
      code: tokenResult.code ?? '',
      company: tokenResult.company,
      companyName: tokenResult.companyName,
      address: tokenResult.address || '',
      expiresAt: tokenResult.expiresAt || null,
      stationName: tokenResult.stationName || null,
      stationPhone: tokenResult.stationPhone || null,
      text,
      matchedRule: null,
      extractedCourier: null,
    };
  }

  const code = extractCode(text, matchedRule) || '';
  const company = matchedRule.courier.code;
  const address = extractAddress(text, matchedRule) || '';
  const expiresAt = extractExpireTime(text, matchedRule);
  const stationPhone = extractPhone(text, matchedRule);
  const stationName = extractStationName(text, matchedRule);
  const businessHours = extractBusinessHours(text, matchedRule);
  const tailNumber = extractTailNumber(text);
  const extractedCourier = extractCourierFromText(text);
  const trackingNumber = extractTrackingFromText(text);

  // 兜底快递公司：平台规则（菜鸟/丰巢）不硬编码为快递名
  const isPlatformRule = company === 'cainiao' || company === 'fengchao';
  const finalCompany = extractedCourier?.code
    || (!isPlatformRule ? company : (trackingNumber ? guessCarrierByTrackingNumber(trackingNumber).code : 'unknown'));
  const finalCompanyName = extractedCourier?.name
    || (!isPlatformRule ? matchedRule.courier.name : (trackingNumber ? guessCarrierByTrackingNumber(trackingNumber).name : '快递'));

  return {
    code,
    company: finalCompany,
    companyName: finalCompanyName,
    address,
    expiresAt,
    stationName,
    stationPhone,
    businessHours,
    trackingNumber: trackingNumber ?? undefined,
    tailNumber: tailNumber ?? undefined,
    text,
    matchedRule,
    extractedCourier,
  };
}

// ============================================================
// 非快递短信黑名单
// ============================================================

function isNonDeliverySms(text: string): boolean {
  if (/银行|信用卡|消费退货|可用额度|借记卡积分|尾号\d{4}的龙卡|欠费|充值|停机/.test(text)) {
    return true;
  }
  if (/验证码[：:]\s*\d{4,6}.*?(?:注册|登录|API|开放平台|开通)/.test(text)) {
    return true;
  }
  if (/拒收请回复|退订回|免费领取|免息\d+天|借钱申请/.test(text)) {
    return true;
  }
  if (/消费|支付|付款|退款|扣款/.test(text) && !/包裹|取件|快递|驿站|自提|提货/.test(text)) {
    return true;
  }
  return false;
}

// ============================================================
// 内部函数
// ============================================================

/** 从规则库中找到匹配的快递公司规则 */
function findMatchingRule(text: string, sender: string): SmsPatternRule | null {
  let fallback: SmsPatternRule | null = null;

  for (const rule of SMS_PATTERN_RULES) {
    // 检查内容关键词
    const hasKeyword = rule.contentKeywords.some(kw => text.includes(kw));
    if (!hasKeyword) continue;

    // 发件人命中则直接返回（高置信度）
    if (sender && rule.senderPatterns.some(p => p.test(sender))) {
      return rule;
    }

    // 记录第一个关键词命中的规则作为兜底
    if (!fallback) fallback = rule;
  }

  return fallback;
}

/** 从短信文本中提取取件码 */
function extractCode(text: string, rule: SmsPatternRule): string | null {
  for (const pattern of rule.codePatterns) {
    const match = text.match(pattern);
    if (match) {
      const code = match[1].trim();
      // 过滤太短或太长的不合理结果
      if (code.length >= 4 && code.length <= 20) {
        return code;
      }
    }
  }
  return null;
}

/** 去掉地址尾部的快递品牌名（如"鸭旺口小区20号楼兔喜生活" → "鸭旺口小区20号楼"） */
function cleanAddress(addr: string): string {
  return addr.replace(
    /(?:兔喜(?:生活|快递|超市)?|菜鸟(?:驿站|裹裹)?|丰巢(?:快递柜|智能柜)?|妈妈驿站|韵达超市|快递超市|邻里驿站|自提柜|代收点|快递柜|驿站)$/,
    '',
  );
}

/** 从短信文本中提取地址 */
function extractAddress(text: string, rule: SmsPatternRule): string | null {
  for (const pattern of rule.addressPatterns) {
    const match = text.match(pattern);
    if (match) {
      const raw = match[1].trim().replace(/\s+/g, '');
      let addr = cleanAddress(raw);
      if (addr.length >= 2 && addr.length <= 100 && isValidAddress(addr)) {
        // 如果提取的地址缺少具体楼号/单元/车库，尝试从正文补充
        addr = mergeBodyDetail(addr, text);
        return addr;
      }
    }
  }
  return null;
}

/** 正文中可能包含更具体的位置信息（X号楼/X栋/车库等），补充到地址后面 */
function mergeBodyDetail(addr: string, text: string): string {
  // 地址中已有具体楼号/单元/室 → 不需要补充
  if (/(?:\d+号[楼栋幢]|\d+单元|\d+室|\d+号车库)/.test(addr)) {
    return addr;
  }

  // 从正文找具体位置碎片
  const detailPatterns = [
    /(\d+号[楼栋幢]?\s*(?:车库|底商|门面|门头房))/,
    /(\d+号[楼栋幢])/,
    /(\d+[栋幢]\s*\d+单元)/,
    /(\d+号车库)/,
  ];

  for (const p of detailPatterns) {
    const m = text.match(p);
    if (m) {
      const detail = m[1].replace(/\s+/g, '');
      if (!addr.includes(detail)) {
        return addr + detail;
      }
    }
  }

  return addr;
}

/** 从短信文本中提取联系电话 */
function extractPhone(text: string, rule: SmsPatternRule): string | null {
  for (const pattern of rule.phonePatterns) {
    const match = text.match(pattern);
    if (match) {
      const phone = match[1].replace(/[\s\-\(\)（）]/g, '');
      // 验证手机号或座机号格式
      if (/^1[3-9]\d{9}$/.test(phone)) return phone;
      if (/^0\d{2,3}\d{7,8}$/.test(phone)) return phone;
      if (/^\d{3,4}\d{7,8}$/.test(phone)) return phone;
    }
  }
  return null;
}

/** 从短信文本中提取站点/快递点名称 */
function extractStationName(text: string, rule: SmsPatternRule): string | null {
  for (const pattern of rule.stationNamePatterns) {
    const match = text.match(pattern);
    if (match) {
      const name = match[1].trim().replace(/\s+/g, '');
      if (name.length >= 2 && name.length <= 60) {
        return name;
      }
    }
  }
  return null;
}

/** 从短信文本中提取快递点营业时间 */
function extractBusinessHours(text: string, rule: SmsPatternRule): string | undefined {
  for (const pattern of rule.businessHoursPatterns) {
    const match = text.match(pattern);
    if (match) {
      const hours = match[1].trim().replace(/\s+/g, '');
      if (hours.length >= 5 && hours.length <= 30) {
        return hours;
      }
    }
  }
  return undefined;
}

/** 从短信文本中提取过期时间（返回时间戳或 null） */
function extractExpireTime(text: string, rule: SmsPatternRule): number | null {
  for (const pattern of rule.expirePatterns) {
    const match = text.match(pattern);
    if (match) {
      const timeStr = match[1].trim();
      return parseExpireTimeString(timeStr);
    }
  }
  return null;
}

/** 将自然语言过期时间转为时间戳 */
function parseExpireTimeString(str: string): number | null {
  const now = new Date();

  // "48小时内取件"
  const hoursMatch = str.match(/(\d+)\s*小时/);
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1], 10);
    return now.getTime() + hours * 60 * 60 * 1000;
  }

  // "24小时内" 的不同表达
  const hoursShort = str.match(/^(\d+)\s*h/i);
  if (hoursShort) {
    return now.getTime() + parseInt(hoursShort[1], 10) * 60 * 60 * 1000;
  }

  // "3天内"
  const daysMatch = str.match(/(\d+)\s*天/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    return now.getTime() + days * 24 * 60 * 60 * 1000;
  }

  // "今天18:00前" / "今天18:00之前"
  const todayMatch = str.match(/今天\s*(\d{1,2}):(\d{2})/);
  if (todayMatch) {
    const date = new Date(now);
    date.setHours(parseInt(todayMatch[1], 10), parseInt(todayMatch[2], 10), 0, 0);
    return date.getTime();
  }

  // "明天18:00前"
  const tomorrowMatch = str.match(/明天\s*(\d{1,2}):(\d{2})/);
  if (tomorrowMatch) {
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    date.setHours(parseInt(tomorrowMatch[1], 10), parseInt(tomorrowMatch[2], 10), 0, 0);
    return date.getTime();
  }

  // "5月22日18:00" / "5月22号18:00"
  const dateMatch = str.match(/(\d{1,2})月(\d{1,2})[日号]\s*(\d{1,2}):(\d{2})/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1], 10) - 1;
    const day = parseInt(dateMatch[2], 10);
    const date = new Date(now.getFullYear(), month, day,
      parseInt(dateMatch[3], 10), parseInt(dateMatch[4], 10));
    // 如果该日期已过（跨年），年份加1
    if (date.getTime() < now.getTime()) {
      date.setFullYear(date.getFullYear() + 1);
    }
    return date.getTime();
  }

  // "5月22日" (不含时间，默认当天23:59)
  const dateOnlyMatch = str.match(/(\d{1,2})月(\d{1,2})[日号]/);
  if (dateOnlyMatch) {
    const month = parseInt(dateOnlyMatch[1], 10) - 1;
    const day = parseInt(dateOnlyMatch[2], 10);
    const date = new Date(now.getFullYear(), month, day, 23, 59, 59);
    if (date.getTime() < now.getTime()) {
      date.setFullYear(date.getFullYear() + 1);
    }
    return date.getTime();
  }

  return null;
}

// ============================================================
// 从短信正文提取真正的快递公司（覆盖规则的兜底值"菜鸟驿站"）
// ============================================================

const COURIER_NAME_PATTERNS: Array<{ pattern: RegExp; code: CarrierCode; name: string }> = [
  { pattern: /极兔(?:速递|快递|物流)?/, code: 'jitu', name: '极兔速递' },
  { pattern: /顺丰(?:速运|快递|物流)?/, code: 'shunfeng', name: '顺丰速运' },
  { pattern: /圆通(?:速递|快递|物流)?/, code: 'yuantong', name: '圆通速递' },
  { pattern: /中通(?:快递|物流)?/, code: 'zhongtong', name: '中通快递' },
  { pattern: /申通(?:快递|物流)?/, code: 'shentong', name: '申通快递' },
  { pattern: /韵达(?:快递|物流)?/, code: 'yunda', name: '韵达快递' },
  { pattern: /百世(?:快递|物流|汇通)?/, code: 'baishi', name: '百世快递' },
  { pattern: /京东(?:快递|物流)?/, code: 'jingdong', name: '京东快递' },
  { pattern: /德邦(?:快递|物流)?/, code: 'deppon', name: '德邦快递' },
  { pattern: /邮政(?:快递|速递|EMS|国内)?|EMS/i, code: 'ems', name: '邮政EMS' },
  { pattern: /丰巢(?:快递柜|智能柜)?/, code: 'fengchao', name: '丰巢' },
  { pattern: /菜鸟(?:驿站|裹裹)?/, code: 'cainiao', name: '菜鸟' },
  { pattern: /丹鸟(?:快递|物流)?/, code: 'cainiao', name: '丹鸟快递' },
  { pattern: /多多买菜/, code: 'duoduomaicai', name: '多多买菜' },
  { pattern: /美团优选/, code: 'meituanyouxuan', name: '美团优选' },
];

/** 从短信正文中提取快递公司名称 */
function extractCourierFromText(text: string): { code: CarrierCode; name: string } | null {
  for (const entry of COURIER_NAME_PATTERNS) {
    if (entry.pattern.test(text)) {
      return { code: entry.code, name: entry.name };
    }
  }
  return null;
}

/** 从短信正文中提取快递单号 */
function extractTrackingFromText(text: string): string | null {
  const patterns = [
    /快递单号[：:\s]*([A-Z0-9]{8,30})/i,
    /运单号[：:\s]*([A-Z0-9]{8,30})/i,
    /物流单号[：:\s]*([A-Z0-9]{8,30})/i,
    /单号[：:\s]*([A-Z0-9]{8,30})/i,
    /([A-Z]{2,4}\d{8,25})/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const tn = m[1].trim().toUpperCase().replace(/\s/g, '');
      if (/[A-Z0-9]{8,30}/.test(tn) && !/[一-龥]/.test(tn)) {
        return tn;
      }
    }
  }
  return null;
}

/** 从短信文本中提取快递单号尾号 */
function extractTailNumber(text: string): string | null {
  const patterns = [
    // "尾号1234"
    /(?:快递|包裹|运单|单号)?尾号[：:\s]*(\d{3,6})\b/,
    // "手机尾号1234"
    /手机尾号[：:\s]*(\d{3,6})\b/,
    // "后四位1234"
    /后四位[：:\s]*(\d{4})\b/,
    // "单号尾号1234"
    /单号尾号[：:\s]*(\d{3,6})\b/,
    // "尾数1234"
    /尾数[：:\s]*(\d{3,6})\b/,
    // "****1234" 脱敏格式
    /\*{2,4}(\d{4})\b/,
    // "运单号后4位"
    /(?:运单|快递|物流)(?:号)?后\d位[：:\s]*(\d{3,6})\b/,
    // "您的快递(尾号1234)"
    /您的(?:快递|包裹).*?尾号[：:\s]*(\d{3,6})/,
    // "中通快递尾号1234" - 品牌+尾号
    /(?:顺丰|圆通|中通|申通|韵达|极兔|百世|京东|德邦|邮政|EMS)(?:快递|速运|物流)?.*?尾号[：:\s]*(\d{3,6})/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const tail = m[1].trim();
      if (tail.length >= 3 && tail.length <= 6) return tail;
    }
  }
  return null;
}

// ============================================================
// parseFreeformText — 口语化文本宽松解析
// 场景：微信聊天、口述等非标准格式文本
// ============================================================

const FREEFORM_CODE_PATTERNS: RegExp[] = [
  /(?:取件码|码|提货码|验证码)[\s：:]*([A-Za-z0-9]{3,8}(?:[\-–—]\d+)*)/,
  /(?:取件码|码|提货码|验证码)[\s：:]*(\d{2,4}[\-–]\d{2,4})/,
  /(\d{1,2}[\-–]\d{1,2}[\-–]\d{3,6})/,
  /(\d{4,8})\s*(?:的|是|，|。|,|\.|\s|$)/,
  /\b([A-Z]{1,2}\d{4,8})\b/,
];

const FREEFORM_COURIER_PATTERNS: Array<{ kw: RegExp; code: string; name: string }> = [
  { kw: /顺丰/, code: 'shunfeng', name: '顺丰速运' },
  { kw: /圆通/, code: 'yuantong', name: '圆通速递' },
  { kw: /中通/, code: 'zhongtong', name: '中通快递' },
  { kw: /申通/, code: 'shentong', name: '申通快递' },
  { kw: /韵达/, code: 'yunda', name: '韵达快递' },
  { kw: /极兔|J\s*&?\s*T/, code: 'jitu', name: '极兔速递' },
  { kw: /京东|JD/, code: 'jingdong', name: '京东快递' },
  { kw: /邮政|EMS/, code: 'ems', name: '邮政EMS' },
  { kw: /德邦/, code: 'deppon', name: '德邦快递' },
  { kw: /百世/, code: 'baishi', name: '百世快递' },
  { kw: /菜鸟/, code: 'cainiao', name: '菜鸟' },
  { kw: /丰巢/, code: 'fengchao', name: '丰巢' },
  { kw: /丹鸟/, code: 'cainiao', name: '丹鸟快递' },
];

const FREEFORM_STATION_PATTERNS: RegExp[] = [
  /([一-龥A-Za-z0-9]{1,15}(?:驿站|快递柜|丰巢|菜鸟|兔喜|妈妈驿站|邻里驿站|自提柜|代收点|韵达超市|快递超市|便民服务站|末端服务站|自提点|取件点))/,
  /(?:在|到|去)([一-龥A-Za-z0-9]{2,20}(?:驿站|快递柜|丰巢|菜鸟|兔喜|妈妈驿站|邻里驿站|自提柜|代收点|取件点))/,
];

/**
 * 从任意文本中提取快递取件信息（口语化文本宽松解析）
 * 返回 Partial ParsedSmsResult，code 不为空即视为成功
 */
export function parseFreeformText(text: string): ParsedSmsResult | null {
  if (!text) return null;

  const cleaned = text.trim().replace(/[【】「」『』""'']/g, '');

  // 1. 提取取件码
  let code: string | null = null;
  for (const p of FREEFORM_CODE_PATTERNS) {
    const m = cleaned.match(p);
    if (m) {
      const c = m[1].trim().toUpperCase().replace(/[–—]/g, '-');
      if (c.length >= 3 && c.length <= 20 && !/^\d{10,}$/.test(c)) {
        code = c;
        break;
      }
    }
  }
  if (!code) return null;

  // 2. 提取快递公司
  let company = 'unknown';
  let companyName = '快递';
  for (const { kw, code: c, name } of FREEFORM_COURIER_PATTERNS) {
    if (kw.test(cleaned)) {
      company = c;
      companyName = name;
      break;
    }
  }

  // 3. 提取站点名
  let stationName: string | null = null;
  for (const p of FREEFORM_STATION_PATTERNS) {
    const m = cleaned.match(p);
    if (m) {
      stationName = m[1].trim();
      break;
    }
  }

  // 4. 尝试提取地址
  let address = '';
  const addrMatch = cleaned.match(
    /(?:地址|在|到|去)[：:\s]*([一-龥A-Za-z0-9]{2,40}(?:路|街|道|巷|号|小区|大厦|广场|单元|栋|楼|层|室|门))/,
  );
  if (addrMatch) address = addrMatch[1].trim();

  // 5. 尝试提取电话
  let stationPhone: string | null = null;
  const phoneMatch = cleaned.match(/(?:电话|联系)[：:\s]*(1[3-9]\d{9})/);
  if (phoneMatch) stationPhone = phoneMatch[1];

  return {
    code,
    company: company as CarrierCode,
    companyName,
    address,
    expiresAt: null,
    stationName,
    stationPhone,
  };
}

// guessCarrierByTrackingNumber 提取到 carrier-utils.ts，此处重导出保持向后兼容
export { guessCarrierByTrackingNumber } from './carrier-utils';
