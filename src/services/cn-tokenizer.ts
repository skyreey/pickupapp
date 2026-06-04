// ============================================================
// 中文分词 + 快递信息兜底提取
// 当正则匹配失败时，用词典分词 → 关键词提取
// ============================================================
import type { CarrierCode, ParsedSmsResult } from '../models';
import { guessCarrierByTrackingNumber } from './carrier-utils';

// ===== 快递领域词典 =====
const COURIER_DICT = new Set([
  // 快递公司
  '顺丰', '顺丰速运', '圆通', '圆通速递', '中通', '中通快递', '申通', '申通快递',
  '韵达', '韵达快递', '极兔', '极兔速递', '京东', '京东快递', '京东物流',
  '邮政', 'EMS', '德邦', '德邦快递', '百世', '百世快递', '丹鸟', '菜鸟', '菜鸟裹裹',
  // 驿站品牌
  '菜鸟驿站', '妈妈驿站', '邻里驿站', '兔喜', '兔喜生活', '兔喜快递',
  '丰巢', '丰巢快递柜', '韵达超市', '快递超市', '末端服务站', '便民服务站',
  // 通用快递词
  '快递', '取件', '取件码', '提货码', '取货码', '验证码',
  '驿站', '代收点', '自提点', '自提柜', '快递柜', '快递点', '门店',
  '包裹', '快件', '运单', '运单号', '快递单号', '物流单号',
  // 动作词
  '已到', '已到达', '已送达', '已签收', '请取件', '请尽快', '派送',
  '到达', '到站', '入库', '签收', '取走', '领取', '提取',
  // 地址相关
  '地址', '取件地址', '取货地址', '详细地址',
  '路', '街', '道', '巷', '号', '单元', '小区', '大厦', '广场',
  '电话', '联系电话', '手机', '联系',
  // 时间相关
  '截止', '过期', '逾期', '之前', '日内', '营业时间',
  '今天', '明天', '今日', '明日', '小时内', '天之内',
  // 平台
  '淘宝', '天猫', '京东', '拼多多', '抖音', '快手', '小红书',
  '1688', '闲鱼', '唯品会', '苏宁', '美团',
  // 状态
  '已签收', '已取件', '已完成', '派送中', '运输中', '待取件',
]);

// 按长度降序排列（FMM 优先长匹配）
const SORTED_DICT = Array.from(COURIER_DICT).sort((a, b) => b.length - a.length);

// ===== 正向最大匹配分词（FMM） =====
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < text.length) {
    let matched = false;
    // 从当前位置开始，尝试最长匹配
    for (const word of SORTED_DICT) {
      if (text.startsWith(word, i)) {
        tokens.push(word);
        i += word.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // 无匹配：单字切分
      const ch = text[i];
      // 跳过空格和标点
      if (/[\s，,。.！!？?：:；;、\-\–()（）【】《》""'']/.test(ch)) {
        tokens.push(ch);
      } else if (/[\d]/.test(ch)) {
        // 数字连在一起（可能是取件码、单号、电话）
        const numStart = i;
        while (i < text.length && /[\d\-–]/.test(text[i])) i++;
        tokens.push(text.slice(numStart, i));
        continue;
      } else if (/[a-zA-Z]/.test(ch)) {
        // 英文字母连在一起
        const enStart = i;
        while (i < text.length && /[a-zA-Z]/.test(text[i])) i++;
        tokens.push(text.slice(enStart, i).toUpperCase());
        continue;
      } else {
        // 中文单字
        tokens.push(ch);
      }
      i++;
    }
  }
  return tokens;
}

// ===== 关键词兜底提取 =====

export interface TokenExtractResult {
  code: string | null;
  address: string | null;
  stationName: string | null;
  stationPhone: string | null;
  tailNumber: string | null;
  businessHours: string | null;
  company: CarrierCode;
  companyName: string;
  expiresAt: number | null;
}

/**
 * 从无法正则匹配的文本中，用分词+关键词提取快递信息
 */
