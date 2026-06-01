// 截图 OCR 文字 → 快递信息解析
import { guessCarrierByTrackingNumber } from './sms-parser';
import type { CarrierCode } from '../models';

export interface OcrPackageInfo {
  trackingNumber: string;
  carrier: CarrierCode;
  carrierName: string;
  productName: string;
  orderSource: string;
  isPickedUp: boolean;
  /** 取件码（截图中如有） */
  pickupCode: string | null;
  /** 签收日期 */
  deliveryDate: string | null;
  /** 取件地址 */
  pickupAddress: string | null;
  /** 识别置信度：'high' | 'low' */
  confidence: 'high' | 'low';
}

/** 从 OCR 文字中提取快递信息 */
export function parseOcrText(text: string): OcrPackageInfo | null {
  if (!text) return null;

  // 1. 提取快递单号
  const trackingNumber = extractTrackingNumber(text);
  if (!trackingNumber) return null;

  // 2. 识别快递公司
  const carrier = extractCarrier(text, trackingNumber);

  // 计算置信度：快递公司识别成功 + 有商品名或平台 + 单号格式完整
  const hasCarrier = carrier.code !== 'unknown';
  const hasProductOrPlatform = !!(extractProductName(text) || extractPlatform(text));
  const confidence: 'high' | 'low' = (hasCarrier && hasProductOrPlatform) ? 'high' : 'low';

  return {
    trackingNumber,
    carrier: carrier.code,
    carrierName: carrier.name,
    productName: extractProductName(text),
    orderSource: extractPlatform(text),
    isPickedUp: /已签收|已收货|交易成功|已完成|已取件|已送达|派送成功|已被签收/.test(text),
    pickupCode: extractPickupCode(text),
    deliveryDate: extractDate(text),
    pickupAddress: extractPickupAddress(text),
    confidence,
  };
}

// ===== 快递单号提取 =====

function extractTrackingNumber(text: string): string | null {
  // 清理 OCR 常见字符混淆
  const cleaned = text
    .replace(/\s+/g, '')
    .replace(/[Oo]/g, '0')
    .replace(/[lI|]/g, '1')
    .replace(/[ＦＹＴＳＤＨＪＧＦＺＱＷＸＣＶＢＮＭ]/g, m =>
      String.fromCharCode(m.charCodeAt(0) - 65248)); // 全角字母 → 半角

  const patterns = [
    // 标签订单类
    /运单号[：:\s]*([A-Z0-9]{8,30})/i,
    /运单号码[：:\s]*([A-Z0-9]{8,30})/i,
    /快递单号[：:\s]*([A-Z0-9]{8,30})/i,
    /物流单号[：:\s]*([A-Z0-9]{8,30})/i,
    /订单编号[：:\s]*(\d{12,25})/i,
    /快递[：:\s]*([A-Z]{2,4}\d{8,20})/i,
    /单号[：:\s]*([A-Z0-9]{8,30})/i,
    // "编号" 后面跟长数字
    /编号[：:\s]*(\d{12,20})/i,
    // 快递公司名后面跟单号
    /(?:圆通|中通|申通|韵达|极兔|顺丰|京东|邮政|德邦|百世|菜鸟)[：:\s]*([A-Z]{0,4}\d{8,25})/,
    // 纯单号格式：SF/JD/YT 等字母开头的单号
    /\b([A-Z]{2,4}\d{8,25})\b/,
    // 纯数字长串（12位以上）
    /\b(\d{12,20})\b/,
  ];
  for (const p of patterns) {
    const m = cleaned.match(p);
    if (m) {
      const tn = m[1].trim().toUpperCase();
      if ((/^[A-Z0-9]{8,30}$/.test(tn) && /[A-Z]/.test(tn)) || /\d{10,}/.test(tn)) {
        return tn;
      }
    }
  }
  // 兜底：取任意字母+数字组合（排除疑似手机号/日期）
  const fallback = cleaned.match(/(?<!\d)[A-Z]{2,4}\d{8,25}(?!\d)/);
  return fallback ? fallback[0].toUpperCase() : null;
}

// ===== 取件码提取 =====

function extractPickupCode(text: string): string | null {
  const patterns = [
    // "取件码 6-8-1234" 或 "取件码：8-3-5021"
    /取件[码号][：:\s]*([\d\-]{4,15})/i,
    // 纯取件码格式：数字-数字-数字
    /\b(\d{1,2}[-－]\d{1,2}[-－]\d{3,4})\b/,
    // 6位纯数字取件码
    /取件[码号][：:\s]*(\d{4,8})/i,
    // "验证码" 但实际上是取件码（快递场景）
    /提货码[：:\s]*([A-Z0-9]{4,12})/i,
    /取货码[：:\s]*([A-Z0-9]{4,12})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim().replace(/－/g, '-');
  }
  return null;
}

// ===== 日期提取 =====

function extractDate(text: string): string | null {
  const patterns = [
    // "2024-01-15 14:30" 或 "2024/01/15 14:30"
    /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})[日号]?\s*\d{1,2}:\d{2}/,
    // "01-15 14:30"（本年度）
    /(\d{1,2}[-/月]\d{1,2})[日号]?\s*\d{1,2}:\d{2}/,
    // "1月15日"（纯日期）
    /(\d{1,2}月\d{1,2}[日号])/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim().replace(/[–-]/g, '-');
  }
  return null;
}

