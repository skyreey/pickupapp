// ============================================================
// 远程配置服务 — 快递规则热更新
//
// 机制：
//   1. 启动时检查远程配置版本号
//   2. 若远程版本 > 本地缓存 → 下载并缓存
//   3. 下载失败 → 降级到内置默认规则
//   4. 提供 getRules() 统一接口，调用方不需关心来源
// ============================================================
import { getSetting, setSetting } from '../../modules/expo-notification-reader';
import { SMS_PATTERN_RULES } from '../patterns/sms-patterns';
import type { SmsPatternRule } from '../patterns/sms-patterns';
import { createLogger } from '../utils/logger';

const log = createLogger('RemoteConfig');

// ===== 远程配置 URL（GitHub Raw / CDN） =====
const CONFIG_BASE_URL = 'https://raw.githubusercontent.com/skyreey/PickupApp/main/config';
const CONFIG_VERSION_URL = `${CONFIG_BASE_URL}/rules-version.json`;
const CONFIG_RULES_URL = `${CONFIG_BASE_URL}/sms-rules.json`;

// ===== 本地存储 Key =====
const RULES_CACHE_KEY = 'remote_sms_rules';
const RULES_VERSION_KEY = 'remote_sms_rules_version';
const LAST_FETCH_KEY = 'remote_config_last_fetch';

// ===== 缓存有效期：7天 =====
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let cachedRules: SmsPatternRule[] | null = null;
let fetchPromise: Promise<SmsPatternRule[]> | null = null;

/** 获取当前生效的规则（内置 + 远程） */
export async function getRules(): Promise<SmsPatternRule[]> {
  // 优先返回远程缓存
  if (cachedRules) return cachedRules;

  // 尝试加载本地缓存的远程规则
  try {
    const cached = await getSetting(RULES_CACHE_KEY);
    if (cached) {
      const rules: SmsPatternRule[] = JSON.parse(cached);
      cachedRules = rules;
      log.info('使用本地缓存的远程规则', { count: rules.length });
      return rules;
    }
  } catch {}

  // 降级到内置规则
  log.info('使用内置默认规则');
  return SMS_PATTERN_RULES;
}

/** 强制刷新远程配置（设置页调用） */
export async function refreshRemoteConfig(): Promise<boolean> {
  // 防止并发刷新
  if (fetchPromise) {
    await fetchPromise;
    return cachedRules !== null && cachedRules !== SMS_PATTERN_RULES;
  }

  fetchPromise = doFetchConfig();
  try {
    await fetchPromise;
    return cachedRules !== null && cachedRules !== SMS_PATTERN_RULES;
  } finally {
    fetchPromise = null;
  }
}

/** 自动检查更新（启动时调用，失败静默） */
export async function autoUpdateConfig(): Promise<void> {
  try {
    // 检查上次拉取时间，7天内不重复拉
    const lastFetch = await getSetting(LAST_FETCH_KEY);
    if (lastFetch) {
      const elapsed = Date.now() - parseInt(lastFetch, 10);
      if (elapsed < CACHE_TTL_MS) {
        log.debug('缓存未过期，跳过远程拉取', { hoursSince: Math.floor(elapsed / 3600000) });
        return;
      }
    }

    await refreshRemoteConfig();
  } catch {
    // 静默失败，不影响 App 正常使用
  }
}

// ===== 内部实现 =====

async function doFetchConfig(): Promise<SmsPatternRule[]> {
  try {
    // 1. 检查版本号
    log.debug('检查远程配置版本...');
    const versionRes = await fetch(CONFIG_VERSION_URL, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!versionRes.ok) {
      throw new Error(`版本请求失败: ${versionRes.status}`);
    }

    const versionInfo: { version: number; updatedAt: string } = await versionRes.json();
    const localVersion = parseInt((await getSetting(RULES_VERSION_KEY)) || '0', 10);

    if (versionInfo.version <= localVersion) {
      log.debug('远程规则版本未更新', { remote: versionInfo.version, local: localVersion });
      await setSetting(LAST_FETCH_KEY, String(Date.now()));
      return cachedRules || SMS_PATTERN_RULES;
    }

    // 2. 下载新规则
    log.info('下载新规则', { version: versionInfo.version });
    const rulesRes = await fetch(CONFIG_RULES_URL, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!rulesRes.ok) {
      throw new Error(`规则下载失败: ${rulesRes.status}`);
    }

    const rules: SmsPatternRule[] = await rulesRes.json();

    // 3. 验证规则格式
    if (!Array.isArray(rules) || rules.length === 0) {
      throw new Error('规则格式无效：非数组或为空');
    }

    // 4. 缓存到本地
    await setSetting(RULES_CACHE_KEY, JSON.stringify(rules));
    await setSetting(RULES_VERSION_KEY, String(versionInfo.version));
    await setSetting(LAST_FETCH_KEY, String(Date.now()));

    cachedRules = rules;
    log.info('远程规则更新成功', { count: rules.length, version: versionInfo.version });
    return rules;
  } catch (e) {
    log.warn('远程规则拉取失败，使用本地缓存', { error: String(e) });
    // 降级：返回已有缓存或内置规则
    return cachedRules || SMS_PATTERN_RULES;
  }
}

/** 清除远程规则缓存（恢复内置规则） */
export async function clearRemoteConfig(): Promise<void> {
  await setSetting(RULES_CACHE_KEY, '');
  await setSetting(RULES_VERSION_KEY, '0');
  await setSetting(LAST_FETCH_KEY, '0');
  cachedRules = null;
  log.info('远程规则已清除，恢复内置规则');
}

/** 获取当前规则来源（供设置页展示） */
export async function getRulesSource(): Promise<'remote' | 'builtin'> {
  try {
    const ver = await getSetting(RULES_VERSION_KEY);
    return ver && parseInt(ver, 10) > 0 ? 'remote' : 'builtin';
  } catch {
    return 'builtin';
  }
}
