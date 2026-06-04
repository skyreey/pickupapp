// ============================================================
// 取件通 Pro · 激活码签发验证 + 会员云端绑定 v2
//
// 新增（相对 v1）：
//   1. memberships 表 — 会员云端绑定（deviceId + phone）
//   2. POST /api/sync-membership — 客户端同步会员状态到云端
//   3. POST /api/restore-membership — 换手机时恢复会员
//   4. GET /api/membership/:deviceId — 查询云端会员状态
//   5. SQLite 文件持久化（不再用 :memory:）
// ============================================================

const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const Database = require('better-sqlite3');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.json());

// ===== 配置 =====
const PORT = process.env.PORT || 3001;

// ADMIN_TOKEN 必须通过环境变量设置，无默认值
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
if (!ADMIN_TOKEN) {
  console.error('[取件通Pro] 致命错误：ADMIN_TOKEN 环境变量未设置，拒绝启动');
  process.exit(1);
}

const JWT_EXPIRY = '72h';
const DB_PATH = path.join(__dirname, 'data', 'pickupapp-pro.db');

// ===== RSA 密钥（必须通过环境变量持久化，否则每次重启JWT全部失效）=====
const PRIVATE_KEY_PEM = process.env.JWT_PRIVATE_KEY;
const PUBLIC_KEY_PEM = process.env.JWT_PUBLIC_KEY;

if (!PRIVATE_KEY_PEM || !PUBLIC_KEY_PEM) {
  console.error('[取件通Pro] 致命错误：JWT_PRIVATE_KEY 或 JWT_PUBLIC_KEY 环境变量未设置');
  console.error('[取件通Pro] 请先运行 generate-keys.js 生成RSA密钥对，再设置环境变量');
  process.exit(1);
}

const PRIVATE_KEY = crypto.createPrivateKey(PRIVATE_KEY_PEM);
const PUBLIC_KEY = crypto.createPublicKey(PUBLIC_KEY_PEM);