// ===== 取件地址提取 =====

function extractPickupAddress(text: string): string | null {
  const patterns = [
    /取件[地址地][：:\s]*([^\n]{4,60})/i,
    /取货[地址地][：:\s]*([^\n]{4,60})/i,
    /驿站[地址地][：:\s]*([^\n]{4,60})/i,
    /自提[点地][：:\s]*([^\n]{4,60})/i,
    /门店[地址地][：:\s]*([^\n]{4,60})/i,
    // 包含"路""街""号""小区"的地址
    /([一-鿿]{2,10}(?:路|街|道|巷|大道|大街)[一-鿿\d]{2,30}(?:号|小区|大厦|广场|中心|园|城|村))/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

// ===== 快递公司识别 =====

function extractCarrier(text: string, tn: string): { code: CarrierCode; name: string } {
  const names: Array<{ kw: RegExp; code: CarrierCode; name: string }> = [
    { kw: /顺丰速运|顺丰快递|顺丰物流|顺丰|SF[\s]*Express/i, code: 'shunfeng', name: '顺丰速运' },
    { kw: /圆通速递|圆通快递|圆通物流|圆通/i, code: 'yuantong', name: '圆通速递' },
    { kw: /中通快递|中通物流|中通|ZTO/i, code: 'zhongtong', name: '中通快递' },
    { kw: /申通快递|申通物流|申通|STO/i, code: 'shentong', name: '申通快递' },
    { kw: /韵达快递|韵达物流|韵达|YUNDA/i, code: 'yunda', name: '韵达快递' },
    { kw: /极兔速递|极兔快递|极兔|J&T/i, code: 'jitu', name: '极兔速递' },
    { kw: /京东快递|京东物流|京东/i, code: 'jingdong', name: '京东快递' },
    { kw: /邮政EMS|邮政速递|邮政快递|中国邮政|EMS/i, code: 'ems', name: '邮政EMS' },
    { kw: /德邦快递|德邦物流|德邦|大件物流/i, code: 'deppon', name: '德邦快递' },
    { kw: /百世快递|百世物流|百世/i, code: 'baishi', name: '百世快递' },
    { kw: /丹鸟|菜鸟裹裹/i, code: 'cainiao', name: '菜鸟裹裹' },
    { kw: /丰巢/i, code: 'fengchao', name: '丰巢' },
    { kw: /多多买菜/i, code: 'duoduomaicai', name: '多多买菜' },
    { kw: /美团优选/i, code: 'meituanyouxuan', name: '美团优选' },
  ];
  // 优先取文本中明确出现的快递公司名
  for (const { kw, code, name } of names) {
    if (kw.test(text)) return { code, name };
  }
  // 用单号前缀推断
  return guessCarrierByTrackingNumber(tn);
}

// ===== 平台识别 =====

const PLATFORM_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /淘宝|天猫|Tmall|taobao/i, name: '淘宝' },
  { pattern: /京东|JD[\s.]*com|joybuy/i, name: '京东' },
  { pattern: /拼多多|pinduoduo|P多多/i, name: '拼多多' },
  { pattern: /抖音|douyin|抖音电商/i, name: '抖音' },
  { pattern: /小红书|RED/i, name: '小红书' },
  { pattern: /1688|阿里巴巴/i, name: '1688' },
  { pattern: /闲鱼/i, name: '闲鱼' },
  { pattern: /快手|kuaishou/i, name: '快手' },
  { pattern: /唯品会/i, name: '唯品会' },
  { pattern: /当当/i, name: '当当' },
  { pattern: /苏宁/i, name: '苏宁' },
  { pattern: /美团/i, name: '美团' },
];

function extractPlatform(text: string): string {
  for (const { pattern, name } of PLATFORM_PATTERNS) {
    if (pattern.test(text)) return name;
  }
  return '';
}

// ===== 商品名提取 =====

function extractProductName(text: string): string {
  // 先尝试从常见标签中提取
  const labelPatterns = [
    /商品[名称]?[：:\s]+(.{2,40}?)(?:[\n，。,.]|$)/,
    /宝贝[名称]?[：:\s]+(.{2,40}?)(?:[\n，。,.]|$)/,
    /物品[名称]?[：:\s]+(.{2,40}?)(?:[\n，。,.]|$)/,
    /品名[：:\s]+(.{2,40}?)(?:[\n，。,.]|$)/,
    /订单[名称]?[：:\s]+(.{2,40}?)(?:[\n，。,.]|$)/,
  ];
  for (const p of labelPatterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }

  // 兜底：取第一行 3-40 字的文本（排除取件码/日期行）
  const lines = text.split(/[\n\r]+/)
    .map(l => l.trim())
    .filter(l => {
      if (l.length < 3 || l.length > 40) return false;
      // 排除明显不是商品名的行
      if (/^\d{6,}$|取件码|快递单号|运单号|物流|已签收|签收|下单时间|支付|订单|共计|合计|总计/.test(l)) return false;
      return true;
    });
  return lines[0] || '';
}
