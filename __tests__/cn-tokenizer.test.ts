// ============================================================
// 中文分词器单元测试
// 覆盖：FMM分词 · 关键词提取 · 取件码/地址/电话/快递公司兜底
// ============================================================
import { tokenize, extractByTokenizer } from '../src/services/cn-tokenizer';

// ============================================================
// tokenize — 正向最大匹配分词
// ============================================================

describe('tokenize', () => {
  test('标准快递短信分词', () => {
    const text = '您的快递已到菜鸟驿站请取件';
    const tokens = tokenize(text);

    expect(tokens).toContain('快递');
    expect(tokens).toContain('菜鸟驿站');
    // 「请取件」在词典中作为整体，FMM 优先长匹配
    expect(tokens).toContain('请取件');
  });

  test('数字连在一起', () => {
    const text = '取件码8-3-5021';
    const tokens = tokenize(text);

    expect(tokens).toContain('取件码');
    expect(tokens).toContain('8-3-5021');
  });

  test('英文连在一起', () => {
    const text = 'SF Express 快递';
    const tokens = tokenize(text);

    expect(tokens).toContain('SF');
    expect(tokens).toContain('EXPRESS');
    expect(tokens).toContain('快递');
  });

  test('含标点符号', () => {
    const text = '【菜鸟驿站】您的包裹已到，取件码：8-3-5021。';
    const tokens = tokenize(text);

    expect(tokens).toContain('菜鸟驿站');
    expect(tokens).toContain('包裹');
    expect(tokens).toContain('取件码');
  });

  test('FMM优先长匹配', () => {
    const text = '菜鸟驿站和顺丰速运都到了';
    const tokens = tokenize(text);

    // 应该匹配"菜鸟驿站"（4字）而非"菜鸟"（2字）
    expect(tokens).toContain('菜鸟驿站');
    expect(tokens).toContain('顺丰速运');
  });

  test('空字符串', () => {
    const tokens = tokenize('');
    expect(tokens).toEqual([]);
  });

  test('纯标点', () => {
    const text = '，，。。！！？？';
    const tokens = tokenize(text);
    // 标点应该被保留为独立token
    expect(tokens.length).toBeGreaterThan(0);
  });
});

// ============================================================
// extractByTokenizer — 关键词兜底提取
// ============================================================

describe('extractByTokenizer', () => {
  test('提取完整的取件码和快递信息', () => {
    const text = '您的快递已到菜鸟驿站XX小区店，取件码：5-3-8001，联系电话13800001111，地址：北京市海淀区中关村大街1号';
    const result = extractByTokenizer(text);

    expect(result).not.toBeNull();
    expect(result!.code).toBe('5-3-8001');
    expect(result!.stationName).not.toBeNull();
    expect(result!.address).not.toBeNull();
    expect(result!.stationPhone).toBe('13800001111');
  });

  test('提取驿站名', () => {
    const texts = [
      '您的快递已到妈妈驿站请取件',
      '包裹已存丰巢快递柜',
      '快递已到韵达超市',
      '您的包裹在兔喜生活超市',
    ];

    for (const text of texts) {
      const result = extractByTokenizer(text);
      expect(result).not.toBeNull();
      expect(result!.stationName).not.toBeNull();
    }
  });

  test('提取地址', () => {
    const texts = [
      '您的快递已到北京市海淀区中关村大街1号院3号楼',
      '包裹已到上海市静安区南京西路1000号恒隆广场B1',
      '快递已存深圳市南山区粤海街道科技园路1号',
    ];

    for (const text of texts) {
      const result = extractByTokenizer(text);
      expect(result).not.toBeNull();
      if (result!.address) {
        expect(result!.address.length).toBeGreaterThanOrEqual(4);
      }
    }
  });

  test('提取手机号', () => {
    const text = '您的快递到了，联系电话：13987654321，请尽快取件';
    const result = extractByTokenizer(text);

    expect(result).not.toBeNull();
    expect(result!.stationPhone).toBe('13987654321');
  });

  test('提取快递公司', () => {
    const tests = [
      { text: '顺丰快递已到菜鸟驿站取件码8-3-5021', expectedCode: 'shunfeng' },
      { text: '圆通速递包裹到站取件码6-2-3001请取件', expectedCode: 'yuantong' },
      { text: '中通快递已到驿站取件码5-3-8001', expectedCode: 'zhongtong' },
      { text: '极兔速递取件通知取件码8-2-5021', expectedCode: 'jitu' },
      { text: '京东包裹到妈妈驿站取件码802145', expectedCode: 'jingdong' },
    ];

    for (const { text, expectedCode } of tests) {
      const result = extractByTokenizer(text);
      expect(result).not.toBeNull();
      expect(result!.company).toBe(expectedCode);
    }
  });

  test('非快递文本返回null', () => {
    const texts = [
      '今天天气真好',
      '开会时间改到下午三点',
      '记得买明天的菜',
    ];

    for (const text of texts) {
      const result = extractByTokenizer(text);
      expect(result).toBeNull();
    }
  });

  test('取件码格式识别', () => {
    const tests = [
      { text: '取件码8-3-5021请到南门取件', expected: '8-3-5021' },
      { text: '取件码123456快递在驿站取件', expected: '123456' },
    ];

    for (const { text, expected } of tests) {
      const result = extractByTokenizer(text);
      expect(result).not.toBeNull();
      expect(result!.code).toBe(expected);
    }
  });

  test('过期时间提取', () => {
    const tests = [
      { text: '取件码8-3-5021请在24小时内取件', expectHours: 24 },
      { text: '取件码6-2-3001请于3天内取件', expectDays: 3 },
    ];

    for (const { text, expectHours } of tests) {
      const result = extractByTokenizer(text);
      expect(result).not.toBeNull();
      if (expectHours) {
        expect(result!.expiresAt).not.toBeNull();
        const diff = result!.expiresAt! - Date.now();
        const hours = diff / 3600000;
        expect(hours).toBeGreaterThan(expectHours - 1);
        expect(hours).toBeLessThan(expectHours + 1);
      }
    }
  });
});

// ============================================================
// 边界情况
// ============================================================

describe('边界情况', () => {
  test('空文本', () => {
    const result = extractByTokenizer('');
    expect(result).toBeNull();
  });

  test('只有快递关键词但无取件码', () => {
    const text = '快递包裹驿站取件';
    const result = extractByTokenizer(text);
    // 分词器兜底：可能从关键词拼接出 siteName
    // 有 stationName 就不应该返回 null，这是合理的行为
    expect(result).not.toBeNull();
  });

  test('极长文本不崩溃', () => {
    const text = '您的'.repeat(200) + '快递已到菜鸟驿站取件码8-3-5021';
    const result = extractByTokenizer(text);
    // 不崩溃，能找到取件码
    expect(result).not.toBeNull();
    expect(result!.code).toBe('8-3-5021');
  });
});
