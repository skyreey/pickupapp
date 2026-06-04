/**
 * 八卦编解码工具库 (Bagua Codec)
 *
 * 以易经八卦为编码层，用于激活码混淆、敏感字符串存储、密钥派生
 *
 * 八卦基础：
 *   ☰乾 ☱兑 ☲离 ☳震 ☴巽 ☵坎 ☶艮 ☷坤
 *   先天数: 乾1兑2离3震4巽5坎6艮7坤8
 *   二进制: 乾111 兑110 离101 震100 巽011 坎010 艮001 坤000
 *
 * 64卦：上下两卦组合，可编码6位数据(0-63)
 */

// ── 基础类型 ──────────────────────────────────

export type Trigram = '☰' | '☱' | '☲' | '☳' | '☴' | '☵' | '☶' | '☷';

export interface TrigramInfo {
  symbol: Trigram;
  name: string;
  binary: number;    // 3-bit value 0-7
  xianTian: number;  // 先天八卦数 1-8
  element: string;   // 五行属性
  direction: string; // 后天八卦方位
}

/** 八卦完整信息表 */
export const BAGUA: Record<Trigram, TrigramInfo> = {
  '☰': { symbol: '☰', name: '乾', binary: 7, xianTian: 1, element: '金', direction: '西北' },
  '☱': { symbol: '☱', name: '兑', binary: 6, xianTian: 2, element: '金', direction: '西'   },
  '☲': { symbol: '☲', name: '离', binary: 5, xianTian: 3, element: '火', direction: '南'   },
  '☳': { symbol: '☳', name: '震', binary: 4, xianTian: 4, element: '木', direction: '东'   },
  '☴': { symbol: '☴', name: '巽', binary: 3, xianTian: 5, element: '木', direction: '东南' },
  '☵': { symbol: '☵', name: '坎', binary: 2, xianTian: 6, element: '水', direction: '北'   },
  '☶': { symbol: '☶', name: '艮', binary: 1, xianTian: 7, element: '土', direction: '东北' },
  '☷': { symbol: '☷', name: '坤', binary: 0, xianTian: 8, element: '土', direction: '西南' },
};

/** 3位值 → 八卦符号 */
const VALUE_TO_TRIGRAM: Trigram[] = ['☷', '☶', '☵', '☴', '☳', '☲', '☱', '☰'];

// ── 64卦映射表 ──────────────────────────────

/**
 * 64卦编码表
 * 上卦(行) + 下卦(列) = 64卦
 * 每卦编码6位(0-63)，覆盖Base64字符集
 */
export const HEXAGRAM_TABLE: Record<string, number> = {
  // 上卦☰乾 (000-007)
  '乾为天': 0x00, '泽天夬': 0x01, '火天大有': 0x02, '雷天大壮': 0x03,
  '风天小畜': 0x04, '水天需':   0x05, '山天大畜': 0x06, '地天泰':   0x07,
  // 上卦☱兑 (008-00F)
  '天泽履': 0x08, '兑为泽': 0x09, '火泽睽':   0x0A, '雷泽归妹': 0x0B,
  '风泽中孚': 0x0C, '水泽节': 0x0D, '山泽损':   0x0E, '地泽临':   0x0F,
  // 上卦☲离 (010-017)
  '天火同人': 0x10, '泽火革': 0x11, '离为火':   0x12, '雷火丰':   0x13,
  '风火家人': 0x14, '水火既济': 0x15, '山火贲':   0x16, '地火明夷': 0x17,
  // 上卦☳震 (018-01F)
  '天雷无妄': 0x18, '泽雷随': 0x19, '火雷噬嗑': 0x1A, '震为雷':   0x1B,
  '风雷益':   0x1C, '水雷屯': 0x1D, '山雷颐':   0x1E, '地雷复':   0x1F,
  // 上卦☴巽 (020-027)
  '天风姤':   0x20, '泽风大过': 0x21, '火风鼎':   0x22, '雷风恒':   0x23,
  '巽为风':   0x24, '水风井': 0x25, '山风蛊':   0x26, '地风升':   0x27,
  // 上卦☵坎 (028-02F)
  '天水讼':   0x28, '泽水困': 0x29, '火水未济': 0x2A, '雷水解':   0x2B,
  '风水涣':   0x2C, '坎为水': 0x2D, '山水蒙':   0x2E, '地水师':   0x2F,
  // 上卦☶艮 (030-037)
  '天山遁':   0x30, '泽山咸': 0x31, '火山旅':   0x32, '雷山小过': 0x33,
  '风山渐':   0x34, '水山蹇': 0x35, '艮为山':   0x36, '地山谦':   0x37,
  // 上卦☷坤 (038-03F)
  '天地否':   0x38, '泽地萃': 0x39, '火地晋':   0x3A, '雷地豫':   0x3B,
  '风地观':   0x3C, '水地比': 0x3D, '山地剥':   0x3E, '坤为地':   0x3F,
};

