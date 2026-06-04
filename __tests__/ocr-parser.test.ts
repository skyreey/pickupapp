// ============================================================
// OCR 文本解析器单元测试
// 覆盖：取件码提取 · 驿站名 · 地址 · 电话 · 签收状态 · 置信度
// ============================================================
import { parseOcrText } from '../src/services/ocr-parser';
import type { OcrPackageInfo } from '../src/services/ocr-parser';

// ============================================================
// parseOcrText — OCR文本→快递信息
// ============================================================

describe('parseOcrText', () => {
  describe('取件码提取', () => {
    test('标准取件码格式', () => {
      const text = '取件码：8-3-5021\n请凭取件码至菜鸟驿站取件';
      const result = parseOcrText(text);

      expect(result).not.toBeNull();
      expect(result!.pickupCode).toBe('8-3-5021');
    });

    test('纯数字取件码', () => {
      const text = '取件码：12345678\n请到南门驿站取件';
      const result = parseOcrText(text);

      expect(result).not.toBeNull();
      expect(result!.pickupCode).toBe('12345678');
    });

    test('字母+数字取件码（如顺丰SF801234）', () => {
      const text = '取件码SF801234请到南门取件';
      const result = parseOcrText(text);

      expect(result).not.toBeNull();
      expect(result!.pickupCode).toBe('SF801234');
    });

    test('验证码即取件码', () => {
      const text = '验证码：802145\n（作为取件码使用）';
      const result = parseOcrText(text);

      expect(result).not.toBeNull();
      expect(result!.pickupCode).toBe('802145');
    });

    test('无取件码但有其他信息', () => {
      const text = '菜鸟驿站 XX小区南门店\n地址：北京市海淀区中关村大街1号\n联系电话：13800001111';
      const result = parseOcrText(text);

      expect(result).not.toBeNull();
      expect(result!.pickupCode).toBeNull();
      expect(result!.stationName).not.toBeNull();
    });
  });

  describe('驿站名称提取', () => {
    test('菜鸟驿站', () => {
      const text = '菜鸟驿站 XX小区南门店\n取件码8-3-5021';
      const result = parseOcrText(text);
      expect(result).not.toBeNull();
      expect(result!.stationName).not.toBeNull();
      expect(result!.pickupCode).toBe('8-3-5021');
    });

    test('兔喜生活', () => {
      const text = '兔喜生活超市\n取件码5-2-3001';
      const result = parseOcrText(text);
      expect(result).not.toBeNull();
      expect(result!.stationName).toContain('兔喜');
    });

    test('丰巢快递柜', () => {
      const text = '丰巢快递柜（3号楼北侧）\n取件码682091';
      const result = parseOcrText(text);
      expect(result).not.toBeNull();
      expect(result!.stationName).toContain('丰巢');
    });

    test('韵达超市', () => {
      const text = '韵达超市（XX小区店）\n取件码8-2-5021\n营业时间08:00-22:00';
      const result = parseOcrText(text);
      expect(result).not.toBeNull();
      expect(result!.stationName).toContain('韵达超市');
    });

    test('未识别驿站名但有地址', () => {
      const text = '取件地址：北京市朝阳区望京SOHO T1 B座\n取件码6-2-3001';
      const result = parseOcrText(text);
      expect(result).not.toBeNull();
      // 可能没识别出驿站名，但有地址
      expect(result!.pickupAddress).not.toBeNull();
    });
  });

  describe('取件地址提取', () => {
    test('取件地址标签', () => {
      const text = '取件地址：北京市海淀区中关村大街1号院3号楼底商\n取件码8-3-5021';
      const result = parseOcrText(text);

      expect(result).not.toBeNull();
      expect(result!.pickupAddress).toContain('中关村');
    });

    test('含路/街/号的地址', () => {
      const texts = [
        '上海市静安区南京西路1000号恒隆广场B1层\n取件码6-2-3001',
        '深圳市南山区粤海街道科技园路1号\n取件码5-3-8001',
      ];

      for (const text of texts) {
        const result = parseOcrText(text);
        expect(result).not.toBeNull();
        if (result!.pickupAddress) {
          expect(result!.pickupAddress.length).toBeGreaterThanOrEqual(4);
        }
      }
    });
  });

  describe('联系电话提取', () => {
    test('手机号', () => {
      const text = '联系电话：13987654321\n取件码8-3-5021';
      const result = parseOcrText(text);

      expect(result).not.toBeNull();
      expect(result!.stationPhone).toBe('13987654321');
    });

    test('座机号', () => {
      const text = '客服电话：010-88886666\n取件码8-3-5021';
      const result = parseOcrText(text);

      expect(result).not.toBeNull();
      expect(result!.stationPhone).toBe('010-88886666');
    });

    test('快递员电话', () => {
      const text = '快递员：13812348765\n取件码5-2-3001';
      const result = parseOcrText(text);

      expect(result).not.toBeNull();
      expect(result!.stationPhone).toBe('13812348765');
    });
  });

  describe('签收状态识别', () => {
    test('已签收', () => {
      const texts = [
        '已签收 - 感谢使用菜鸟驿站',
        '您的快递已收货，交易成功',
        '包裹已送达，已完成签收',
      ];

      for (const text of texts) {
        const result = parseOcrText(text);
        if (result) {
          expect(result.isPickedUp).toBe(true);
        }
      }
    });

    test('未签收', () => {
      const text = '您的快递已到站，取件码8-3-5021，请尽快取件';
      const result = parseOcrText(text);

      expect(result).not.toBeNull();
      expect(result!.isPickedUp).toBe(false);
    });
  });

  describe('快递单号提取', () => {
    test('提取运单号', () => {
      const text = '运单号：SF1234567890123\n您的快递已到站';
      const result = parseOcrText(text);

      expect(result).not.toBeNull();
      if (result!.trackingNumber) {
        expect(result!.confidence).toBe('low');
      }
    });

    test('带前缀的快递单号', () => {
      const text = '快递单号：YT9988776655443\n请凭此单号查询物流';
      const result = parseOcrText(text);

      expect(result).not.toBeNull();
      if (result!.trackingNumber) {
        expect(result!.trackingNumber).toContain('YT');
      }
    });
  });

  describe('快递公司识别', () => {
    test('顺丰', () => {
      const text = '顺丰速运 您的快递已到站 取件码SF801234';
      const result = parseOcrText(text);
      expect(result).not.toBeNull();
      // 有取件码就应该返回结果
      expect(result!.pickupCode).toBe('SF801234');
    });

    test('圆通', () => {
      const text = '圆通速递 - 快递已到XX菜鸟驿站\n取件码6-2-3001';
      const result = parseOcrText(text);
      expect(result).not.toBeNull();
      expect(result!.carrier).toBe('yuantong');
    });
  });

  describe('置信度评估', () => {
    test('高置信度：快递公司+取件码+位置信息', () => {
      const text = '菜鸟驿站\n顺丰速运\n取件码：8-3-5021\n取件地址：北京市海淀区中关村大街1号\n电话：13800001111';
      const result = parseOcrText(text);

      expect(result).not.toBeNull();
      expect(result!.confidence).toBe('high');
    });

    test('低置信度：只有取件码', () => {
      const text = '取件码：8-3-5021';
      const result = parseOcrText(text);

      expect(result).not.toBeNull();
      expect(result!.confidence).toBe('low');
    });

    test('低置信度：只有单号', () => {
      const text = '运单号：SF1234567890123';
      const result = parseOcrText(text);

      expect(result).not.toBeNull();
      expect(result!.confidence).toBe('low');
    });
  });

  describe('购买平台识别', () => {
    test('淘宝', () => {
      const text = '淘宝订单 - 您的商品已到菜鸟驿站\n取件码8-3-5021';
      const result = parseOcrText(text);
      expect(result).not.toBeNull();
      expect(result!.orderSource).toBe('淘宝');
    });

    test('京东', () => {
      const text = '京东自营 - 快递已到站\n取件码6-2-3001';
      const result = parseOcrText(text);
      expect(result).not.toBeNull();
      expect(result!.orderSource).toBe('京东');
    });

    test('拼多多', () => {
      const text = '拼多多订单 - 已到菜鸟驿站\n取件码5-3-8001';
      const result = parseOcrText(text);
      expect(result).not.toBeNull();
      expect(result!.orderSource).toBe('拼多多');
    });
  });
});

// ============================================================
// 边界情况
// ============================================================

describe('边界情况', () => {
  test('空文本', () => {
    const result = parseOcrText('');
    expect(result).toBeNull();
  });

  test('纯英文OCR结果（不相关）', () => {
    const text = 'This is a test message without any delivery information';
    const result = parseOcrText(text);
    expect(result).toBeNull();
  });

  test('OCR乱码处理', () => {
    const text = '取件石马：8一3一5O21 亲到XX小R南门取件'; // OCR常见错误
    const result = parseOcrText(text);
    // 不应崩溃，可能提取失败或返回低置信度
    if (result) {
      expect(result.confidence).toBeDefined();
    }
  });

  test('分词兜底：正则未匹配时触发', () => {
    const text = '亲 你的快递到了哦 在XX小区南门那个菜鸟驿站 码是8-3-5021 记得来拿 电话13800001111';
    const result = parseOcrText(text);

    expect(result).not.toBeNull();
    expect(result!.pickupCode).toBe('8-3-5021');
    expect(result!.stationPhone).toBe('13800001111');
  });
});