export function extractByTokenizer(text: string): TokenExtractResult | null {
  const tokens = tokenize(text);
  if (tokens.length === 0) return null;

  // 检查是否包含快递关键词
  const hasDeliveryKeyword = tokens.some(t =>
    /取件|快递|包裹|快件|驿站|代收|取货|提货|自提/.test(t),
  );
  if (!hasDeliveryKeyword) return null;

  // 提取取件码
  const code = extractCodeFromTokens(tokens);

  // 提取驿站名
  const stationName = extractStationFromTokens(tokens, text);

  // 提取地址
  const address = extractAddrFromTokens(tokens, text);

  // 提取电话
  const phone = extractPhoneFromTokens(tokens, text);

  // 至少有一个才返回
  if (!code && !stationName && !address && !phone) return null;

  // 识别快递公司
  const companyInfo = extractCompanyFromTokens(tokens);
  const tn = extractTrackingFromTokens(tokens);
  const finalCompany = companyInfo.code !== 'unknown'
    ? companyInfo
    : (tn ? guessCarrierByTrackingNumber(tn) : { code: 'unknown' as CarrierCode, name: '快递' });

  // 提取过期时间
  const expiresAt = extractExpireFromTokens(tokens);

  // 提取尾号
  const tailNumber = extractTailFromTokens(tokens, text);

  // 提取营业时间
  const businessHours = extractBusinessHoursFromTokens(tokens, text);

  return {
    code,
    address,
    stationName,
    stationPhone: phone,
    tailNumber,
    businessHours,
    company: finalCompany.code,
    companyName: finalCompany.name,
    expiresAt,
  };
}

// ===== 从分词结果中提取具体字段 =====

function extractCodeFromTokens(tokens: string[]): string | null {
  // 查找 "取件码" 或 "验证码" 后面的数字串
  for (let i = 0; i < tokens.length - 1; i++) {
    if (/取件[码号]|提货码|取货码|验证码/.test(tokens[i])) {
      const next = tokens[i + 1];
      // 可能是冒号分隔
      const target = next === '：' || next === ':' ? tokens[i + 2] : next;
      if (target && /^[\d\-–]{4,15}$/.test(target)) {
        return target.replace(/[––]/g, '-');
      }
    }
  }
  // 查找 "X-X-XXXX" 格式的取件码
  for (const t of tokens) {
    if (/^\d{1,2}[-–]\d{1,2}[-–]\d{3,6}$/.test(t)) {
      return t.replace(/[––]/g, '-');
    }
  }
  // 查找纯数字4-8位（可能是取件码）
  for (const t of tokens) {
    if (/^\d{4,8}$/.test(t) && tokens.some(tk => /取件|快递|包裹|驿站/.test(tk))) {
      return t;
    }
  }
  return null;
}

function extractStationFromTokens(tokens: string[], fullText: string): string | null {
  const stationKeywords = ['菜鸟驿站', '妈妈驿站', '邻里驿站', '兔喜生活', '兔喜快递',
    '兔喜', '丰巢', '丰巢快递柜', '韵达超市', '快递超市', '便民服务站', '末端服务站',
    '驿站', '代收点', '自提点', '自提柜', '快递柜', '快递点', '门店'];
  for (const t of tokens) {
    for (const kw of stationKeywords) {
      if (t === kw || t.includes(kw)) {
        // 尝试获取完整名称（前后各加2个token）
        const idx = tokens.indexOf(t);
        if (idx >= 0) {
          const before = tokens.slice(Math.max(0, idx - 2), idx).join('');
          const after = tokens.slice(idx + 1, idx + 3).join('');
          const fullName = (before + t + after).replace(/[：:，,。.\s]/g, '');
          if (fullName.length >= 3 && fullName.length <= 30) return fullName;
        }
        return t;
      }
    }
  }
  return null;
}

function extractAddrFromTokens(tokens: string[], fullText: string): string | null {
  // 查找 "地址" 后面的内容（3-5个token）
  for (let i = 0; i < tokens.length - 1; i++) {
    if (/地址|取件地址|取货地址|详细地址|地点/.test(tokens[i])) {
      const start = tokens[i + 1] === '：' || tokens[i + 1] === ':' ? i + 2 : i + 1;
      const addrTokens = tokens.slice(start, start + 8).join('').replace(/[：:，,。.\s]/g, '');
      if (addrTokens.length >= 4) return addrTokens;
    }
  }
  // 查找包含地址特征词的片段
  const addrIndicators = ['路', '街', '道', '巷', '号', '单元', '小区', '大厦', '广场', '号院'];
  for (const t of tokens) {
    if (addrIndicators.some(ind => t.includes(ind))) {
      // 向前后扩展
      const idx = tokens.indexOf(t);
      const range = tokens.slice(Math.max(0, idx - 5), idx + 5).join('');
      const cleaned = range.replace(/[：:，,。.\s]/g, '');
      if (cleaned.length >= 5 && cleaned.length <= 60) return cleaned;
    }
  }
  return null;
}

function extractPhoneFromTokens(tokens: string[], fullText: string): string | null {
  for (let i = 0; i < tokens.length - 1; i++) {
    if (/电话|联系电话|手机|联系|客服/.test(tokens[i])) {
      const next = tokens[i + 1] === '：' || tokens[i + 1] === ':' ? tokens[i + 2] : tokens[i + 1];
      if (next && /\d{7,13}/.test(next)) return next;
    }
  }
  // 纯手机号格式
  for (const t of tokens) {
    if (/^1[3-9]\d{9}$/.test(t)) return t;
  }
  return null;
}

