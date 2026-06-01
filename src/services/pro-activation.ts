// ============================================================
// Pro 激活码验证 — 本地算法校验
// ============================================================

const SECRET_PREFIX = 'pickup-pro-2026';

/**
 * 验证激活码
 * 格式：PICKUP-XXXXXXXXXXXX（12位大写字母数字）
 */
export async function verifyActivationCode(code: string): Promise<boolean> {
  if (!code || typeof code !== 'string') return false;
  const trimmed = code.trim().toUpperCase();
  if (!/^PICKUP-[0-9A-Z]{12}$/.test(trimmed) && !/^[0-9A-Z]{12}$/.test(trimmed)) return false;
  return verifyLocal(trimmed);
}

function verifyLocal(code: string): boolean {
  const core = code.replace('PICKUP-', '');
  const hash = simpleHash(SECRET_PREFIX + core);
  const checksum = hash.slice(0, 4);
  const c1 = parseInt(checksum[0], 16);
  const c2 = parseInt(core[0], 16);
  const expected = parseInt(core[core.length - 1], 16);
  return (c1 + c2) % 16 === expected;
}

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return hex + hex.split('').reverse().join('');
}
