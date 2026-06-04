// ============================================================
// 截图 OCR 文字 → 快递信息解析
// 焦点：取件码 · 驿站名称 · 地址 · 电话（无需快递单号）
// 低置信度 → 分词兜底
// ============================================================
import { guessCarrierByTrackingNumber } from './carrier-utils';
import { extractByTokenizer } from './cn-tokenizer';
import type { CarrierCode } from '../models';

export interface OcrPackageInfo {
  /** 快递单号（可选，不是必须的） */
  trackingNumber: string | null;
  carrier: CarrierCode;
  carrierName: string;
  productName: string;
  orderSource: string;
  isPickedUp: boolean;
  /** 取件码（核心字段） */
  pickupCode: string | null;
  /** 签收/到站日期 */
  deliveryDate: string | null;
  /** 取件地址 */
  pickupAddress: string | null;
  /** 驿站/快递点名称 */
  stationName: string | null;
  /** 快递点联系电话 */
  stationPhone: string | null;
  /** 快递单号尾号（如"尾号1234"，仅有最后几位数字） */
  tailNumber: string | null;
  /** 快递点营业时间 */
  businessHours: string | null;
  /** 识别置信度 */
  confidence: 'high' | 'low';
}

/** OCR 文本预处理：标准化常见OCR误识别 */
function normalizeOcrText(text: string): string {
  return text
    // 常见OCR误识别修正
    .replace(/o/gi, '0')        // O→0 (取件码场景)
    .replace(/l/gi, '1')        // l/I→1
    .replace(/（/g, '(')        // 全角括号→半角
    .replace(/）/g, ')')
    .replace(/：/g, ':')        // 全角冒号→半角
    .replace(/，/g, ',')        // 全角逗号→半角
    .replace(/。/g, '.')        // 全角句号→半角
    .replace(/‐/g, '-')        // 各种破折号→标准连字符
    .replace(/―/g, '-')
    .replace(/－/g, '-')
    .replace(/\s+/g, ' ')      // 所有空白→单个空格
    // 恢复必要的换行（保留结构化分行给正则匹配）
    .replace(/ {2,}/g, ' ')
    .trim();
}

/**
 * 从 OCR 文字中提取快递信息
 * 只要有取件码 或 驿站名+地址 或 电话，就返回结果
 */
export function parseOcrText(text: string): OcrPackageInfo | null {
  if (!text) return null;
  // OCR文本预处理
  const cleaned = normalizeOcrText(text);

  // 核心字段提取
  const pickupCode = extractPickupCode(cleaned);
  const stationName = extractStationName(cleaned);
  const pickupAddress = extractPickupAddress(cleaned);
  const stationPhone = extractPhone(cleaned);
  const tailNumber = extractTailNumber(cleaned);
  const businessHours = extractBusinessHours(cleaned);

  // 至少有一个核心字段才返回结果
  if (!pickupCode && !stationName && !pickupAddress && !stationPhone) {
    // 兜底：有快递单号也行
    const tn = extractTrackingNumber(cleaned);
    if (!tn) return null;

    // 有单号但无核心信息 → low confidence
    return {
      trackingNumber: tn,
      carrier: extractCarrier(cleaned, tn).code,
      carrierName: extractCarrier(cleaned, tn).name,
      productName: extractProductName(cleaned),
      orderSource: extractPlatform(cleaned),
      isPickedUp: isPickedUp(cleaned),
      pickupCode: null,
      deliveryDate: extractDate(cleaned),
      pickupAddress: null,
      stationName: null,
      stationPhone: null,
      tailNumber,
      businessHours,
      confidence: 'low',
    };
  }

  // 有核心字段
  const tn = extractTrackingNumber(cleaned);
  const carrier = extractCarrier(cleaned, tn || '');
  const hasCarrier = carrier.code !== 'unknown';
  const hasPickupCode = !!pickupCode;
  const hasLocation = !!(stationName || pickupAddress);

  let result: OcrPackageInfo = {
    trackingNumber: tn,
    carrier: carrier.code,
    carrierName: carrier.name,
    productName: extractProductName(cleaned),
    orderSource: extractPlatform(cleaned),
    isPickedUp: isPickedUp(cleaned),
    pickupCode,
    deliveryDate: extractDate(cleaned),
    pickupAddress,
    stationName,
    stationPhone,
    tailNumber,
    businessHours,
    confidence: (hasCarrier && hasPickupCode && hasLocation) ? 'high' : 'low',
  };

  // 低置信度 → 分词兜底补充缺失字段
  if (result.confidence === 'low') {
    const tokenResult = extractByTokenizer(cleaned);
    if (tokenResult) {
      result.pickupCode = result.pickupCode || tokenResult.code;
      result.pickupAddress = result.pickupAddress || tokenResult.address;
      result.stationName = result.stationName || tokenResult.stationName;
      result.stationPhone = result.stationPhone || tokenResult.stationPhone;
      if (result.carrier === 'unknown' && tokenResult.company !== 'unknown') {
        result.carrier = tokenResult.company;
        result.carrierName = tokenResult.companyName;
      }
      // 兜底后重新评估
      const hasMore = !!(result.pickupCode && result.stationName);
      if (hasMore) result.confidence = 'high';
    }
  }

  return result;
}