function extractCompanyFromTokens(tokens: string[]): { code: CarrierCode; name: string } {
  const companyMap: Array<{ kw: string; code: CarrierCode; name: string }> = [
    { kw: '顺丰', code: 'shunfeng', name: '顺丰速运' },
    { kw: '圆通', code: 'yuantong', name: '圆通速递' },
    { kw: '中通', code: 'zhongtong', name: '中通快递' },
    { kw: '申通', code: 'shentong', name: '申通快递' },
    { kw: '韵达', code: 'yunda', name: '韵达快递' },
    { kw: '极兔', code: 'jitu', name: '极兔速递' },
    { kw: '京东', code: 'jingdong', name: '京东快递' },
    { kw: '邮政', code: 'ems', name: '邮政EMS' },
    { kw: 'EMS', code: 'ems', name: '邮政EMS' },
    { kw: '德邦', code: 'deppon', name: '德邦快递' },
    { kw: '百世', code: 'baishi', name: '百世快递' },
    { kw: '菜鸟', code: 'cainiao', name: '菜鸟' },
    { kw: '丰巢', code: 'fengchao', name: '丰巢' },
  ];
  for (const { kw, code, name } of companyMap) {
    if (tokens.some(t => t.includes(kw))) return { code, name };
  }
  return { code: 'unknown', name: '快递' };
}

function extractTrackingFromTokens(tokens: string[]): string | null {
  for (const t of tokens) {
    if (/^[A-Z]{2,4}\d{8,25}$/.test(t)) return t;
    if (/^\d{12,20}$/.test(t)) return t;
  }
  return null;
}

function extractExpireFromTokens(tokens: string[]): number | null {
  const joined = tokens.join('');
  const now = Date.now();
  // "X小时内"
  const hoursMatch = joined.match(/(\d{1,2})小时内/);
  if (hoursMatch) return now + parseInt(hoursMatch[1]) * 3600000;
  // "X天"
  const daysMatch = joined.match(/(\d{1,2})天[之内内]/);
  if (daysMatch) return now + parseInt(daysMatch[1]) * 86400000;
  // "今天X点前"
  const todayMatch = joined.match(/今天(\d{1,2})[点时]/);
  if (todayMatch) {
    const d = new Date();
    d.setHours(parseInt(todayMatch[1]), 0, 0, 0);
    if (d.getTime() < now) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  // "明天X点前"
  const tomorrowMatch = joined.match(/明天(\d{1,2})[点时]/);
  if (tomorrowMatch) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(parseInt(tomorrowMatch[1]), 0, 0, 0);
    return d.getTime();
  }
  return null;
}

function extractTailFromTokens(tokens: string[], fullText: string): string | null {
  // 查找 "尾号" 后面的数字
  for (let i = 0; i < tokens.length - 1; i++) {
    if (/尾号|尾数|后四位|后\d位/.test(tokens[i])) {
      let next = tokens[i + 1];
      if (next === '：' || next === ':') next = tokens[i + 2];
      if (next && /^\d{3,6}$/.test(next)) return next;
    }
  }
  // 在完整文本中匹配
  const m = fullText.match(/(?:尾号|尾数)[：:\s]*(\d{3,6})/);
  if (m) return m[1];
  // 脱敏格式 ****1234
  const masked = fullText.match(/\*{2,4}(\d{4})/);
  if (masked) return masked[1];
  return null;
}

function extractBusinessHoursFromTokens(tokens: string[], fullText: string): string | null {
  // 查找 "营业时间" 后面的内容
  for (let i = 0; i < tokens.length - 1; i++) {
    if (/营业时间|工作时间|营业/.test(tokens[i])) {
      const start = tokens[i + 1] === '：' || tokens[i + 1] === ':' ? i + 2 : i + 1;
      const hoursTokens = tokens.slice(start, start + 6).join('');
      if (hoursTokens.length >= 3) return hoursTokens;
    }
  }
  // 纯时间范围
  const timeRange = fullText.match(/(\d{1,2}:\d{2}\s*[-–—至到~]\s*\d{1,2}:\d{2})/);
  if (timeRange) return timeRange[1].replace(/\s+/g, '');
  // 24小时
  if (/(?:24\s*小时|全天)\s*(?:营业|服务|自助)?/.test(fullText)) {
    const m = fullText.match(/(24\s*小时\s*(?:营业|服务|自助)?|全天\s*(?:营业|服务|自助)?)/);
    if (m) return m[1].replace(/\s+/g, '');
  }
  return null;
}