/** 值(0-63) → 64卦名（逆向查表） */
const VALUE_TO_HEXAGRAM: string[] = new Array(64);
for (const [name, val] of Object.entries(HEXAGRAM_TABLE)) {
  VALUE_TO_HEXAGRAM[val] = name;
}

// ── 五行体系 ──────────────────────────────────

export const WU_XING = ['木', '火', '土', '金', '水'] as const;
export type WuXingElement = typeof WU_XING[number];

/** 五行相生：木→火→土→金→水→木 */
const WU_XING_SHENG: Record<WuXingElement, WuXingElement> = {
  '木': '火', '火': '土', '土': '金', '金': '水', '水': '木',
};

/** 五行相克：木→土→水→火→金→木 */
const WU_XING_KE: Record<WuXingElement, WuXingElement> = {
  '木': '土', '土': '水', '水': '火', '火': '金', '金': '木',
};

/** 八卦 → 五行 */
const TRIGRAM_WU_XING: Record<string, WuXingElement> = {
  '乾': '金', '兑': '金', '离': '火', '震': '木',
  '巽': '木', '坎': '水', '艮': '土', '坤': '土',
};

/** 五行偏移常量（用于密钥派生） */
const WU_XING_OFFSETS = [17, 31, 53, 79, 97]; // 素数偏移

// ── 核心编码函数 ──────────────────────────────

/**
 * 将字节数组编码为64卦名数组
 * 每1字节(8位) → 2个卦名(各6位)，浪费4位/字节，但混淆效果好
 *
 * @param bytes 原始字节数组
 * @returns 卦象名称数组，用'·'连接即为激活码
 *
 * @example
 * encodeBytesToGua(new Uint8Array([0x1A, 0x3F]))
 * // → ['火雷噬嗑', '坤为地']
 */
export function encodeBytesToGua(bytes: Uint8Array): string[] {
  const result: string[] = [];
  for (const byte of bytes) {
    // 取高6位(0-63) → 上卦
    const upper = (byte >> 2) & 0x3F;
    // 取低2位 + 下一字节的4位 → 下卦
    // 简化方案：1字节拆分高6位+低2位(补0到6位)
    const lower = byte & 0x3F; // 直接取低6位

    result.push(VALUE_TO_HEXAGRAM[upper]);
    result.push(VALUE_TO_HEXAGRAM[lower]);
  }
  return result;
}

/**
 * 将64卦名数组解码为字节数组
 *
 * @param guaNames 卦象名称数组
 * @returns 解码后的字节数组，解码失败返回null
 */
export function decodeGuaToBytes(guaNames: string[]): Uint8Array | null {
  if (guaNames.length % 2 !== 0) return null; // 必须成对

  const bytes = new Uint8Array(guaNames.length / 2);
  for (let i = 0; i < guaNames.length; i += 2) {
    const upperVal = HEXAGRAM_TABLE[guaNames[i]];
    const lowerVal = HEXAGRAM_TABLE[guaNames[i + 1]];
    if (upperVal === undefined || lowerVal === undefined) return null;

    // 高6位 + 低6位 → 取高6位和低2位组合
    bytes[i / 2] = ((upperVal & 0x3F) << 2) | ((lowerVal & 0x30) >> 4);
  }
  return bytes;
}

