// ============================================================
// 统一日志系统
// 级别：DEBUG < INFO < WARN < ERROR
// 特性：时间戳 · 模块标签 · 内存环形缓冲 · 导出支持
// ============================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** 当前最低输出级别（低于此级别的日志被丢弃） */
let minLevel: LogLevel = __DEV__ ? 'debug' : 'info';

/** 日志条目 */
export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  tag: string;
  message: string;
  extra?: unknown;
}

/** 内存环形缓冲（最多保留 500 条，供反馈时导出） */
const RING_SIZE = 500;
const ringBuffer: LogEntry[] = [];
let ringIndex = 0;

function addToBuffer(entry: LogEntry): void {
  ringBuffer[ringIndex % RING_SIZE] = entry;
  ringIndex++;
}

/** 设置最低日志级别 */
export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

/** 格式化时间戳 */
function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${d.getMilliseconds().toString().padStart(3, '0')}`;
}

/** 核心写日志函数 */
function writeLog(level: LogLevel, tag: string, message: string, extra?: unknown): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minLevel]) return;

  const entry: LogEntry = {
    timestamp: Date.now(),
    level,
    tag,
    message,
    extra,
  };

  addToBuffer(entry);

  const prefix = `${formatTime(entry.timestamp)} [${level.toUpperCase()}] [${tag}]`;
  const line = extra
    ? `${prefix} ${message} | ${JSON.stringify(extra)}`
    : `${prefix} ${message}`;

  switch (level) {
    case 'error':
      console.error(line);
      break;
    case 'warn':
      console.warn(line);
      break;
    case 'debug':
      console.debug(line);
      break;
    default:
      console.log(line);
  }
}

/** 创建带模块标签的 Logger 实例 */
export function createLogger(tag: string) {
  return {
    debug: (msg: string, extra?: unknown) => writeLog('debug', tag, msg, extra),
    info:  (msg: string, extra?: unknown) => writeLog('info',  tag, msg, extra),
    warn:  (msg: string, extra?: unknown) => writeLog('warn',  tag, msg, extra),
    error: (msg: string, extra?: unknown) => writeLog('error', tag, msg, extra),
  };
}

/** 获取最近 N 条日志（供反馈/调试导出） */
export function getRecentLogs(count = 100): LogEntry[] {
  const size = Math.min(ringIndex, RING_SIZE);
  const start = Math.max(0, ringIndex - size);
  const result: LogEntry[] = [];
  for (let i = start; i < ringIndex; i++) {
    result.push(ringBuffer[i % RING_SIZE]);
  }
  return result.slice(-count);
}

/** 导出日志为文本（供分享/反馈） */
export function exportLogs(): string {
  return getRecentLogs(200)
    .map(e => `${formatTime(e.timestamp)} [${e.level.toUpperCase()}] [${e.tag}] ${e.message}`)
    .join('\n');
}

/** 清空日志缓冲 */
export function clearLogs(): void {
  ringBuffer.length = 0;
  ringIndex = 0;
}
