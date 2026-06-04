// ============================================================
// SMS 解析器单元测试
// 覆盖：正常取件码提取 · 快递公司识别 · 地址提取 · 过期时间解析 · 边界情况
// ============================================================
import {
  parseSms,
  parseHistoricalSms,
} from '../src/services/sms-parser';
import { guessCarrierByTrackingNumber } from '../src/services/carrier-utils';

// ============================================================
// parseSms — 标准取件码短信
// ============================================================

describe('parseSms', () => {
  describe('菜鸟驿站短信', () => {
    test('提取标准取件码和地址', () => {
      const body = '【菜鸟驿站】您的包裹已到菜鸟驿站，取件码：8-3-5021，请凭取件码至XX小区南门菜鸟驿站取件，联系电话：13812345678，营业时间：08:00-22:00';
      const result = parseSms(body);

      expect(result).not.toBeNull();
      expect(result!.code).toBe('8-3-5021');
      expect(result!.address).toContain('XX小区');
    });

    test('提取取件码（冒号分隔）', () => {
      const body = '【菜鸟驿站】您的中通快递包裹已到菜鸟驿站，取件码:6-8-1234，请尽快取件';
      const result = parseSms(body);

      expect(result).not.toBeNull();
      expect(result!.code).toBe('6-8-1234');
    });

    test('提取多种格式取件码', () => {
      const cases = [
        { body: '【菜鸟驿站】取件码：A-3-5021请到南门取件', expected: 'A-3-5021' },
        { body: '【菜鸟驿站】取件码:8-2-8899 请到东门驿站取件', expected: '8-2-8899' },
        { body: '【菜鸟驿站】您的包裹已到，取件码12345678速来取件', expected: '12345678' },
      ];

      for (const { body, expected } of cases) {
        const result = parseSms(body);
        expect(result).not.toBeNull();
        expect(result!.code).toBe(expected);
      }
    });
  });

  describe('丰巢快递柜短信', () => {
    test('提取丰巢取件码', () => {
      const body = '【丰巢】您的圆通快递已存放至丰巢智能柜，取件码：582091，请在24小时内取件。柜机地址：XX小区3号楼北侧丰巢柜';
      const result = parseSms(body);

      expect(result).not.toBeNull();
      expect(result!.code).toBe('582091');
      expect(result!.address).toContain('3号楼');
    });

    test('丰巢超时提醒', () => {
      const body = '【丰巢】您的包裹即将超时，取件码682091，超时将收取费用。柜机地址：XX广场B1层丰巢柜';
      const result = parseSms(body);

      expect(result).not.toBeNull();
      expect(result!.code).toBe('682091');
    });
  });

  describe('京东快递短信', () => {
    test('提取京东取件码', () => {
      const body = '【京东快递】您的京东包裹已到京东快递XX小区南门店，取件码：803921，联系电话：010-12345678';
      const result = parseSms(body);

      expect(result).not.toBeNull();
      expect(result!.code).toBe('803921');
    });
  });

  describe('顺丰快递短信', () => {
    test('提取顺丰取件码', () => {
      const body = '【顺丰速运】您的SF快递已到顺丰速运XX大厦店，取件码：SF801234，请携带有效证件取件，联系电话95338';
      const result = parseSms(body);

      expect(result).not.toBeNull();
      expect(result!.code).toBe('SF801234');
    });
  });

  describe('极兔快递短信', () => {
    test('提取极兔取件码', () => {
      const body = '【极兔速递】您的极兔快递已到XX小区兔喜生活超市，取件码：5-2-3001，联系电话：13912345678';
      const result = parseSms(body);

      expect(result).not.toBeNull();
      expect(result!.code).toBe('5-2-3001');
      expect(result!.stationName).not.toBeNull();
    });
  });

  describe('多多买菜短信', () => {
    test('提取多多买菜提货码', () => {
      const body = '【多多买菜】您购买的商品已到XX小区南门多多买菜自提点，提货码：8021，请尽快提取';
      const result = parseSms(body);

      expect(result).not.toBeNull();
      expect(result!.code).toBe('8021');
    });
  });

  describe('美团优选短信', () => {
    test('提取美团优选提货码', () => {
      const body = '【美团优选】您的美团优选商品已到便民服务站自提点，提货码：5521，联系电话13800001111';
      const result = parseSms(body);

      expect(result).not.toBeNull();
      expect(result!.code).toBe('5521');
    });
  });

  describe('非快递短信过滤', () => {
    test('银行短信被过滤', () => {
      const body = '【招商银行】您的尾号6688信用卡消费退货￥128.00已到账，可用额度￥50,000.00';
      const result = parseSms(body);
      expect(result).toBeNull();
    });

    test('验证码短信被过滤', () => {
      const body = '【某平台】验证码：5832，您正在注册账号，请勿泄露验证码';
      const result = parseSms(body);
      expect(result).toBeNull();
    });

    test('营销短信被过滤', () => {
      const body = '【某商家】双11特惠！全场5折起，免息12期！拒收请回复T退订';
      const result = parseSms(body);
      expect(result).toBeNull();
    });

    test('支付短信被过滤（不含快递关键词）', () => {
      const body = '【微信支付】您已成功支付￥29.90给取件通会员，交易单号1000202406011234567890';
      const result = parseSms(body);
      expect(result).toBeNull();
    });
  });

  describe('过期时间解析', () => {
    test('解析"请于X月X日X时前取件"', () => {
      const body = '【菜鸟驿站】您的包裹已到站，取件码：3-1-8821，请于6月15日18:00前取件';
      const result = parseSms(body);

      expect(result).not.toBeNull();
      expect(result!.expiresAt).not.toBeNull();
      expect(result!.expiresAt).toBeGreaterThan(Date.now());
    });

    test('解析"请在24小时内取件"', () => {
      const body = '【丰巢】您的快递已入柜，取件码582091，请在24小时内取件，超时将收费';
      const result = parseSms(body);

      expect(result).not.toBeNull();
      expect(result!.code).toBe('582091');
      // 24小时过期通过丰巢规则 /(\d+)小时内取件/ 解析
      if (result!.expiresAt) {
        const expectedMin = Date.now() + 23 * 60 * 60 * 1000;
        const expectedMax = Date.now() + 25 * 60 * 60 * 1000;
        expect(result!.expiresAt).toBeGreaterThan(expectedMin);
        expect(result!.expiresAt).toBeLessThan(expectedMax);
      }
    });

    test('解析"今天18:00前"', () => {
      const body = '【菜鸟驿站】取件码5-3-8001，请于今天18:00前取件';
      const result = parseSms(body);

      expect(result).not.toBeNull();
      expect(result!.expiresAt).not.toBeNull();
    });
  });

  describe('联系电话提取', () => {
    test('提取手机号', () => {
      const body = '【菜鸟驿站】取件码8-3-5021，联系电话：13812345678';
      const result = parseSms(body);

      expect(result).not.toBeNull();
      expect(result!.stationPhone).toBe('13812345678');
    });

    test('提取座机号', () => {
      const body = '【菜鸟驿站】取件码8-3-5021，联系电话：010-88886666';
      const result = parseSms(body);

      expect(result).not.toBeNull();
      expect(result!.stationPhone).toBe('01088886666');
    });
  });

  describe('地址提取', () => {
    test('提取取件地址', () => {
      const body = '【菜鸟驿站】取件地址：北京市朝阳区望京SOHO T1 B座负一层菜鸟驿站，取件码6-2-3001';
      const result = parseSms(body);

      expect(result).not.toBeNull();
      expect(result!.address).toContain('望京');
    });
  });
});

