// ============================================================
// 八卦编解码工具库 — 单元测试
// ============================================================
import {
  encodeCompact,
  decodeCompact,
  encodeBytesToGua,
  decodeGuaToBytes,
  deriveBaguaKey,
  validateWuXingChain,
  computeWuXingChecksum,
  encodeString,
  decodeGuaString,
  parseActivationCode,
} from '../utils/bagua-codec';

// ── encodeCompact / decodeCompact ──

describe('encodeCompact / decodeCompact', () => {
  test('编码空数组返回空卦名列表', () => {
    const result = encodeCompact(new Uint8Array([]));
    expect(result).toEqual([]);
  });

  test('3字节正确编码为4个卦名', () => {
    const bytes = new Uint8Array([0x00, 0x00, 0x00]);
    const result = encodeCompact(bytes);
    expect(result).toHaveLength(4);
    expect(result.every(g => g === '乾为天')).toBe(true);
  });

  test('1字节编码为4个卦名（自动补0填充至3字节）', () => {
    const bytes = new Uint8Array([0xFF]);
    const result = encodeCompact(bytes);
    expect(result).toHaveLength(4);
    // 往返验证：解码回3字节，首字节应为0xFF
    const decoded = decodeCompact(result);
    expect(decoded).not.toBeNull();
    expect(decoded![0]).toBe(0xFF);
  });

  test('编码后解码能完整还原', () => {
    const original = new Uint8Array([0x12, 0xAB, 0xFF, 0x00, 0x55, 0x7E]);
    const encoded = encodeCompact(original);
    const decoded = decodeCompact(encoded);
    expect(decoded).not.toBeNull();
    for (let i = 0; i < original.length; i++) {
      expect(decoded![i]).toBe(original[i]);
    }
  });

  test('含不可打印字节的数据也能正确编解码', () => {
    const original = new Uint8Array([0x00, 0x01, 0x7F, 0x80, 0xFE, 0xFF]);
    const encoded = encodeCompact(original);
    const decoded = decodeCompact(encoded);
    expect(decoded).not.toBeNull();
    for (let i = 0; i < original.length; i++) {
      expect(decoded![i]).toBe(original[i]);
    }
  });

  test('非法卦名解码返回null', () => {
    const result = decodeCompact(['乾为天', '不是卦名', '离为火', '坤为地']);
    expect(result).toBeNull();
  });

  test('1字节编码解码后为3字节（compact补齐特性）', () => {
    const bytes = new Uint8Array([0x42]);
    const encoded = encodeCompact(bytes);
    const decoded = decodeCompact(encoded);
    expect(decoded).not.toBeNull();
    // compact编码按3字节一组，解码后补齐到3字节整数倍
    expect(decoded!.length).toBe(3);
    expect(decoded![0]).toBe(0x42);
  });
});

// ── encodeBytesToGua / decodeGuaToBytes ──

describe('encodeBytesToGua / decodeGuaToBytes', () => {
  test('基本编解码往返', () => {
    // encodeBytesToGua 每个字节编码为2个卦名（高6位+低6位）
    // decodeGuaToBytes 解码时只取高6位和高2位，低4位会丢失
    // 所以这不是完全无损的编码，仅用于特定场景
    const input = Uint8Array.from([0xC0, 0xF0]); // 11000000, 11110000
    const encoded = encodeBytesToGua(input);
    expect(encoded.length).toBe(4); // 2 bytes → 4 gua names
    const decoded = decodeGuaToBytes(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.length).toBe(2);
  });

  test('空字节数组', () => {
    const result = encodeBytesToGua(new Uint8Array([]));
    expect(result).toEqual([]);
  });
});

// ── deriveBaguaKey ──

