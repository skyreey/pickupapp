// ============================================================
// SHA-256 + HMAC-SHA256 (同步实现，无外部依赖)
//
// 用于 Pro 激活码的签名验证。替代之前自研的 32 位整数哈希
// （strongHash），后者不是密码学哈希，存在碰撞和爆破风险。
//
// 本实现基于 FIPS 180-4 标准，逻辑与 Web Crypto subtle.digest
// 一致，已用标准测试向量验证。
// ============================================================

// 预计算的 SHA-256 轮常量
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));

/** 计算 SHA-256，返回 32 字节的 Uint8Array */
export function sha256(data: Uint8Array): Uint8Array {
  // 预处理：补位 + 长度
  const bitLen = data.length * 8;
  const withPad = data.length + 1 + ((56 - (data.length + 1) % 64 + 64) % 64) + 8;
  const bytes = new Uint8Array(withPad);
  bytes.set(data);
  bytes[data.length] = 0x80;
  // 64 位大端长度（JS 位运算限 32 位，分两段写入）
  const view = new DataView(bytes.buffer);
  view.setUint32(withPad - 4, bitLen >>> 0, false);
  view.setUint32(withPad - 8, Math.floor(bitLen / 0x100000000), false);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let off = 0; off < bytes.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }

    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, h0, false); ov.setUint32(4, h1, false);
  ov.setUint32(8, h2, false); ov.setUint32(12, h3, false);
  ov.setUint32(16, h4, false); ov.setUint32(20, h5, false);
  ov.setUint32(24, h6, false); ov.setUint32(28, h7, false);
  return out;
}

/** SHA-256 → 大写十六进制字符串 */
export function sha256Hex(data: string): string {
  const bytes = sha256(new TextEncoder().encode(data));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** HMAC-SHA256，返回大写十六进制字符串 */
export function hmacSha256Hex(key: string, message: string): string {
  const blockSize = 64;
  const keyBytes = new TextEncoder().encode(key);
  let k: Uint8Array = keyBytes;
  if (k.length > blockSize) k = sha256(k);
  if (k.length < blockSize) {
    const padded = new Uint8Array(blockSize);
    padded.set(k);
    k = padded;
  }
  const okp = new Uint8Array(blockSize);
  const ikp = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    okp[i] = k[i] ^ 0x5c;
    ikp[i] = k[i] ^ 0x36;
  }
  const inner = new Uint8Array(blockSize + new TextEncoder().encode(message).length);
  inner.set(ikp);
  inner.set(new TextEncoder().encode(message), blockSize);
  const innerHash = sha256(inner);
  const outer = new Uint8Array(blockSize + 32);
  outer.set(okp);
  outer.set(innerHash, blockSize);
  return Array.from(sha256(outer), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** 密码学安全随机数，返回指定长度的十六进制字符串 */
export function randomHex(length: number): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}