/**
 * 紧凑编码：3字节 → 4个64卦名
 * 每6位一个卦，3字节=24位=4卦
 *
 * @param bytes 字节数组（长度需为3的倍数）
 * @returns 卦象名称数组
 */
export function encodeCompact(bytes: Uint8Array): string[] {
  if (bytes.length % 3 !== 0) {
    // 填充到3的倍数
    const padded = new Uint8Array(Math.ceil(bytes.length / 3) * 3);
    padded.set(bytes);
    bytes = padded;
  }

  const result: string[] = [];
  for (let i = 0; i < bytes.length; i += 3) {
    // 24位 → 4个6位值
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    result.push(VALUE_TO_HEXAGRAM[(chunk >> 18) & 0x3F]);
    result.push(VALUE_TO_HEXAGRAM[(chunk >> 12) & 0x3F]);
    result.push(VALUE_TO_HEXAGRAM[(chunk >> 6) & 0x3F]);
    result.push(VALUE_TO_HEXAGRAM[chunk & 0x3F]);
  }
  return result;
}

/**
 * 紧凑解码：4个64卦名 → 3字节
 */
export function decodeCompact(guaNames: string[]): Uint8Array | null {
  if (guaNames.length % 4 !== 0) return null;

  const bytes = new Uint8Array((guaNames.length / 4) * 3);
  for (let i = 0; i < guaNames.length; i += 4) {
    const vals = guaNames.slice(i, i + 4).map(n => HEXAGRAM_TABLE[n]);
    if (vals.some(v => v === undefined)) return null;

    const chunk = (vals[0] << 18) | (vals[1] << 12) | (vals[2] << 6) | vals[3];
    bytes[(i / 4) * 3]     = (chunk >> 16) & 0xFF;
    bytes[(i / 4) * 3 + 1] = (chunk >> 8) & 0xFF;
    bytes[(i / 4) * 3 + 2] = chunk & 0xFF;
  }
  return bytes;
}

// ── 八卦密钥派生 ──────────────────────────────

/**
 * 使用八卦原理派生子密钥
 *
 * 算法：将种子字符串转为八卦序列 → 用先天数、后天方位、五行生克混合运算
 *
 * @param seed 种子字符串（如激活码的一部分）
 * @param length 输出密钥长度（字节）
 * @returns 派生密钥
 */
export function deriveBaguaKey(seed: string, length: number = 32): Uint8Array {
  // 第一步：seed → SHA256样式的简单哈希（客户端环境）
  const seedHash = simpleHash(seed);

  // 第二步：哈希字节 → 八卦序列
  const trigrams: TrigramInfo[] = [];
  for (let i = 0; i < seedHash.length; i++) {
    trigrams.push(BAGUA[VALUE_TO_TRIGRAM[seedHash[i] & 0x7]]);
  }

  // 第三步：八卦属性混合运算生成密钥
  const key = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    const gua = trigrams[i % trigrams.length];
    const wuXingIdx = WU_XING.indexOf(gua.element as WuXingElement);

    // 混合公式：先天数 × 31 + 后天方位角 + 五行素数偏移 + 索引扰动
    let val = (gua.xianTian * 31 +
               getDirectionAngle(gua.direction) * 17 +
               WU_XING_OFFSETS[wuXingIdx] +
               i * 7) & 0xFF;

    // 额外混淆：与下一个卦的二进制值异或
    const nextGua = trigrams[(i + 1) % trigrams.length];
    val ^= (nextGua.binary << 5);

    key[i] = val & 0xFF;
  }

  return key;
}

/** 方位 → 角度（用于密钥派生） */
function getDirectionAngle(direction: string): number {
  const angles: Record<string, number> = {
    '北': 0, '东北': 45, '东': 90, '东南': 135,
    '南': 180, '西南': 225, '西': 270, '西北': 315,
  };
  return angles[direction] || 0;
}

/** 简单哈希（客户端无crypto模块时使用） */
function simpleHash(input: string): Uint8Array {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h1 = (h1 << 13) | (h1 >>> 19);
    h2 = (h2 << 17) | (h2 >>> 15);
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 16; i++) {
    out[i] = (h1 >>> (i % 4) * 8) & 0xFF;
    out[i + 16] = (h2 >>> (i % 4) * 8) & 0xFF;
  }
  return out;
}

