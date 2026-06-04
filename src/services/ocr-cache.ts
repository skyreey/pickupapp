// ============================================================
// OCR 识别缓存
//
// 策略：
//   1. 对截图URI做轻量级指纹（前200字节 + 修改时间）
//   2. 命中缓存 → 跳过OCR识别，直接返回结果
//   3. 缓存容量：最多100条，LRU淘汰
//   4. 启动时从持久化存储恢复缓存
// ============================================================
import { getSetting, setSetting } from '../../modules/expo-notification-reader';
import { createLogger } from '../utils/logger';

const log = createLogger('OcrCache');

// ===== 配置 =====
const MAX_ENTRIES = 100;
const CACHE_KEY = 'ocr_cache';

interface CacheEntry {
  fingerprint: string;
  result: string; // JSON stringified OcrPackageInfo
  timestamp: number;
  hitCount: number;
}

// ===== 内存缓存 =====
const cache = new Map<string, CacheEntry>();

// ===== 指纹生成（轻量级，不读完整文件） =====
export function createFingerprint(uri: string, fileSize?: number, modifiedAt?: number): string {
  // 对大型图片：仅用URI后半段+文件元信息做指纹
  // 这样避免了读文件内容的开销
  const uriEnd = uri.slice(-60);
  return `${uriEnd}-${fileSize || 0}-${modifiedAt || 0}`;
}

// ===== 公开 API =====

/** 从缓存获取 OCR 结果，未命中返回 null */
export function getOcrCache(fingerprint: string): string | null {
  const entry = cache.get(fingerprint);
  if (entry) {
    entry.hitCount++;
    log.debug('OCR缓存命中', { fingerprint: fingerprint.slice(0, 16), hits: entry.hitCount });
    return entry.result;
  }
  log.debug('OCR缓存未命中', { fingerprint: fingerprint.slice(0, 16) });
  return null;
}

/** 写入 OCR 缓存 */
export function setOcrCache(fingerprint: string, result: string): void {
  // LRU 淘汰：缓存满时删除最旧的条目
  if (cache.size >= MAX_ENTRIES && !cache.has(fingerprint)) {
    const oldest = [...cache.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) {
      cache.delete(oldest[0]);
      log.debug('OCR缓存淘汰旧条目', { evicted: oldest[0].slice(0, 16) });
    }
  }

  cache.set(fingerprint, {
    fingerprint,
    result,
    timestamp: Date.now(),
    hitCount: 1,
  });

  log.debug('OCR缓存写入', { fingerprint: fingerprint.slice(0, 16), size: cache.size });
}

/** 清除缓存 */
export function clearOcrCache(): void {
  cache.clear();
  log.info('OCR缓存已清空');
}

/** 获取缓存命中率 */
export function getCacheStats(): { size: number; hits: number; totalEntries: number } {
  let hits = 0;
  for (const entry of cache.values()) {
    hits += entry.hitCount - 1; // 减1因为首次写入hitCount=1不算命中
  }
  return { size: cache.size, hits, totalEntries: cache.size };
}

/** 持久化缓存到 SharedPreferences */
export async function persistOcrCache(): Promise<void> {
  try {
    // 只持久化命中次数 > 1的热数据（冷数据不占存储）
    const hotEntries = [...cache.entries()]
      .filter(([, e]) => e.hitCount > 1)
      .slice(0, 50);
    if (hotEntries.length === 0) return;
    const data = hotEntries.map(([, e]) => ({
      f: e.fingerprint,
      r: e.result,
      t: e.timestamp,
    }));
    await setSetting(CACHE_KEY, JSON.stringify(data));
  } catch {}
}

/** 从 SharedPreferences 恢复缓存 */
export async function restoreOcrCache(): Promise<void> {
  try {
    const raw = await getSetting(CACHE_KEY);
    if (!raw) return;
    const data: Array<{ f: string; r: string; t: number }> = JSON.parse(raw);
    for (const item of data) {
      cache.set(item.f, {
        fingerprint: item.f,
        result: item.r,
        timestamp: item.t,
        hitCount: 2,
      });
    }
    log.info('OCR缓存已恢复', { entries: cache.size });
  } catch {}
}