// ===== 取件码提取 =====

function extractPickupCode(text: string): string | null {
  const patterns = [
    /取件[码号][：:\s]*([A-Z0-9\-–]{4,15})/i,
    /提货码[：:\s]*([A-Z0-9]{4,12})/i,
    /取货码[：:\s]*([A-Z0-9]{4,12})/i,
    /取货号[：:\s]*([A-Z0-9]{4,12})/i,
    /验证码[：:\s]*(\d{4,8})/i,  // 快递场景下验证码就是取件码
    /\b(\d{1,2}[-–]\d{1,2}[-–]\d{3,6})\b/,  // 纯格式：8-3-5021
    /码[：:\s]*(\d{4,8})\b/i,
    // 新增：更宽松的格式匹配
    /\b([A-Z]{1,4}\d{4,12})\b/,   // SF12345678 格式（无标签）
    /([A-Z]{1,2}\d{1,2}[-–]\d{1,2}[-–]\d{3,6})/, // X1-2-3456 格式
    /取件[：:\s]*(\d{4,8})\b/,    // "取件: 12345678"
    /[码号][：:\s]*(\d{2,4}[-–]\d{2,4})\b/,  // "码: 8-3-5021"
    // 菜鸟驿站常见格式
    /(\d{1,2}-\d{1,2}-\d{4,6})\b/,  // 8-3-5021 格式（无中文标签）
    // 丰巢常见格式
    /(?<!\d)(\d{6,8})\s*(?:的|，|。|$)/,   // "12345678的包裹" 或行末（不能从长数字中截取）
    // 取件码行（整行是取件码格式）
    /^[\s]*(\d{1,2}[-–]\d{1,2}[-–]\d{3,6})[\s]*$/m,
    /^[\s]*([A-Z]{1,4}\d{4,12})[\s]*$/m,
    // 括号包裹的取件码
    /[（(]\s*(\d{4,8}|[A-Z]{1,4}\d{4,12}|\d{1,2}[-–]\d{1,2}[-–]\d{3,6})\s*[)）]/,
    // 新增：更多格式
    /[：:\s](\d{1,2}[-–]\d{1,2}[-–]\d{3,6})\b/,   // 无标签但前面是冒号
    /[码号][：:\s]*([A-Z]{1,4}\d{4,12})\b/i,      // "码: SF12345678"
    // 菜鸟乡村格式（纯数字6位）
    /取件码[：:\s]*(\d{6})\b/,
    // 快递100/快递鸟等第三方格式
    /[（(](\d{4,8})[)）]\s*(?:到|已|请|$)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const raw = m[1].trim().replace(/[––]/g, '-');
      // 过滤过短/过长/纯日期格式
      if (raw.length >= 3 && raw.length <= 20 && !/^\d{10,}$/.test(raw)) {
        return raw;
      }
    }
  }
  return null;
}

// ===== 驿站/快递点名称提取 =====