// ── 五行校验 ──────────────────────────────────

/**
 * 验证卦象序列的五行相生关系
 * 用于激活码完整性校验（非密码学，仅作为附加混淆层）
 *
 * @param guaNames 卦象名称序列
 * @returns 是否满足五行相生链
 */
export function validateWuXingChain(guaNames: string[]): boolean {
  if (guaNames.length < 2) return true;

  for (let i = 0; i < guaNames.length - 1; i++) {
    const currentElement = TRIGRAM_WU_XING[guaNames[i].charAt(0)]; // 取卦名首字定五行
    const nextElement = TRIGRAM_WU_XING[guaNames[i + 1].charAt(0)];
    if (!currentElement || !nextElement) return false;

    // 检查是否相生：当前生下一个
    if (WU_XING_SHENG[currentElement] !== nextElement &&
        WU_XING_SHENG[nextElement] !== currentElement) {
      // 不相生也不被生 → 五行链断裂
      return false;
    }
  }
  return true;
}

/**
 * 从卦象序列计算五行校验字节
 * 用于激活码中嵌入校验值
 */
export function computeWuXingChecksum(guaNames: string[]): number {
  let sum = 0;
  for (const gua of guaNames) {
    const element = TRIGRAM_WU_XING[gua.charAt(0)];
    if (element) {
      sum = (sum + WU_XING.indexOf(element) * 53 + 17) & 0xFF;
    }
  }
  return sum;
}

// ── 敏感字符串八卦混淆存储 ────────────────────

/**
 * 将明文字符串编码为卦名数组（用于存储敏感字符串，避免明文字符串搜索）
 *
 * @param plaintext 原始字符串
 * @returns 卦名数组，运行时调用 decodeGuaString 还原
 *
 * @example
 * const encoded = encodeString('https://api.example.com');
 * // → ['水天需', '火泽睽', ...]
 *
 * // 使用处：
 * const url = decodeGuaString(encoded);
 */
export function encodeString(plaintext: string): string[] {
  const bytes = new TextEncoder().encode(plaintext);
  return encodeCompact(bytes);
}

/**
 * 将卦名数组还原为明文字符串
 */
export function decodeGuaString(guaNames: string[]): string | null {
  const bytes = decodeCompact(guaNames);
  if (!bytes) return null;
  return new TextDecoder().decode(bytes);
}

// ── 激活码格式化 ──────────────────────────────

/**
 * 将卦名数组格式化为可展示的激活码
 *
 * @param guaNames 卦象名称数组
 * @param separator 分隔符（默认'·'）
 * @returns 格式化的激活码字符串
 *
 * @example
 * formatActivationCode(['乾为天', '水雷屯', '火泽睽'])
 * // → '乾为天·水雷屯·火泽睽'
 */
export function formatActivationCode(guaNames: string[], separator = '·'): string {
  return guaNames.join(separator);
}

/**
 * 解析激活码字符串为卦名数组
 *
 * @param code 激活码字符串（如'乾为天·水雷屯·火泽睽'）
 * @returns 卦名数组，格式错误返回null
 */
export function parseActivationCode(code: string): string[] | null {
  const parts = code.split(/[·\s,，、]+/).filter(Boolean);
  // 验证每个部分都是合法卦名
  for (const part of parts) {
    if (HEXAGRAM_TABLE[part] === undefined) return null;
  }
  return parts;
}

// ── 便捷工具 ──────────────────────────────────

/** 打印64卦编码表（调试用） */
export function printHexagramTable(): string {
  const rows: string[] = [];
  for (const [name, val] of Object.entries(HEXAGRAM_TABLE)) {
    rows.push(`${name.padEnd(4, '　')} = 0x${val.toString(16).toUpperCase().padStart(2, '0')}`);
  }
  return rows.join('\n');
}

/** 获取随机卦名（测试用） */
export function randomGua(): string {
  return VALUE_TO_HEXAGRAM[Math.floor(Math.random() * 64)];
}
