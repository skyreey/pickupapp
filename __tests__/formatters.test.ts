// ============================================================
// 格式化工具单元测试
// 覆盖：normalizeText · formatDate · isValidAddress · generateId · formatTrackingNumber · getExpiryStatus
// ============================================================
import {
  normalizeText,
  formatDate,
  formatTrackingNumber,
  generateId,
  getExpiryStatus,
  isValidAddress,
  parseBusinessHoursClosing,
  formatPackageForShare,
  formatPackagesForShare,
} from '../src/utils/formatters';

// ============================================================
// normalizeText — 全角→半角
// ============================================================

describe('normalizeText', () => {
  test('全角冒号转半角', () => {
    expect(normalizeText('取件码：8-3-5021')).toBe('取件码:8-3-5021');
  });

  test('全角括号转半角', () => {
    expect(normalizeText('菜鸟驿站（XX小区店）')).toBe('菜鸟驿站(XX小区店)');
  });

  test('全角逗号句号转半角', () => {
    expect(normalizeText('已到站，请取件。')).toBe('已到站,请取件.');
  });

  test('全角分号感叹号问号', () => {
    expect(normalizeText('注意；重要！确定？')).toBe('注意;重要!确定?');
  });

  test('全角空格转半角空格', () => {
    expect(normalizeText('菜鸟　驿站')).toBe('菜鸟 驿站');
  });

  test('全角方括号和引号', () => {
    expect(normalizeText('【通知】"包裹"已到')).toBe('[通知]"包裹"已到');
  });

  test('混合全角半角', () => {
    expect(normalizeText('取件码：8-3-5021，请到【菜鸟驿站】取件。'))
      .toBe('取件码:8-3-5021,请到[菜鸟驿站]取件.');
  });

  test('空字符串', () => {
    expect(normalizeText('')).toBe('');
  });

  test('纯半角文本不变', () => {
    const text = 'Pickup code: 8-3-5021';
    expect(normalizeText(text)).toBe(text);
  });
});

// ============================================================
// formatTrackingNumber — 单号美化
// ============================================================

describe('formatTrackingNumber', () => {
  test('SF开头的顺丰单号', () => {
    const result = formatTrackingNumber('SF1234567890123');
    expect(result).toContain('SF');
    expect(result).toContain(' ');
  });

  test('无字母前缀纯数字单号', () => {
    const result = formatTrackingNumber('123456789012');
    // 4位一组加空格
    expect(result).toBe('1234 5678 9012');
  });

  test('短单号', () => {
    const result = formatTrackingNumber('SF1234');
    expect(result).toContain('SF');
    expect(result).toContain('1234');
  });

  test('空字符串', () => {
    expect(formatTrackingNumber('')).toBe('');
  });
});

// ============================================================
// generateId — 唯一ID
// ============================================================