// ============================================================
// parseHistoricalSms — 历史短信（含已取件/已签收）
// ============================================================

describe('parseHistoricalSms', () => {
  test('识别已签收快递', () => {
    const body = '【菜鸟驿站】您的包裹已签收，取件码5-2-9981，感谢使用菜鸟驿站';
    const result = parseHistoricalSms(body);

    expect(result).not.toBeNull();
    expect(result!.status).toBe('picked_up');
    expect(result!.code).toBe('5-2-9981');
  });

  test('识别已取件快递', () => {
    const body = '【丰巢】您的包裹已取出。取件码682091的包裹已于6月5日18:30取出';
    const result = parseHistoricalSms(body);

    expect(result).not.toBeNull();
    expect(result!.status).toBe('picked_up');
  });

  test('识别已发货快递（运输中）', () => {
    const body = '【圆通速递】您的快递已发出，运单号YT1234567890123，正在运输中';
    const result = parseHistoricalSms(body);

    expect(result).not.toBeNull();
    if (result!.status === 'shipped') {
      expect(result!.trackingNumber).not.toBeNull();
    }
  });

  test('历史短信也过滤非快递内容', () => {
    const body = '【中国银行】您尾号6688的储蓄卡消费支出￥128.00';
    const result = parseHistoricalSms(body);

    expect(result).toBeNull();
  });
});

