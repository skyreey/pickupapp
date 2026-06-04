// ============================================================
// 日志系统单元测试
// 覆盖：创建Logger · 各级别日志 · 环形缓冲 · 导出 · 清空
// ============================================================
import {
  createLogger,
  getRecentLogs,
  exportLogs,
  clearLogs,
  setLogLevel,
} from '../src/utils/logger';
import type { LogEntry } from '../src/utils/logger';

describe('Logger', () => {
  // 每个测试前清空，避免交叉污染
  beforeEach(() => {
    clearLogs();
    setLogLevel('debug'); // 确保所有级别都会被记录
  });

  describe('createLogger', () => {
    test('创建带标签的Logger', () => {
      const log = createLogger('TestModule');
      expect(log).toBeDefined();
      expect(log.debug).toBeDefined();
      expect(log.info).toBeDefined();
      expect(log.warn).toBeDefined();
      expect(log.error).toBeDefined();
    });
  });

  describe('各级别日志写入', () => {
    test('debug 日志', () => {
      const log = createLogger('DebugTest');
      log.debug('调试消息');
      const logs = getRecentLogs(10);
      expect(logs.some(l => l.tag === 'DebugTest' && l.level === 'debug')).toBe(true);
    });

    test('info 日志', () => {
      const log = createLogger('InfoTest');
      log.info('信息消息');
      const logs = getRecentLogs(10);
      expect(logs.some(l => l.tag === 'InfoTest' && l.level === 'info')).toBe(true);
    });

    test('warn 日志', () => {
      const log = createLogger('WarnTest');
      log.warn('警告消息');
      const logs = getRecentLogs(10);
      expect(logs.some(l => l.tag === 'WarnTest' && l.level === 'warn')).toBe(true);
    });

    test('error 日志', () => {
      const log = createLogger('ErrorTest');
      log.error('错误消息');
      const logs = getRecentLogs(10);
      expect(logs.some(l => l.tag === 'ErrorTest' && l.level === 'error')).toBe(true);
    });

    test('带额外数据的日志', () => {
      const log = createLogger('ExtraTest');
      log.info('有数据', { count: 42, name: 'test' });
      const logs = getRecentLogs(10);
      const entry = logs.find(l => l.tag === 'ExtraTest');
      expect(entry).toBeDefined();
    });
  });

  describe('日志级别过滤', () => {
    test('设置为warn时跳过debug和info', () => {
      clearLogs();
      setLogLevel('warn');
      const log = createLogger('LevelTest');

      log.debug('不应该出现');
      log.info('也不应该出现');
      log.warn('应该出现');
      log.error('也应该出现');

      const logs = getRecentLogs(100);
      expect(logs.filter(l => l.level === 'debug').length).toBe(0);
      expect(logs.filter(l => l.level === 'info').length).toBe(0);
      expect(logs.filter(l => l.level === 'warn').length).toBe(1);
      expect(logs.filter(l => l.level === 'error').length).toBe(1);
    });

    test('设置为error时只记录error', () => {
      clearLogs();
      setLogLevel('error');
      const log = createLogger('ErrorOnlyTest');

      log.info('info');
      log.warn('warn');
      log.error('error');

      const logs = getRecentLogs(100);
      expect(logs.filter(l => l.level !== 'error').length).toBe(0);
    });
  });

  describe('时间戳', () => {
    test('每条日志有时间戳', () => {
      const log = createLogger('TimestampTest');
      log.info('测试');
      const logs = getRecentLogs(10);
      expect(logs.length).toBeGreaterThan(0);
      expect(typeof logs[0].timestamp).toBe('number');
      expect(logs[0].timestamp).toBeGreaterThan(0);
    });
  });
});

describe('环形缓冲', () => {
  test('超过500条后循环覆盖', () => {
    clearLogs();
    const log = createLogger('BufferTest');
    for (let i = 0; i < 600; i++) {
      log.info(`消息 ${i}`);
    }
    const logs = getRecentLogs(600);
    // 环形缓冲最多500条
    expect(logs.length).toBeLessThanOrEqual(500);
  });
});

describe('exportLogs', () => {
  test('导出为文本字符串', () => {
    clearLogs();
    const log = createLogger('ExportTest');
    log.info('导出测试1');
    log.warn('导出测试2');

    const exported = exportLogs();
    expect(exported).toContain('[INFO]');
    expect(exported).toContain('ExportTest');
    expect(exported).toContain('导出测试1');
    expect(exported).toContain('导出测试2');
  });

  test('空导出', () => {
    clearLogs();
    const exported = exportLogs();
    expect(typeof exported).toBe('string');
    // 空时应该是空字符串或只有换行
    expect(exported.length).toBeLessThanOrEqual(1);
  });
});

describe('clearLogs', () => {
  test('清空后getRecentLogs返回空', () => {
    const log = createLogger('ClearTest');
    log.info('清空前');
    expect(getRecentLogs(10).length).toBeGreaterThan(0);

    clearLogs();
    expect(getRecentLogs(10).length).toBe(0);
  });
});