// ===== SQLite =====
const fs = require('fs');
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS used_codes (
    code_hash TEXT PRIMARY KEY,
    tier TEXT NOT NULL,
    activated_at INTEGER NOT NULL,
    device_id TEXT,
    phone_hash TEXT,
    ip TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_used_codes_device ON used_codes(device_id);

  CREATE TABLE IF NOT EXISTS memberships (
    device_id TEXT NOT NULL,
    phone_hash TEXT,
    tier TEXT NOT NULL,
    activated_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL DEFAULT 0,
    token TEXT NOT NULL,
    synced_at INTEGER NOT NULL,
    PRIMARY KEY (device_id)
  );
  CREATE INDEX IF NOT EXISTS idx_memberships_phone ON memberships(phone_hash);
`);

// ===== 限速 =====
const verifyLimiter = rateLimit({ windowMs: 60_000, max: 10, message: { error: '请求过于频繁' }, standardHeaders: true, legacyHeaders: false });
const syncLimiter = rateLimit({ windowMs: 60_000, max: 30, message: { error: '请求过于频繁' }, standardHeaders: true, legacyHeaders: false });
const membershipLimiter = rateLimit({ windowMs: 60_000, max: 20, message: { error: '请求过于频繁' }, standardHeaders: true, legacyHeaders: false });
const validateTokenLimiter = rateLimit({ windowMs: 60_000, max: 30, message: { error: '请求过于频繁' }, standardHeaders: true, legacyHeaders: false });

// ===== 工具 =====
function hashCode(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function hashPhone(phone) {
  if (!phone) return null;
  return crypto.createHash('sha256').update('pickupapp-phone-salt:' + phone).digest('hex');
}
function now() { return Math.floor(Date.now() / 1000); }

function generateCode(tier) {
  const prefix = { monthly: 'PM', yearly: 'PY', lifetime: 'PF' }[tier];
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let core = '';
  for (let i = 0; i < 16; i++) core += chars[Math.floor(Math.random() * chars.length)];
  return `PICKUP-${prefix}-${core.slice(0,4)}-${core.slice(4,8)}-${core.slice(8,12)}-${core.slice(12,16)}`;
}

function signToken(tier, codeHash, deviceId, phone) {
  return jwt.sign({ tier, sub: codeHash, dvc: deviceId || 'unknown', phn: hashPhone(phone) || '', iat: now(), iss: 'pickupapp-pro' }, PRIVATE_KEY, { algorithm: 'RS256', expiresIn: JWT_EXPIRY });
}

function calcExpiry(tier) {
  const dur = { monthly: 31 * 86400, yearly: 366 * 86400, lifetime: 0 }[tier];
  return dur > 0 ? now() + dur : 0;
}

// ============================================================
// 路由
// ============================================================

/**
 * POST /api/verify
 * 验证激活码 + 自动绑定会员到云端
 * Body: { code, deviceId?, phone? }
 */
app.post('/api/verify', verifyLimiter, (req, res) => {
  try {
    const { code, deviceId, phone } = req.body;
    if (!code || typeof code !== 'string' || code.trim().length < 16) {
      return res.json({ valid: false, reason: 'INVALID_FORMAT' });
    }

    const trimmed = code.trim().toUpperCase();
    const codeHash = hashCode(trimmed);

    // 防重放
    const existing = db.prepare('SELECT * FROM used_codes WHERE code_hash = ?').get(codeHash);
    if (existing) {
      return res.json({ valid: false, reason: 'ALREADY_USED', message: '该激活码已被使用' });
    }

    // 格式
    const match = trimmed.match(/^PICKUP-(PM|PY|PF)-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    if (!match) return res.json({ valid: false, reason: 'INVALID_FORMAT' });

    const tierMap = { PM: 'monthly', PY: 'yearly', PF: 'lifetime' };
    const tier = tierMap[match[1]];

    // 记入 used_codes
    db.prepare('INSERT INTO used_codes (code_hash, tier, activated_at, device_id, phone_hash, ip) VALUES (?,?,?,?,?,?)')
      .run(codeHash, tier, now(), deviceId || null, hashPhone(phone), req.ip);

    // 签发 JWT
    const token = signToken(tier, codeHash, deviceId, phone);
    const expiresAt = calcExpiry(tier);

    // 云端绑定会员
    if (deviceId) {
      db.prepare(`INSERT OR REPLACE INTO memberships (device_id, phone_hash, tier, activated_at, expires_at, token, synced_at) VALUES (?,?,?,?,?,?,?)`)
        .run(deviceId, hashPhone(phone), tier, now(), expiresAt, token, now());
    }

    return res.json({
      valid: true, tier, token, activatedAt: now() * 1000,
      expiresAt: expiresAt > 0 ? expiresAt * 1000 : 0,
    });
  } catch (e) {
    console.error('[verify]', e.message);
    return res.status(500).json({ valid: false, reason: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/sync-membership
 * 客户端同步会员状态到云端（用于已有Token的设备）
 * Body: { deviceId, phone?, tier, activatedAt, expiresAt, token }
 */
app.post('/api/sync-membership', syncLimiter, (req, res) => {
  try {
    const { deviceId, phone, tier, activatedAt, expiresAt, token } = req.body;
    if (!deviceId || !tier || !token) {
      return res.json({ ok: false, reason: 'MISSING_FIELDS' });
    }

    // 验证 JWT
    let decoded;
    try { decoded = jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] }); }
    catch { return res.json({ ok: false, reason: 'INVALID_TOKEN' }); }

    db.prepare(`INSERT OR REPLACE INTO memberships (device_id, phone_hash, tier, activated_at, expires_at, token, synced_at) VALUES (?,?,?,?,?,?,?)`)
      .run(deviceId, hashPhone(phone), decoded.tier, decoded.iat, expiresAt || 0, token, now());

    return res.json({ ok: true, syncedAt: Date.now() });
  } catch (e) {
    console.error('[sync]', e.message);
    return res.status(500).json({ ok: false, reason: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/restore-membership
 * 换手机 / 清数据后恢复会员
 * Body: { deviceId, phone? }
 * 返回: 最近绑定的会员信息 + JWT
 */
app.post('/api/restore-membership', syncLimiter, (req, res) => {
  try {
    const { deviceId, phone } = req.body;
    if (!deviceId && !phone) {
      return res.json({ found: false, reason: 'NEED_DEVICE_OR_PHONE' });
    }

    // 用 deviceId 或 phone_hash 查找
    let row;
    if (phone) {
      row = db.prepare('SELECT * FROM memberships WHERE phone_hash = ? ORDER BY synced_at DESC LIMIT 1').get(hashPhone(phone));
    }
    if (!row && deviceId) {
      row = db.prepare('SELECT * FROM memberships WHERE device_id = ?').get(deviceId);
    }
    if (!row) return res.json({ found: false, reason: 'NO_MEMBERSHIP' });

    // 检查是否过期
    if (row.expires_at > 0 && row.expires_at < now()) {
      return res.json({ found: false, reason: 'EXPIRED', tier: row.tier, expiredAt: row.expires_at * 1000 });
    }

    // 更新 device_id（换机场景）
    if (deviceId && deviceId !== row.device_id) {
      db.prepare('UPDATE memberships SET device_id = ?, synced_at = ? WHERE device_id = ?')
        .run(deviceId, now(), row.device_id);
    }

    return res.json({
      found: true,
      tier: row.tier,
      activatedAt: row.activated_at * 1000,
      expiresAt: row.expires_at > 0 ? row.expires_at * 1000 : 0,
      token: row.token,
    });
  } catch (e) {
    console.error('[restore]', e.message);
    return res.status(500).json({ found: false, reason: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/membership/:deviceId
 * 查询云端会员状态
 */
app.get('/api/membership/:deviceId', membershipLimiter, (req, res) => {
  try {
    const row = db.prepare('SELECT tier, activated_at, expires_at, synced_at FROM memberships WHERE device_id = ?').get(req.params.deviceId);
    if (!row) return res.json({ active: false });
    const expired = row.expires_at > 0 && row.expires_at < now();
    return res.json({
      active: !expired,
      tier: row.tier,
      activatedAt: row.activated_at * 1000,
      expiresAt: row.expires_at > 0 ? row.expires_at * 1000 : 0,
      expired,
    });
  } catch (e) {
    console.error('[membership]', e.message);
    return res.status(500).json({ active: false, error: '服务器错误，请稍后重试' });
  }
});

/**
 * POST /api/validate-token
 * 验证 JWT 是否仍有效
 */
app.post('/api/validate-token', validateTokenLimiter, (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.json({ valid: false, reason: 'MISSING_TOKEN' });
    const decoded = jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] });
    return res.json({ valid: true, tier: decoded.tier, activatedAt: decoded.iat * 1000 });
  } catch (e) {
    return res.json({ valid: false, reason: e.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN' });
  }
});

/** GET /api/public-key */
app.get('/api/public-key', (req, res) => res.json({ publicKey: PUBLIC_KEY }));

/** POST /api/admin/generate (管理端) */
app.post('/api/admin/generate', (req, res) => {
  if (req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) return res.status(401).json({ error: '未授权' });
  const { tier, count = 1 } = req.body;
  if (!['monthly', 'yearly', 'lifetime'].includes(tier)) return res.status(400).json({ error: '无效等级' });
  const codes = [];
  for (let i = 0; i < Math.min(count, 100); i++) codes.push(generateCode(tier));
  return res.json({ tier, count: codes.length, codes });
});

/** GET /api/admin/stats */
app.get('/api/admin/stats', (req, res) => {
  if (req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) return res.status(401).json({ error: '未授权' });
  const byTier = db.prepare('SELECT tier, COUNT(*) as cnt FROM memberships GROUP BY tier').all()
    .reduce((a, r) => ({ ...a, [r.tier]: r.cnt }), {});
  const total = db.prepare('SELECT COUNT(*) as cnt FROM memberships').get().cnt;
  const used = db.prepare('SELECT COUNT(*) as cnt FROM used_codes').get().cnt;
  return res.json({ activeMembers: total, byTier, totalCodesUsed: used });
});

// ===== 启动 =====
app.listen(PORT, () => {
  console.log(`[取件通Pro v2] 服务已启动，端口: ${PORT}`);
});
