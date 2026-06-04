// ============================================================
// 性能追踪器 — 关键路径耗时统计
//
// 用法：
//   const done = startPerf('sms-parse');
//   const result = parseSms(text);
//   done(); // 自动记录耗时
// ============================================================
import { createLogger } from '../utils/logger';

const log = createLogger('Perf');

/** 性能采样点 */
interface PerfSample {
  tag: string;
  duration: number;
  timestamp: number;
}

/** 最近100条样本 */
const samples: PerfSample[] = [];
const MAX_SAMPLES = 100;

/** 聚合统计 */
interface PerfStats {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  p95Ms: number;
}

const tagSamples = new Map<string, number[]>();

/** 开始测量，返回停止函数 */
export function startPerf(tag: string): () => void {
  const start = performance.now();
  return () => {
    const duration = performance.now() - start;

    // 记录样本
    samples.push({ tag, duration, timestamp: Date.now() });
    if (samples.length > MAX_SAMPLES) samples.shift();

    // 记录按标签聚合
    const list = tagSamples.get(tag) || [];
    list.push(duration);
    if (list.length > 200) list.shift();
    tagSamples.set(tag, list);

    // 慢操作告警（>500ms）
    if (duration > 500) {
      log.warn(`慢操作: ${tag}`, { duration: Math.round(duration) + 'ms' });
    }
  };
}

/** 获取指定标签的性能统计 */
export function getPerfStats(tag: string): PerfStats | null {
  const list = tagSamples.get(tag);
  if (!list || list.length === 0) return null;

  const sorted = [...list].sort((a, b) => a - b);
  const p95Idx = Math.floor(sorted.length * 0.95);

  return {
    count: sorted.length,
    totalMs: sorted.reduce((s, v) => s + v, 0),
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
    avgMs: sorted.reduce((s, v) => s + v, 0) / sorted.length,
    p95Ms: sorted[p95Idx] || sorted[sorted.length - 1],
  };
}

/** 获取所有标签的性能摘要（供设置页展示） */
export function getAllPerfStats(): Record<string, PerfStats> {
  const result: Record<string, PerfStats> = {};
  for (const tag of tagSamples.keys()) {
    const stats = getPerfStats(tag);
    if (stats) result[tag] = stats;
  }
  return result;
}

/** 导出最近样本（供调试） */
export function getRecentSamples(count = 30): PerfSample[] {
  return samples.slice(-count);
}
