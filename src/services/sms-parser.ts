// ============================================================
// 快递取件码短信解析引擎
//
// Pipeline: 过滤 → 取件码提取 → 公司识别 → 地址提取 → 时间提取
// ============================================================
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
  const text = normalizeText(body);
  if (!text) return null;

  // 0. 排除非快递短信（银行/支付/验证码/营销等）
  if (isNonDeliverySms(text)) return null;

  // 1. 过滤：快速判断是否为快递短信
  const matchedRule = findMatchingRule(text, sender || '');
  if (!matchedRule) return null;

  // 2. 提取取件码
  const code = extractCode(text, matchedRule);
  if (!code) return null;

  // 3. 识别快递公司（已经由 findMatchingRule 确定了 company）
  const company = matchedRule.courier.code;

  // 4. 提取地址
  const address = extractAddress(text, matchedRule) || '';

  // 5. 提取过期时间
  const expiresAt = extractExpireTime(text, matchedRule);

  // 6. 提取联系电话
  const stationPhone = extractPhone(text, matchedRule);

  // 7. 提取站点名称
  const stationName = extractStationName(text, matchedRule);

  // 7.5. 提取营业时间
  const businessHours = extractBusinessHours(text, matchedRule);

  // 尝试从正文提取真正的快递公司（覆盖菜鸟等兜底规则的硬编码名）
  const extractedCourier = extractCourierFromText(text);
  // 尝试从正文提取快递单号
  const trackingNumber = extractTrackingFromText(text);

  // 兜底快递公司：如果规则匹配的是平台（菜鸟/丰巢）而非快递公司，且正文没提取到快递名
  // 则标记为 unknown，不把"菜鸟驿站"当作快递公司
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

/**
 * 解析历史短信（不要求取件码 — 处理已取件/已签收等消息）
 * 返回 ParsedSmsResult 但 code 可能为空，status 字段指示包裹状态
 */
export function parseHistoricalSms(
  body: string,
  sender?: string,
): (ParsedSmsResult & { status: 'stored' | 'picked_up' | 'shipped' }) | null {
  const text = normalizeText(body);
  if (!text) return null;

  if (isNonDeliverySms(text)) return null;

  const matchedRule = findMatchingRule(text, sender || '');
  if (!matchedRule) return null;

  const code = extractCode(text, matchedRule) || '';

  // 检测包裹状态
  let status: 'stored' | 'picked_up' | 'shipped' = 'stored';
  if (/已签收|已取件|已取出|已领取|已提货|被签收|已收货/.test(text)) {
    status = 'picked_up';
  } else if (/已发货|已发出|已揽收|运输中|派送中|正在配送/.test(text)) {
    status = 'shipped';
  }

  // 尝试提取快递单号
  const trackingNumber = extractTrackingFromText(text) || '';

  // 尝试从正文提取真正的快递公司（覆盖菜鸟等兜底规则）
  const extractedCourier = extractCourierFromText(text);

  const address = extractAddress(text, matchedRule) || '';
  const stationPhone = extractPhone(text, matchedRule);
  const stationName = extractStationName(text, matchedRule);
  const businessHours = extractBusinessHours(text, matchedRule);
  const expiresAt = extractExpireTime(text, matchedRule);

  // 确定快递公司：正文提取 > 单号推断 > 规则兜底（但不把平台名当快递名）
  const isPlatformRule = matchedRule.courier.code === 'cainiao' || matchedRule.courier.code === 'fengchao';
  let finalCompany: CarrierCode;
  let finalCompanyName: string;
  if (extractedCourier) {
    finalCompany = extractedCourier.code;
    finalCompanyName = extractedCourier.name;
  } else if (trackingNumber) {
    const guess = guessCarrierByTrackingNumber(trackingNumber);
    if (guess.code !== 'unknown') {
      finalCompany = guess.code;
      finalCompanyName = guess.name;
    } else {
      finalCompany = isPlatformRule ? 'unknown' : matchedRule.courier.code;
      finalCompanyName = isPlatformRule ? '快递' : matchedRule.courier.name;
    }
  } else {
    finalCompany = isPlatformRule ? 'unknown' : matchedRule.courier.code;
    finalCompanyName = isPlatformRule ? '快递' : matchedRule.courier.name;
  }

  return {
    code,
    company: finalCompany,
    companyName: finalCompanyName,
    address,
    expiresAt,
    stationName,
    stationPhone,
    businessHours,
    status,
    trackingNumber: trackingNumber || undefined,
  };
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

/** 根据快递单号前缀推断快递公司 */
export function guessCarrierByTrackingNumber(tn: string): { code: CarrierCode; name: string } {
  const upper = tn.toUpperCase();
  if (upper.startsWith('SF'))    return { code: 'shunfeng',  name: '顺丰速运' };
  if (upper.startsWith('YT'))    return { code: 'yuantong',  name: '圆通速递' };
  if (upper.startsWith('JT'))    return { code: 'jitu',      name: '极兔速递' };
  if (upper.startsWith('JD'))    return { code: 'jingdong',  name: '京东快递' };
  if (upper.startsWith('STO'))   return { code: 'shentong',  name: '申通快递' };
  if (upper.startsWith('YUNDA')) return { code: 'yunda',     name: '韵达快递' };
  if (upper.startsWith('DPK'))   return { code: 'deppon',    name: '德邦快递' };
  if (/^[A-Z]{2}\d{9,13}$/.test(upper)) return { code: 'ems', name: '邮政EMS' };

  // 数字开头的推断
  if (/^77\d{10,}/.test(upper) || /^78\d{10,}/.test(upper))
    return { code: 'zhongtong', name: '中通快递' };
  if (/^88\d{10,}/.test(upper))
    return { code: 'ems', name: '邮政EMS' };

  return { code: 'unknown', name: '快递' };
}
