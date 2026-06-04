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
// 快递柜时效倒计时（丰巢等短时效包裹）
// ============================================================

/** 时效状态 */
export interface TimeLimitStatus {
  /** 剩余小时数（负数=已超时） */
  hoursLeft: number;
  /** 剩余分钟数（<1小时时显示） */
  minutesLeft: number;
  /** 是否已超时 */
  expired: boolean;
  /** 显示文案 */
  label: string;
  /** 颜色：green / orange / red / gray */
  color: 'green' | 'orange' | 'red' | 'gray';
  /** 进度条百分比（0-1） */
  progress: number;
}

/**
 * 计算快递柜取件码时效状态
 * 用于丰巢、自提柜等短时效包裹
 * 假设初始时效为24小时（如果没有 expiresAt 则返回 null）
 */
export function getTimeLimitStatus(expiresAt: number, defaultHours = 24): TimeLimitStatus | null {
  if (!expiresAt || expiresAt <= 0) return null;

  const now = Date.now();
  const diffMs = expiresAt - now;
  const totalMs = defaultHours * 60 * 60 * 1000;
  const hoursLeft = diffMs / (60 * 60 * 1000);
  const minutesLeft = diffMs / (60 * 1000);
  const progress = Math.max(0, Math.min(1, 1 - diffMs / totalMs));

  if (hoursLeft < 0) {
    const over = Math.abs(hoursLeft);
    const overLabel = over < 1
      ? `${Math.round(over * 60)}分钟`
      : `${over.toFixed(1)}小时`;
    return {
      hoursLeft,
      minutesLeft,
      expired: true,
      label: `已超时${overLabel}`,
      color: 'red',
      progress: 1,
    };
  }

  if (hoursLeft < 1) {
    return {
      hoursLeft,
      minutesLeft,
      expired: false,
      label: `剩余${Math.round(minutesLeft)}分钟`,
      color: 'red',
      progress,
    };
  }

  if (hoursLeft < 6) {
    return {
      hoursLeft,
      minutesLeft,
      expired: false,
      label: `剩余${Math.floor(hoursLeft)}小时`,
      color: 'orange',
      progress,
    };
  }

  return {
    hoursLeft,
    minutesLeft,
    expired: false,
    label: `剩余${Math.floor(hoursLeft)}小时`,
    color: 'green',
    progress,
  };
}

/** 判断取件点是否为短时效快递柜 */
export function isTimeSensitiveStation(name: string | null | undefined): boolean {
  if (!name) return false;
  return /丰巢|快递柜|自提柜|菜鸟柜|智能柜/.test(name);
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

/** 地址可导航所需的精确度特征（至少有楼号/小区/具体地标级别） */
const NAVIGABLE_ADDRESS_PATTERNS: RegExp[] = [
  // 有具体门牌号
  /(?:\d+号[楼栋幢]|\d+[号栋幢]|\d+单元|\d+室|\d+层|号楼|号院)/,
  // 有小区/大厦/园区等具体地标 + 楼号
  /(?:小区|花园|园|苑|公寓|大厦|广场|社区|新村|校区).{0,10}(?:\d+[号栋幢楼]|\d+单元)/,
  // 有道路 + 门牌号
  /(?:路|街|道|巷|弄|大道|大街).{0,15}\d+[号弄]/,
  // 驿站/快递柜等具体取件点 + 位置描述
  /(?:驿站|快递柜|丰巢|菜鸟|兔喜|妈妈驿站|韵达超市|邻里驿站|自提柜|代收点|快递超市).{0,30}(?:\d+[号栋幢楼]|小区|花园|村)/,
  // 有村庄 + 具体位置
  /(?:村|镇|屯|庄).{0,20}(?:\d+[号栋幢组]|小区|花园|单元)/,
];

/** 地址仅为模糊区域的特征（无法精确导航） */
const VAGUE_ADDRESS_PATTERNS: RegExp[] = [
  // 只有城市/区/街道级别，无具体门牌
  /^[一-龥]{2,10}(?:市|县|区|镇|乡|街道|路|街|道)$/,
  // 只有路名没有门牌号
  /^[一-龥\d]{2,20}(?:路|街|道|巷|弄|大道|大街)$/,
  // "XX附近" / "XX对面" / "XX旁边" 等模糊描述
  /(?:附近|对面|旁边|附近|一带|左右|周边)$/,
];

/**
 * 校验地址是否足够精确以用于导航
 * 返回 true 表示地址含具体门牌/楼号/小区，可导航
 * 返回 false 表示地址过于模糊，无法精确定位
 */
export function isAddressNavigable(address: string | null | undefined): boolean {
  if (!address || address.length < 6) return false;

  // 基础校验
  if (!isValidAddress(address)) return false;

  // 拒绝模糊地址
  if (VAGUE_ADDRESS_PATTERNS.some(p => p.test(address))) return false;

  // 必须有可导航的精确特征
  return NAVIGABLE_ADDRESS_PATTERNS.some(p => p.test(address));
}

/**
 * 地址质量评分（0-100）
 * - 90+: 完整地址，含门牌号/楼号/单元/室，可直接导航
 * - 70-89: 含小区/道路 + 大致位置，导航可达附近
 * - 50-69: 仅有道路名/小区名，需补充
 * - 30-49: 仅有区域/街道名，不可导航
 * - 0-29: 疑似非地址或极度模糊
 */
export function scoreAddressQuality(address: string | null | undefined): number {
  if (!address || address.length < 4) return 0;

  let score = 0;

  // 基础：中文 + 地址特征
  if (!/[一-龥]/.test(address)) return 0;
  if (!ADDRESS_FEATURE_PATTERNS.some(p => p.test(address))) return 0;

  score += 20; // 基础分

  // 长度奖励
  if (address.length >= 10) score += 5;
  if (address.length >= 15) score += 5;

  // 省/市/区/县/镇级地名
  if (/(?:省|市|区|县|镇|乡|街道)/.test(address)) score += 10;

  // 道路级别
  if (/(?:路|街|道|巷|弄|大道|大街)/.test(address)) score += 10;

  // 小区/社区级别
  if (/(?:小区|社区|新村|花园|公寓|园区|苑|坊)/.test(address)) score += 10;

  // 楼号/栋号
  if (/\d+[号栋幢楼]/.test(address)) score += 15;

  // 单元/室/层
  if (/(?:\d+单元|\d+室|\d+层|号楼)/.test(address)) score += 15;

  // 具体地标
  if (/(?:驿站|快递柜|丰巢|菜鸟|兔喜|妈妈驿站|超市|商场|大厦|广场|学校|医院|银行)/.test(address)) score += 10;

  // 减分项：模糊描述
  if (/(?:附近|对面|旁边|一带|左右|周边|不远处)/.test(address)) score -= 20;

  // 减分项：可能是快递公司名或单号
  if (NON_ADDRESS_PATTERNS.some(p => p.test(address))) score -= 50;

  return Math.max(0, Math.min(100, score));
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