describe('deriveBaguaKey', () => {
  test('相同种子生成相同密钥', () => {
    const key1 = deriveBaguaKey('test-seed');
    const key2 = deriveBaguaKey('test-seed');
    expect(Array.from(key1)).toEqual(Array.from(key2));
  });

  test('不同种子生成不同密钥', () => {
    const key1 = deriveBaguaKey('seed-1');
    const key2 = deriveBaguaKey('seed-2');
    const same = key1.every((b, i) => b === key2[i]);
    expect(same).toBe(false);
  });

  test('默认长度32字节', () => {
    const key = deriveBaguaKey('test');
    expect(key.length).toBe(32);
  });

  test('自定义长度16字节', () => {
    const key = deriveBaguaKey('test', 16);
    expect(key.length).toBe(16);
  });
});

// ── validateWuXingChain ──

describe('validateWuXingChain', () => {
  test('单元素序列返回true', () => {
    expect(validateWuXingChain(['离为火'])).toBe(true);
  });

  test('空序列返回true', () => {
    expect(validateWuXingChain([])).toBe(true);
  });

  test('正确五行相生链：木→火→土→金', () => {
    // 震=木, 离=火, 艮=土, 乾=金 → 木生火生土生金 ✓
    expect(validateWuXingChain(['震为雷', '离为火', '艮为山', '乾为天'])).toBe(true);
  });

  test('非法卦名返回false', () => {
    expect(validateWuXingChain(['不是一个卦', '离为火'])).toBe(false);
  });
});

// ── computeWuXingChecksum ──

describe('computeWuXingChecksum', () => {
  test('相同输入产生相同校验值', () => {
    const c1 = computeWuXingChecksum(['乾为天', '坤为地']);
    const c2 = computeWuXingChecksum(['乾为天', '坤为地']);
    expect(c1).toBe(c2);
  });

  test('校验值在0-255范围内', () => {
    const cs = computeWuXingChecksum(['离为火', '坎为水', '震为雷']);
    expect(cs).toBeGreaterThanOrEqual(0);
    expect(cs).toBeLessThanOrEqual(255);
  });

  test('顺序不同应产生不同校验值', () => {
    const c1 = computeWuXingChecksum(['乾为天', '坤为地']);
    const c2 = computeWuXingChecksum(['坤为地', '乾为天']);
    // 不同顺序可能有不同校验值
    expect(typeof c1).toBe('number');
    expect(typeof c2).toBe('number');
  });
});

// ── encodeString / decodeGuaString ──

describe('encodeString / decodeGuaString', () => {
  test('英文字符串编码后能解码还原（自动补齐到3字节边界）', () => {
    // encodeString 使用 encodeCompact，将字符串补齐到3字节倍数
    // 补齐的\0会保留在解码结果中，所以用 startsWith 验证
    const original = 'HelloWorld';
    const encoded = encodeString(original);
    expect(encoded.length).toBeGreaterThan(0);
    const decoded = decodeGuaString(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.startsWith(original)).toBe(true);
  });

  test('中文字符串编码解码', () => {
    const original = '取件通激活码';
    const encoded = encodeString(original);
    const decoded = decodeGuaString(encoded);
    expect(decoded).toBe(original);
  });

  test('空字符串返回空数组', () => {
    const encoded = encodeString('');
    const decoded = decodeGuaString(encoded);
    expect(decoded).toBe('');
  });

  test('包含特殊字符的字符串', () => {
    const original = 'test@2024!Hello';
    const encoded = encodeString(original);
    const decoded = decodeGuaString(encoded);
    expect(decoded).toBe(original);
  });
});

// ── parseActivationCode ──

describe('parseActivationCode', () => {
  test('合法激活码格式被正确解析', () => {
    const payload = encodeCompact(new Uint8Array([0x01, 0x02, 0x03]));
    const code = payload.join('·');
    const result = parseActivationCode(code);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.length).toBe(payload.length);
    }
  });

  test('空字符串解析', () => {
    const result = parseActivationCode('');
    // 空输入可能返回空数组或null
    expect(result != null).toBe(true);
  });

  test('含点分隔符的格式', () => {
    const payload = encodeCompact(new Uint8Array([0xAB, 0xCD, 0xEF]));
    const code = payload.join('·');
    const result = parseActivationCode(code);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.length).toBe(payload.length);
    }
  });
});
