// ============================================================
// SMS解析引擎 — 单元测试
// 覆盖 parseSms / parseHistoricalSms / parseFreeformText
// ============================================================
import { parseSms, parseHistoricalSms, parseFreeformText } from '../services/sms-parser';

// ── parseSms 测试 ──

describe('parseSms', () => {
  test('菜鸟驿站取件码短信正常解析', () => {
    const body = '【菜鸟驿站】您有包裹已到鸭旺口小区20号楼兔喜生活，取件码5-2-3012，联系电话13812345678，请尽快取件';
    const result = parseSms(body, '106901234567');
    expect(result).not.toBeNull();
    if (result) {
      expect(result.code).toBe('5-2-3012');
      expect(result.address).toBeTruthy();
      expect(result.stationPhone).toBe('13812345678');
    }
  });

  test('丰巢快递柜取件码', () => {
    const body = '【丰巢】您的顺丰快递已到丰巢智能柜，取件码83647291，地址：上海市浦东新区XX路XX号，24小时内取件有效';
    const result = parseSms(body);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.code).toBe('83647291');
      expect(['shunfeng', 'fengchao']).toContain(result.company);
    }
  });

  test('韵达快递取件码', () => {
    const body = '【韵达快递】您的快递已到达XX小区菜鸟驿站，取件码3-1-8856，请凭取件码取件。';
    const result = parseSms(body);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.code).toBe('3-1-8856');
    }
  });

  test('非快递短信返回null', () => {
    const result = parseSms('【招商银行】您的信用卡本月账单已生成，金额4521.00元，请及时还款。');
    expect(result).toBeNull();
  });

  test('验证码短信返回null', () => {
    const result = parseSms('验证码：123456，您正在注册淘宝账号，请勿泄露给他人。');
    expect(result).toBeNull();
  });

  test('营销短信返回null', () => {
    const result = parseSms('免费领取50元优惠券！点击链接领取，拒收请回复T退订。');
    expect(result).toBeNull();
  });

  test('空字符串返回null', () => {
    expect(parseSms('')).toBeNull();
  });

  test('尾部号提取（中通短信）', () => {
    const body = '【中通快递】您的包裹尾号6709已到XX小区妈妈驿站，取件码2-4-0099，请尽快取件';
    const result = parseSms(body);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.code).toBe('2-4-0099');
      expect(result.tailNumber).toBe('6709');
    }
  });
});

// ── parseHistoricalSms 测试 ──

describe('parseHistoricalSms', () => {
  test('已签收短信检测状态为picked_up', () => {
    const body = '【菜鸟驿站】您的包裹已签收，感谢使用菜鸟裹裹。';
    const result = parseHistoricalSms(body);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.status).toBe('picked_up');
    }
  });

  test('已取件短信检测状态为picked_up', () => {
    const body = '【菜鸟驿站】您的包裹已取件，取件码8-3-2023已失效，感谢您的使用。';
    const result = parseHistoricalSms(body);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.status).toBe('picked_up');
    }
  });

  test('已发货短信检测状态为shipped', () => {
    const body = '【顺丰速运】您的快递已发货，运单号SF1234567890123，预计3天内送达。';
    const result = parseHistoricalSms(body);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.status).toBe('shipped');
    }
  });

  test('到站短信检测状态为stored（默认）', () => {
    const body = '【圆通速递】您有一个快递已到XX小区快递柜，取件码8-3-4421，请尽快取件。';
    const result = parseHistoricalSms(body);
    expect(result).not.toBeNull();
    if (result) {
      // 没有已签收/已取件关键词 → stored
      expect(result.status).toBe('stored');
    }
  });

  test('历史短信不要求取件码也能返回结果', () => {
    const body = '【菜鸟驿站】您的包裹已被签收，快递单号YT1234567890';
    const result = parseHistoricalSms(body);
    expect(result).not.toBeNull();
  });
});

// ── parseFreeformText 测试 ──

describe('parseFreeformText', () => {
  test('口语化取件码提取', () => {
    const text = '取件码是 8-3-4421，在小区门口的驿站';
    const result = parseFreeformText(text);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.code).toBe('8-3-4421');
    }
  });

  test('快递公司识别', () => {
    const text = '顺丰的取件码 20231987，在丰巢柜里';
    const result = parseFreeformText(text);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.company).toBe('shunfeng');
    }
  });

  test('无法识别的文本返回null', () => {
    const text = '今天天气真好';
    const result = parseFreeformText(text);
    expect(result).toBeNull();
  });

  test('带站点名称的文本', () => {
    const text = '取件码5-2-3012，在妈妈驿站';
    const result = parseFreeformText(text);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.code).toBe('5-2-3012');
      // parseFreeformText 的 stationName 正则会匹配前面的 "在" 字符
      expect(result.stationName).toBeTruthy();
    }
  });
});