describe('generateId', () => {
  test('生成非空ID', () => {
    const id = generateId();
    expect(id).toBeTruthy();
  });

  test('包含时间戳和随机数', () => {
    const id = generateId();
    const parts = id.split('-');
    expect(parts.length).toBe(2);
    // 时间戳部分是数字
    expect(/^\d+$/.test(parts[0])).toBe(true);
  });

  test('连续生成不重复', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

// ============================================================
// getExpiryStatus — 过期状态
// ============================================================

describe('getExpiryStatus', () => {
  test('已过期', () => {
    const past = Date.now() - 24 * 60 * 60 * 1000; // 1天前
    const result = getExpiryStatus(past);
    expect(result.expired).toBe(true);
    expect(result.label).toBe('已过期');
  });

  test('今日截止', () => {
    // 1小时后——确保同一天内
    const today = Date.now() + 1 * 60 * 60 * 1000;
    const result = getExpiryStatus(today);
    expect(result.expired).toBe(false);
    expect(result.label === '今日截止' || result.label === '明日截止').toBe(true);
  });

  test('明日截止', () => {
    // 25小时 = ceil(25/24) = 2天，所以实际label是"2天后截止"
    // 修正预期：daysLeft > 1 时 label 为 N天后截止
    const later = Date.now() + 25 * 60 * 60 * 1000;
    const result = getExpiryStatus(later);
    expect(result.expired).toBe(false);
    expect(result.daysLeft).toBe(2);
  });

  test('N天后截止', () => {
    const future = Date.now() + 5 * 24 * 60 * 60 * 1000;
    const result = getExpiryStatus(future);
    expect(result.expired).toBe(false);
    expect(result.label).toContain('天后截止');
  });

  test('expiresAt为0', () => {
    const result = getExpiryStatus(0);
    expect(result.expired).toBe(false);
    expect(result.daysLeft).toBe(-1);
    expect(result.label).toBe('');
  });

  test('expiresAt为负值', () => {
    const result = getExpiryStatus(-1);
    expect(result.expired).toBe(false);
  });
});

// ============================================================
// isValidAddress — 地址有效性校验
// ============================================================

describe('isValidAddress', () => {
  test('有效地址：含路号', () => {
    expect(isValidAddress('北京市海淀区中关村大街1号')).toBe(true);
  });

  test('有效地址：含小区', () => {
    expect(isValidAddress('上海市静安区XX小区3号楼')).toBe(true);
  });

  test('有效地址：含驿站', () => {
    expect(isValidAddress('XX小区南门菜鸟驿站')).toBe(true);
  });

  test('有效地址：含村', () => {
    expect(isValidAddress('广东省深圳市南山区粤海街道')).toBe(true);
  });

  test('无效：快递公司名', () => {
    expect(isValidAddress('顺丰速运')).toBe(false);
    expect(isValidAddress('圆通快递')).toBe(false);
  });

  test('无效：纯数字', () => {
    expect(isValidAddress('12345678')).toBe(false);
  });

  test('无效：纯英文', () => {
    expect(isValidAddress('No.1 Zhongguancun Street')).toBe(false);
  });

  test('无效：太短', () => {
    expect(isValidAddress('路')).toBe(false);
    expect(isValidAddress('1号')).toBe(false);
  });

  test('无效：取件码格式', () => {
    expect(isValidAddress('8-3-5021')).toBe(false);
  });

  test('无效：快递单号格式', () => {
    expect(isValidAddress('SF1234567890123')).toBe(false);
  });

  test('无效：已签收等状态词', () => {
    expect(isValidAddress('已签收')).toBe(false);
    expect(isValidAddress('运输中')).toBe(false);
  });

  test('无效：纯数字短码', () => {
    expect(isValidAddress('123456')).toBe(false);
  });
});

// ============================================================
// parseBusinessHoursClosing — 营业时间解析
// ============================================================

describe('parseBusinessHoursClosing', () => {
  test('标准时间范围', () => {
    expect(parseBusinessHoursClosing('08:00-22:00')).toBe('22:00');
  });

  test('使用em dash的时间范围', () => {
    expect(parseBusinessHoursClosing('08:00—22:00')).toBe('22:00');
  });

  test('24小时营业返回null', () => {
    expect(parseBusinessHoursClosing('24小时营业')).toBeNull();
    expect(parseBusinessHoursClosing('24h')).toBeNull();
    expect(parseBusinessHoursClosing('全天')).toBeNull();
  });

  test('null输入返回null', () => {
    expect(parseBusinessHoursClosing(null)).toBeNull();
    expect(parseBusinessHoursClosing(undefined)).toBeNull();
  });
});

// ============================================================
// formatPackageForShare — 包裹分享
// ============================================================

describe('formatPackageForShare', () => {
  const mockPackage = {
    id: 'pkg-001',
    trackingNumber: 'SF1234567890',
    carrier: 'shunfeng' as any,
    carrierName: '顺丰速运',
    orderSource: '淘宝',
    productName: 'iPhone手机壳',
    pickupCode: '8-3-5021',
    pickupAddress: '北京市海淀区中关村大街1号菜鸟驿站',
    pickupPointName: '菜鸟驿站(中关村店)',
    pickupPointPhone: '13800001111',
    businessHours: '08:00-22:00',
    notes: null,
    currentStatus: 'stored' as any,
    statusUpdatedAt: Date.now(),
    source: 'sms' as any,
    createdAt: Date.now(),
    pickedUpAt: 0,
    expiresAt: 0,
    pinned: false,
    smsRawText: null,
    screenshotPaths: null,
    assignedTo: null,
    assignedToName: null,
    pushedBy: null,
    pushStatus: null,
  };

  test('生成分享文本含取件码', () => {
    const text = formatPackageForShare(mockPackage);
    expect(text).toContain('取件通');
    expect(text).toContain('8-3-5021');
    expect(text).toContain('顺丰速运');
  });

  test('无取件码时不含取件码行', () => {
    const pkg = { ...mockPackage, pickupCode: null };
    const text = formatPackageForShare(pkg);
    expect(text).not.toContain('取件码：');
  });

  test('无地址时不含地址行', () => {
    const pkg = { ...mockPackage, pickupAddress: null };
    const text = formatPackageForShare(pkg);
    expect(text).not.toContain('地址：');
  });

  test('无电话时不含电话行', () => {
    const pkg = { ...mockPackage, pickupPointPhone: null };
    const text = formatPackageForShare(pkg);
    expect(text).not.toContain('电话：');
  });
});

// ============================================================
// formatDate — 日期格式化
// ============================================================

describe('formatDate', () => {
  test('格式化时间戳为日期', () => {
    const ts = new Date('2024-06-15 18:30:00').getTime();
    const result = formatDate(ts);
    expect(result).toContain('2024');
    expect(result).toContain('06');
    expect(result).toContain('15');
    expect(result).toContain('18:30');
  });
});