function extractStationName(text: string): string | null {
  const patterns = [
    /(?:驿站|代收点|自提点|提货点|取件点|门店|快递点)[：:\s]*([^\n]{2,25})/i,
    /([一-鿿A-Za-z0-9]{2,15}(?:驿站|代收点|自提柜|快递柜|快递超市|服务中心|服务站|营业部|妈妈驿站|邻里驿站|兔喜|丰巢|菜鸟|末端服务点))/i,
    // 常见驿站品牌
    /(妈妈驿站|邻里驿站|兔喜生活|兔喜快递|丰巢快递柜|菜鸟驿站|菜鸟乡村|韵达超市|中通快递超市|圆通妈妈店|妈妈生活|百世邻里|快递超市|末端服务站)/i,
    // "请到XXX取件" 或 "您到XXX取件"
    /(?:请到|您到|到|在)([一-鿿A-Za-z0-9]{2,20}(?:驿站|代收|自提|快递|物流|门店|点|柜|超市|服务站|营业部|中心|店))/i,
    // "XX店" 结尾的店铺名（如"四季花城店"、"香江四季花城店"）
    /([一-鿿A-Za-z0-9]{3,20}(?:店|站|点))\b/i,
    // 城市前缀 + 店名：如"连云港东海香江四季花城店"
    /([一-鿿]{2,6}(?:市|县|区)[一-鿿A-Za-z0-9]{2,18}(?:店|站|点))/i,
    // 快递/物流公司类型 + 驿站/点（如"兔喜快递"、"韵达快递点"）
    /([一-鿿A-Za-z0-9]{2,10}(?:快递|物流|速运)\s*(?:点|站|柜|超市|驿站)?)\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const name = m[1].trim();
      if (name.length >= 3 && name.length <= 25) return name;
    }
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
    /快递[点站][地址地][：:\s]*([^\n]{4,60})/i,
    /地址[：:\s]*([^\n]{4,60})/i,
    // 包含路/街/号/小区的地址行
    /([一-鿿\d]{2,15}(?:路|街|道|巷|大道|大街|弄|里|胡同|号楼|单元|栋|幢|号院)[一-鿿\d\-]{2,30}(?:号|号楼|单元|层|室|小区|大厦|广场|中心|花园|园|城|村|苑|公寓|楼|栋))/,
    // 地址关键词后跟的整行
    /(?:在|位于|地点[：:\s])([一-鿿\d]{3,50}(?:路|街|道|号|小区|大厦|广场|中心|花园|园|城|村|苑|公寓))/i,
    // 新增：更宽松的地址匹配
    /([一-鿿\d]{2,10}(?:小区|花园|园|城|苑|公寓|楼|栋|单元|号院)[一-鿿\d\-]{0,20}(?:号|楼|栋|单元|室|层|车库|底商)?)/,
    // 常见快递地址格式：XX路XX号
    /([一-鿿\d]{2,15}(?:路|街|道|巷|弄)[一-鿿\d\-]{0,20}(?:号|弄|里)?)/,
    // 纯数字地址在特定关键词后
    /([一-鿿]{2,15}(?:驿站|代收|自提|快递|提货|取件)[^\n]{2,40})/i,
    // 电话号码附近经常有地址（兼容OCR输出顺序）
    /(?:1[3-9]\d{9}|0\d{2,3}[-–]?\d{7,8})[^\n]{0,5}([一-鿿\d]{3,40}(?:路|街|道|号|小区|栋|楼|单元|室|车库))/,
    // XX号楼XX单元（如"10号楼一单元"、"四季花城内10号楼一单元"）
    /([一-鿿\d]{2,30}号楼[一-鿿\d\-]{0,15}(?:单元|室|层|号)?)/,
    // "XX内XX号楼" 或 "XX内XX号"（如"四季花城内10号楼"）
    /([一-鿿\d]{2,10}(?:内|里|中)[一-鿿\d\-]{2,25}(?:号|楼|栋|单元|室|层))/,
    // 纯数字号楼-单元（如"10号楼一单元"前面无中文前缀）
    /(\d{1,4}号[楼栋][一-鿿\d\-]{0,15}(?:单元|室|层)?)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

// ===== 联系电话提取 =====

function extractPhone(text: string): string | null {
  const patterns = [
    // 标签 + 手机/固话
    /(?:电话|联系电话|手机|联系|客服电话|咨询电话|取件电话|快递员|联系客服|来电|致电)[：:\s]*(\d{3,4}[-–]?\d{7,11})/i,
    /(?:电话|联系电话|手机|联系|客服电话|咨询电话|取件电话|快递员|联系客服|来电|致电)[：:\s]*(1[3-9]\d{9})/i,
    // 纯手机号（上下文有快递/取件关键词）
    /(?:快递|取件|驿站|包裹|自提|丰巢|菜鸟)[^\n]{0,20}?\b(1[3-9]\d{9})\b/,
    /\b(1[3-9]\d{9})\b[^\n]{0,20}?(?:快递|取件|驿站|包裹|自提|丰巢|菜鸟)/,
    // 纯手机号（宽松匹配，但限定在常见号段）
    /\b(1[3-9]\d{9})\b/,
    // 固话格式（含区号）
    /\b(0\d{2,3}[-–]?\d{7,8})\b/,
    // 400/800 热线
    /\b([48]00[-–]?\d{3,4}[-–]?\d{3,4})\b/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim().replace(/[––]/g, '-');
  }
  return null;
}

// ===== 快递单号尾号提取 =====

function extractTailNumber(text: string): string | null {
  const patterns = [
    // "尾号1234" / "尾号: 1234"
    /(?:快递|包裹|运单|单号)?尾号[：:\s]*(\d{3,6})\b/,
    // "手机尾号1234"（收件人手机尾号）
    /手机尾号[：:\s]*(\d{3,6})\b/,
    // "后四位1234"
    /后四位[：:\s]*(\d{4})\b/,
    // "单号尾号1234"
    /单号尾号[：:\s]*(\d{3,6})\b/,
    // "尾数1234"
    /尾数[：:\s]*(\d{3,6})\b/,
    // "****1234" 格式（脱敏后的尾号）
    /\*{2,4}(\d{4})\b/,
    // "运单号后4位"
    /(?:运单|快递|物流)(?:号)?后\d位[：:\s]*(\d{3,6})\b/,
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

// ===== 快递点营业时间提取 =====

function extractBusinessHours(text: string): string | null {
  const patterns = [
    // "营业时间: 08:00-22:00"
    /营业时间[：:\s]*([^\n]{5,30}?)(?:[，,。.\n]|取件|电话|地址|$)/,
    // "工作时间: 08:00-22:00"
    /工作时间[：:\s]*([^\n]{5,30}?)(?:[，,。.\n]|取件|电话|地址|$)/,
    // "营业: 08:00-22:00"
    /营业[：:\s]*([^\n]{5,30}?)(?:[，,。.\n]|取件|电话|地址|$)/,
    // 纯时间范围：08:00-22:00
    /(\d{1,2}:\d{2}\s*[-–—至到~]\s*\d{1,2}:\d{2})/,
    // "早上X点-晚上X点" 中文格式
    /((?:早上|上午|中午|下午|晚上|全天|24小时)\d{0,2}[点时]?\s*[-–—至到~]\s*(?:早上|上午|中午|下午|晚上)?\d{0,2}[点时]?)/,
    // "24小时营业" / "全天营业"
    /(24\s*小时\s*(?:营业|服务|自助)?|全天\s*(?:营业|服务|自助)?)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const hours = m[1].trim().replace(/\s+/g, '');
      if (hours.length >= 3 && hours.length <= 40) return hours;
    }
  }
  return null;
}

// ===== 签收状态 =====

function isPickedUp(text: string): boolean {
  return /已签收|已收货|交易成功|已完成|已取件|已送达|派送成功|已被签收|本人签收|家人签收|物业签收|快递柜签收|驿站签收/.test(text);
}

// ===== 快递单号提取（次要） =====

function extractTrackingNumber(text: string): string | null {
  const cleaned = text
    .replace(/\s+/g, '')
    .replace(/[Oo]/g, '0')
    .replace(/[lI|]/g, '1');

  const patterns = [
    /运单号[：:\s]*([A-Z0-9]{8,30})/i,
    /运单号码[：:\s]*([A-Z0-9]{8,30})/i,
    /快递单号[：:\s]*([A-Z0-9]{8,30})/i,
    /物流单号[：:\s]*([A-Z0-9]{8,30})/i,
    /单号[：:\s]*([A-Z0-9]{8,30})/i,
    /订单编号[：:\s]*(\d{12,25})/i,
    /(?:圆通|中通|申通|韵达|极兔|顺丰|京东|邮政|德邦|百世|菜鸟)[：:\s]*([A-Z]{0,4}\d{8,25})/,
    /\b([A-Z]{2,4}\d{8,25})\b/,
    /\b(\d{12,20})\b/,
  ];
  for (const p of patterns) {
    const m = cleaned.match(p);
    if (m) {
      const tn = m[1].trim().toUpperCase();
      if (/^[A-Z0-9]{8,30}$/.test(tn)) return tn;
    }
  }
  return null;
}

// ===== 快递公司识别 =====

function extractCarrier(text: string, tn: string): { code: CarrierCode; name: string } {
  const names: Array<{ kw: RegExp; code: CarrierCode; name: string }> = [
    { kw: /顺丰速运|顺丰快递|顺丰物流|顺丰|SF[\s]*Express/i, code: 'shunfeng', name: '顺丰速运' },
    { kw: /圆通速递|圆通快递|圆通物流|圆通|YTO/i, code: 'yuantong', name: '圆通速递' },
    { kw: /中通快递|中通物流|中通|ZTO/i, code: 'zhongtong', name: '中通快递' },
    { kw: /申通快递|申通物流|申通|STO/i, code: 'shentong', name: '申通快递' },
    { kw: /韵达快递|韵达物流|韵达|YUNDA/i, code: 'yunda', name: '韵达快递' },
    { kw: /极兔速递|极兔快递|极兔|J&T/i, code: 'jitu', name: '极兔速递' },
    { kw: /京东快递|京东物流|京东|JD/i, code: 'jingdong', name: '京东快递' },
    { kw: /邮政EMS|邮政速递|邮政快递|中国邮政|EMS/i, code: 'ems', name: '邮政EMS' },
    { kw: /德邦快递|德邦物流|德邦/i, code: 'deppon', name: '德邦快递' },
    { kw: /百世快递|百世物流|百世|BEST/i, code: 'baishi', name: '百世快递' },
    { kw: /菜鸟裹裹|菜鸟|丹鸟/i, code: 'cainiao', name: '菜鸟裹裹' },
    { kw: /丰巢/i, code: 'fengchao', name: '丰巢' },
    { kw: /多多买菜/i, code: 'duoduomaicai', name: '多多买菜' },
    { kw: /美团优选/i, code: 'meituanyouxuan', name: '美团优选' },
  ];
  for (const { kw, code, name } of names) {
    if (kw.test(text)) return { code, name };
  }
  return guessCarrierByTrackingNumber(tn);
}

// ===== 其他辅助功能（平台/商品名/日期） =====

const PLATFORM_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /淘宝|天猫|Tmall|taobao/i, name: '淘宝' },
  { pattern: /京东|JD[\s.]*com|joybuy/i, name: '京东' },
  { pattern: /拼多多|pinduoduo/i, name: '拼多多' },
  { pattern: /抖音|douyin/i, name: '抖音' },
  { pattern: /小红书|RED/i, name: '小红书' },
  { pattern: /1688|阿里巴巴/i, name: '1688' },
  { pattern: /闲鱼/i, name: '闲鱼' },
  { pattern: /快手|kuaishou/i, name: '快手' },
  { pattern: /唯品会/i, name: '唯品会' },
  { pattern: /苏宁/i, name: '苏宁' },
  { pattern: /美团/i, name: '美团' },
];

function extractPlatform(text: string): string {
  for (const { pattern, name } of PLATFORM_PATTERNS) {
    if (pattern.test(text)) return name;
  }
  return '';
}

function extractProductName(text: string): string {
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
  const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(l => {
    if (l.length < 3 || l.length > 40) return false;
    if (/^\d{6,}$|取件码|快递单号|运单号|物流|已签收|签收|下单时间|支付|订单|共计|合计|总计/.test(l)) return false;
    return true;
  });
  return lines[0] || '';
}

function extractDate(text: string): string | null {
  const patterns = [
    /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})[日号]?\s*\d{1,2}:\d{2}/,
    /(\d{1,2}[-/月]\d{1,2})[日号]?\s*\d{1,2}:\d{2}/,
    /(\d{1,2}月\d{1,2}[日号])/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim().replace(/[–-]/g, '-');
  }
  return null;
}
