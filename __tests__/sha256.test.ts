// ============================================================
// SHA-256 工具单元测试 — FIPS 180-4 标准测试向量
// ============================================================
import { sha256Hex, hmacSha256Hex, randomHex } from '../src/utils/sha256';

describe('sha256Hex — FIPS 180-4 标准向量', () => {
  test('"abc" 哈希正确', () => {
    expect(sha256Hex('abc')).toBe(
      'BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD',
    );
  });

  test('空字符串哈希正确', () => {
    expect(sha256Hex('')).toBe(
      'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855',
    );
  });

  test('长字符串哈希正确', () => {
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248D6A61D20638B8E5C026930C3E6039A33CE45964FF2167F6ECEDD419DB06C1',
    );
  });

  test('确定性：相同输入相同输出', () => {
    expect(sha256Hex('test')).toBe(sha256Hex('test'));
  });
});

describe('hmacSha256Hex', () => {
  // RFC 4231 Test Case 1
  test('RFC 4231 测试向量 1', () => {
    const key = '\x0b'.repeat(20);
    const msg = 'Hi There';
    expect(hmacSha256Hex(key, msg)).toBe(
      'B0344C61D8DB38535CA8AFCEAF0BF12B881DC200C9833DA726E9376C2E32CFF7',
    );
  });
});

describe('randomHex', () => {
  test('生成指定长度的 hex 字符串', () => {
    const hex = randomHex(16);
    expect(hex.length).toBe(32);
    expect(hex).toMatch(/^[0-9A-F]{32}$/);
  });

  test('两次调用结果不同（概率性）', () => {
    const a = randomHex(16);
    const b = randomHex(16);
    expect(a).not.toBe(b);
  });
});
