// ============================================================
// 日期/文本格式化工具
// ============================================================
import { format } from 'date-fns';
import type { Package } from '../models';

/** 格式化为完整日期 */
export function formatDate(timestamp: number): string {
  return format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss');
}

/** 格式化快递单号（添加空格分隔，方便阅读） */
export function formatTrackingNumber(tn: string): string {
  if (!tn) return '';
  // SF123456789 → SF 1234 5678 9
  const prefix = tn.match(/^[A-Za-z]+/)?.[0] || '';
  const nums = tn.slice(prefix.length);
  const chunks = nums.match(/.{1,4}/g)?.join(' ') || nums;
  return prefix ? `${prefix} ${chunks}` : chunks;
}

/** 生成唯一ID */
export function generateId(): string {
  // 简单的时间戳+随机数方案，避免依赖 uuid 库
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 半角/全角规范化 */
export function normalizeText(text: string): string {
  return text
    .replace(/：/g, ':')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/，/g, ',')
    .replace(/。/g, '.')
    .replace(/；/g, ';')
    .replace(/！/g, '!')
    .replace(/？/g, '?')
    .replace(/＂/g, '"')
    .replace(/＇/g, "'")
    .replace(/【/g, '[')
    .replace(/】/g, ']')
    .replace(/　/g, ' ')
    .trim();
}

// ============================================================
// 过期状态计算
// ============================================================

/** 获取过期状态 */
export function getExpiryStatus(expiresAt: number): {
  expired: boolean;
  daysLeft: number;
  label: string;
} {
  if (!expiresAt || expiresAt <= 0) return { expired: false, daysLeft: -1, label: '' };
  const now = Date.now();
  const diff = expiresAt - now;
  const daysLeft = Math.ceil(diff / (24 * 60 * 60 * 1000));
  if (diff < 0) return { expired: true, daysLeft, label: '已过期' };
  if (daysLeft === 0) return { expired: false, daysLeft: 0, label: '今日截止' };
  if (daysLeft === 1) return { expired: false, daysLeft: 1, label: '明日截止' };
  return { expired: false, daysLeft, label: `${daysLeft}天后截止` };
}

// ============================================================
// 地址有效性校验
// ============================================================

/** 非地址的关键词（快递公司名、状态描述等） */
const NON_ADDRESS_PATTERNS: RegExp[] = [
  /^(顺丰|圆通|中通|申通|韵达|极兔|百世|京东|德邦|菜鸟|丰巢|EMS|邮政|德邦物流|京东快递|顺丰速运|圆通速递|中通快递|申通快递|韵达快递|极兔速递|百世快递|邮政EMS)$/,
  /^(淘宝|天猫|京东|拼多多|抖音|快手|1688|闲鱼|苏宁|唯品会|美团|小红书|小米商城)$/,
  /^(已发货|已签收|已取件|运输中|派送中|待取件|已揽收|已发出|已到达)$/,
  /^[A-Z]{1,4}\d{6,20}$/,  // 快递单号
  /^\d{1,2}[-\s]\d{1,2}[-\s]\d{4,6}$/,  // 取件码格式
  /^[\d\-\s]{4,20}$/,  // 纯数字/横线
  /^\d{6,10}$/,  // 纯数字短码
];

/** 地址必须包含的关键特征（至少其一） */
const ADDRESS_FEATURE_PATTERNS: RegExp[] = [
  /(?:路|街|道|巷|弄|里|园|苑|坊|庄|屯|营|堡)/,
  /(?:号|栋|幢|楼|层|单元|室)/,
  /(?:小区|社区|新村|花园|公寓|广场|大厦|中心|商城)/,
  /(?:村|镇|乡|县|区|市|省)/,
  /(?:驿站|快递柜|丰巢|菜鸟|妈妈驿站|兔喜|韵达超市|邻里驿站|自提柜|代收点|快递超市)/,
  /(?:店|铺|门头房|门面|底商|商铺)/,
  /(?:学校|学院|大学|医院|商场|超市|市场|银行|邮局)/,
  /(?:座|层|F\d|B\d)/i,
];

/**
 * 校验提取的文本是否为有效地址
 * 返回 true 表示像地址，false 表示可能是快递公司名/单号/状态等噪音
 */
export function isValidAddress(text: string): boolean {
  if (!text || text.length < 4) return false;

  // 拒绝已知非地址模式
  if (NON_ADDRESS_PATTERNS.some(p => p.test(text))) return false;

  // 必须包含中文
  if (!/[一-龥]/.test(text)) return false;

  // 必须包含地址特征
  if (!ADDRESS_FEATURE_PATTERNS.some(p => p.test(text))) return false;

  return true;
}

// ============================================================
// 营业时间解析 + 分享格式化
// ============================================================

/** 从营业时间字符串提取关门时间。如 "08:00-22:00" → "22:00"，24小时 → null */
export function parseBusinessHoursClosing(hours: string | null | undefined): string | null {
  if (!hours) return null;
  if (/24\s*小时|全天|24h/i.test(hours)) return null;
  const m = hours.match(/(\d{1,2}:\d{2})\s*[-–—~到至]\s*(\d{1,2}:\d{2})/);
  if (m) return m[2];
  return null;
}

/** 单包裹分享文本 */
export function formatPackageForShare(pkg: Package): string {
  const lines: string[] = [];
  const name = pkg.pickupPointName || pkg.pickupAddress || '驿站';
  lines.push(`【取件通】${pkg.carrierName}快递已到${name}`);
  if (pkg.pickupCode) lines.push(`取件码：${pkg.pickupCode}`);
  if (pkg.pickupAddress) lines.push(`地址：${pkg.pickupAddress}`);
  if (pkg.pickupPointPhone) lines.push(`电话：${pkg.pickupPointPhone}`);
  if (pkg.businessHours) lines.push(`营业时间：${pkg.businessHours}`);
  return lines.join('\n');
}

/** 批量包裹分享文本 */
export function formatPackagesForShare(pkgs: Package[]): string {
  return `📦 共 ${pkgs.length} 个包裹\n\n` + pkgs.map(formatPackageForShare).join('\n\n---\n\n');
}