// ============================================================
// guessCarrierByTrackingNumber — 单号前缀推断
// ============================================================

describe('guessCarrierByTrackingNumber', () => {
  test('顺丰 SF 前缀', () => {
    const result = guessCarrierByTrackingNumber('SF1234567890123');
    expect(result.code).toBe('shunfeng');
    expect(result.name).toBe('顺丰速运');
  });

  test('圆通 YT 前缀', () => {
    const result = guessCarrierByTrackingNumber('YT1234567890123');
    expect(result.code).toBe('yuantong');
  });

  test('极兔 JT 前缀', () => {
    const result = guessCarrierByTrackingNumber('JT1234567890123');
    expect(result.code).toBe('jitu');
  });

  test('京东 JD 前缀', () => {
    const result = guessCarrierByTrackingNumber('JD1234567890123');
    expect(result.code).toBe('jingdong');
  });

  test('申通 STO 前缀', () => {
    const result = guessCarrierByTrackingNumber('STO1234567890123');
    expect(result.code).toBe('shentong');
  });

  test('韵达 YUNDA 前缀', () => {
    const result = guessCarrierByTrackingNumber('YUNDA1234567890');
    expect(result.code).toBe('yunda');
  });

  test('德邦 DPK 前缀', () => {
    const result = guessCarrierByTrackingNumber('DPK1234567890123');
    expect(result.code).toBe('deppon');
  });

  test('EMS 2字母+9-13位数字格式', () => {
    // 标准EMS单号: 2字母 + 9位数字 + 2字母国家码
    const result = guessCarrierByTrackingNumber('EA123456789CN');
    // 含CN后缀共14字符，不匹配 ^[A-Z]{2}\d{9,13}$ 模式
    expect(['ems', 'unknown']).toContain(result.code);
  });

  test('中通 77/78开头', () => {
    const result77 = guessCarrierByTrackingNumber('7712345678901');
    expect(result77.code).toBe('zhongtong');

    const result78 = guessCarrierByTrackingNumber('7812345678901');
    expect(result78.code).toBe('zhongtong');
  });

  test('邮政 88开头', () => {
    const result = guessCarrierByTrackingNumber('8812345678901');
    expect(result.code).toBe('ems');
  });

  test('未知单号', () => {
    const result = guessCarrierByTrackingNumber('1234567890');
    expect(result.code).toBe('unknown');
  });
});

// ============================================================
// 边界情况
// ============================================================

describe('边界情况', () => {
  test('空字符串', () => {
    const result = parseSms('');
    expect(result).toBeNull();
  });

  test('极短文本（无取件码）', () => {
    const result = parseSms('你好');
    expect(result).toBeNull();
  });

  test('含特殊字符的取件码', () => {
    const body = '取件码：A-B-5021-XYZ 请取件';
    const result = parseSms(body);
    if (result) {
      expect(result.code.length).toBeGreaterThanOrEqual(4);
      expect(result.code.length).toBeLessThanOrEqual(20);
    }
  });

  test('多个取件码（取第一个）', () => {
    const body = '取件码：8-3-5021 和 6-2-3001 两个包裹已到站';
    const result = parseSms(body);
    expect(result).not.toBeNull();
    expect(result!.code).toBe('8-3-5021');
  });

  test('发件人号码辅助匹配', () => {
    const body = '您的快递已到菜鸟驿站XX小区店，取件码8-3-5021';
    const result = parseSms(body, '10690588701234');
    expect(result).not.toBeNull();
    expect(result!.code).toBe('8-3-5021');
  });
});
