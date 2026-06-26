# 会员系统 & 激活码系统 — 设计研究文档

> 取件通 Pro v2.1 | 2026-06-04
> 目标：两条通道（在线支付 + 激活码）均可开通会员，体系自洽、安全可演进

---

## 1. 现状诊断

### 1.1 当前架构

```
┌──────────────────────────────────────────────────────────────┐
│                     客户端 (Expo/RN)                          │
│                                                              │
│  activate.tsx ◄──── 支付通道 ────► 支付宝/微信 deeplink       │
│       │                         (固定收款账户)                 │
│       │                         + SMS 监听等支付通知           │
│       │                                                     │
│       ├──── 激活码通道 ────► pro-activation.ts                │
│       │                    本地 HASH 验证 (50K 迭代)          │
│       │                    远端 verify API (未启用)           │
│       │                                                     │
│       └──── settings-store.ts ──── 会员持久化 + 防篡改签名    │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                 服务端 (Node.js Express)                       │
│                                                              │
│  POST /api/verify             激活码验证 + 设备绑定            │
│  POST /api/sync-membership    会员云端同步                    │
│  POST /api/restore-membership 换机恢复                        │
│  GET  /api/membership/:did    查询状态                        │
│  POST /api/validate-token     JWT 校验                        │
│  POST /api/admin/generate     管理端生成激活码                │
│                                                              │
│  存储: SQLite (used_codes + memberships)                     │
│  签名: RSA 2048 JWT                                          │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 已识别问题

| # | 问题 | 严重程度 | 根因 |
|---|------|----------|------|
| P1 | 支付通道不可靠 | **高** | SMS 监听不稳定，银行短信格式多变，无回调确认 |
| P2 | 激活码生成与验证脱节 | **高** | server 生成随机码，client 用 hash 验证，两套机制不互通 |
| P3 | 服务端 API 未启用 | **中** | 客户端代码注释"云服务未部署"，实际只走本地验证 |
| P4 | 无真实支付网关 | **中** | 仅 deeplink 跳转，无支付回调，无法自动化 |
| P5 | 设备绑定脆弱 | **低** | 设备盐存 SharedPreferences，清数据丢失 |
| P6 | 会员恢复路径不完整 | **低** | 云端恢复仅支持 phone/deviceId，无账号体系 |

---

## 2. 目标架构

### 2.1 核心原则

1. **激活码是唯一可信的会员凭证**。支付通道的本质是"用钱买激活码"。
2. **服务端是唯一权威**。所有激活码验证必须经过服务端，取消客户端本地验证。
3. **激活码与会员一一绑定**。一个码 → 一次激活 → 单一设备/手机号 → 不可转让。
4. **两条通道统一到激活码**。支付成功后服务端签发激活码，和直接使用激活码走同一条验证链路。

### 2.2 新架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户入口                              │
│                                                             │
│   ┌──────────┐                    ┌──────────────┐          │
│   │ 在线支付  │                    │  输入激活码   │          │
│   └────┬─────┘                    └──────┬───────┘          │
│        │                                 │                  │
│        v                                 │                  │
│  ┌─────────────────┐                     │                  │
│  │ 支付平台回调     │                     │                  │
│  │ (Alipay/WeChat)  │                     │                  │
│  └────────┬────────┘                     │                  │
│           │                              │                  │
│           v                              v                  │
│  ┌─────────────────────────────────────────────────┐       │
│  │              POST /api/verify                    │       │
│  │     (支付回调返回激活码 OR 用户输入激活码)         │       │
│  └──────────────────────┬──────────────────────────┘       │
│                         │                                   │
│                         v                                   │
│  ┌─────────────────────────────────────────────────┐       │
│  │          服务端验证 + 签发 JWT                     │       │
│  │    · 防重放 (used_codes)                          │       │
│  │    · 设备绑定 (device_id)                          │       │
│  │    · 手机号绑定 (phone_hash, 可选)                  │       │
│  │    · 签发 RSA JWT → 客户端持久化                    │       │
│  └──────────────────────┬──────────────────────────┘       │
│                         │                                   │
│                         v                                   │
│  ┌─────────────────────────────────────────────────┐       │
│  │          客户端本地激活                           │       │
│  │    · 保存 JWT                                     │       │
│  │    · 写入 Membership (settings-store)              │       │
│  │    · 启动定期云端校验 (每 24h)                      │       │
│  └─────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 会员等级设计

### 3.1 等级定义（保持现有，微调）

| 等级 | 价格 | 有效期 | 排名 | 定位 |
|------|------|--------|------|------|
| 月度VIP `monthly` | ¥3.99 | 31天 | 1 | 试用体验 / 短期需求 |
| 年度VIP `yearly` | ¥29.90 | 366天 | 2 | 主力套餐，日均 ¥0.08 |
| 永久VIP `lifetime` | ¥68.00 | 永久 | 3 | 忠实用户 / 活动赠送 |

### 3.2 等级保护规则（保持现有）

```
规则 1: 升级允许 (monthly → yearly → lifetime)
规则 2: 降级拒绝 (yearly → monthly ❌)
规则 3: 同等级续费 → 弹窗确认 → 叠加时长
规则 4: 过期后 → 任意等级重新激活
规则 5: 永久会员 → 不可被任何等级覆盖
```

### 3.3 Pro 权益定义

| 权益 | 免费版 | Pro |
|------|--------|-----|
| 包裹数量 | 5个 | 无限 |
| SMS自动识别 | ✓ | ✓ |
| 通知监听 | ✓ | ✓ |
| OCR截图识别 | ✓ | ✓ |
| 手动录入 | ✓ | ✓ |
| 深色主题 | ✓ | ✓ |
| 大字模式 | ✓ | ✓ |
| 数据导出(完整) | 受限 | ✓ |
| 桌面挂件 | — | ✓ (v2.0) |
| GPS地理围栏 | — | ✓ |
| 云同步 | — | ✓ (v2.0) |
| 家庭共享 | — | ✓ (v2.0) |

---

## 4. 激活码系统设计

### 4.1 激活码生命周期

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  生成     │───▶│  分发     │───▶│  验证     │───▶│  绑定     │
│ (服务端)  │    │ (渠道)    │    │ (唯一)    │    │ (设备)    │
└──────────┘    └──────────┘    └──────────┘    └──────────┘

生成: 管理员通过 POST /api/admin/generate 批量生成
分发: 客服微信 / 内测活动 / 支付回调自动发放
验证: POST /api/verify (必须联网，不再本地验证)
绑定: 激活码与 deviceId + phone_hash 关联，防止复用
```

### 4.2 激活码格式

```
PICKUP-{TIER}-{16位随机字符}

示例:
PICKUP-PM-A3B7-C9D2-E1F5-H8K4  (月度)
PICKUP-PY-X2N6-M8Q1-R4T7-W9V3  (年度)
PICKUP-PF-Z5L8-J1P6-S3U9-B0Y7  (永久)

格式规则:
- 固定前缀: PICKUP
- 等级前缀: PM (Monthly) / PY (Yearly) / PF (Forever)
- 核心码: 16位 [0-9A-Z] (排除 I/O/0/O 混淆字符)
- 分隔符: 连字符，4位一组
- 总数空间: 34^16 ≈ 3.1×10^24 (足够)
```

### 4.3 激活码验证流程 (新)

```
客户端                          服务端
  │                               │
  │  POST /api/verify              │
  │  { code, deviceId, phone? }   │
  │ ─────────────────────────────▶│
  │                               │ 
  │                          ┌────▼──────────────────┐
  │                          │ 1. 格式校验            │
  │                          │    PICKUP-PM/PY/PF-...│
  │                          │                       │
  │                          │ 2. 防重放检查          │
  │                          │    SELECT used_codes   │
  │                          │    WHERE code_hash=?   │
  │                          │                       │
  │                          │ 3. 格式解析            │
  │                          │    提取 tier           │
  │                          │                       │
  │                          │ 4. 核销登记            │
  │                          │    INSERT used_codes   │
  │                          │                       │
  │                          │ 5. 签发 JWT (RSA)      │
  │                          │    {tier, deviceId,   │
  │                          │     phoneHash, iat}    │
  │                          │                       │
  │                          │ 6. 云端绑定            │
  │                          │    UPSERT memberships  │
  │                          └────────────────────────┘
  │                               │
  │  { valid, tier, token,       │
  │    activatedAt, expiresAt }   │
  │ ◀─────────────────────────────│
  │                               │
  │  保存 token 到本地             │
  │  settings-store.activate()    │
  │                               │
```

### 4.4 放弃本地验证的理由

- 本地 HASH 验证 (`pro-activation.ts`) 和服务端随机码生成 (`server/generate-code.js`) 是两套不互通的机制
- 本地验证意味着激活码必须预埋，无法动态管理
- 所有商业化的激活码系统都是服务端验证的
- 离线场景极少（用户必须有网络才能收到验证结果）
- 保留本地验证作为**降级方案**（服务端不可用时，允许使用预埋码，标记为"离线模式"）

---

## 5. 支付通道设计

### 5.1 策略：从"转账监听"升级为"支付网关"

```
当前方案 (v2.0)                 目标方案 (v2.1)
─────────────────────        ─────────────────────
deeplink → 转账App           deeplink → 支付网关 → 回调 → 自动签发激活码
SMS 监听等通知 ❌              服务端接收支付回调 ✅
延迟几分钟～永不触发           秒级确认
金额匹配不可靠                 支付平台验证可靠
```

### 5.2 分阶段实施

**Phase A: 手动确认 + 激活码发放 (短期，立即可用)**

```
用户点击"支付宝支付"
  → 跳转支付宝转账页面 (保持现有)
  → 用户完成转账
  → 用户截图发给客服微信 (skyreey)
  → 客服在管理端生成激活码
  → 激活码发给用户
  → 用户在 App 输入激活码完成激活
```

**Phase B: 半自动支付确认 (中期，1-2周)**

```
用户点击"支付宝支付"
  → 调用支付宝当面付/PC扫码支付 API
  → 生成收款二维码 (服务端)
  → 用户扫码支付
  → 支付宝异步通知服务端 (notify_url)
  → 服务端核验签名 → 自动生成激活码
  → 推送通知给用户 (App 内)
  → 用户在 App 点击激活
```

**Phase C: 全自动 (远期，需个体户/企业资质)**

```
用户选择方案 → 支付 → 回调 → 自动激活
无需激活码输入环节
```

### 5.3 推荐方案：Phase B (支付宝当面付)

- 个人即可申请 (无需企业资质)
- 支持异步通知回调
- 每笔交易支付宝会 POST 到你的 notify_url
- 手续费 0.6%
- 接入文档: https://opendocs.alipay.com/open/194/105072

### 5.4 Phase A 期间的激活码管理

在 Phase B 上线前，激活码是主要通道。需要：

1. **客服管理端** (`POST /api/admin/generate`) 生成批量码
2. **激活码池** (数据库表 `code_pool`)
   - 状态: `available` → `assigned` → `used`
   - 关联: 分配给的手机号/微信ID
   - 时间戳: 生成时间、分配时间、使用时间
3. **客服工作流**:
   ```
   用户转账截图 → 客服确认到账 → 从码池分配 → 发给用户 → 标记 assigned
   用户激活后 → 自动标记 used
   ```

---

## 6. 数据模型

### 6.1 服务端 (SQLite → 后续迁移 PostgreSQL)

```sql
-- 激活码池
CREATE TABLE code_pool (
  id          TEXT PRIMARY KEY,          -- code_hash
  code        TEXT NOT NULL UNIQUE,      -- PICKUP-XX-XXXX-...
  tier        TEXT NOT NULL,             -- monthly/yearly/lifetime
  status      TEXT NOT NULL DEFAULT 'available',  -- available/assigned/used/revoked
  generated_at INTEGER NOT NULL,
  assigned_to TEXT,                      -- 微信ID/手机号
  assigned_at  INTEGER,
  used_by_device TEXT,
  used_at      INTEGER,
  revoked_at   INTEGER,
  notes        TEXT                      -- 备注
);

-- 已使用激活码 (防重放)
CREATE TABLE used_codes (
  code_hash    TEXT PRIMARY KEY,
  tier         TEXT NOT NULL,
  activated_at INTEGER NOT NULL,
  device_id    TEXT,
  phone_hash   TEXT,
  ip           TEXT
);

-- 会员云端绑定
CREATE TABLE memberships (
  device_id    TEXT NOT NULL,
  phone_hash   TEXT,
  tier         TEXT NOT NULL,
  activated_at INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL DEFAULT 0,
  token        TEXT NOT NULL,
  synced_at    INTEGER NOT NULL,
  PRIMARY KEY (device_id)
);

-- 支付订单 (Phase B)
CREATE TABLE payment_orders (
  order_id     TEXT PRIMARY KEY,
  tier         TEXT NOT NULL,
  amount       REAL NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending/paid/expired/cancelled
  device_id    TEXT,
  phone        TEXT,
  code_assigned TEXT,                    -- 关联的激活码
  created_at   INTEGER NOT NULL,
  paid_at      INTEGER,
  alipay_trade_no TEXT                  -- 支付宝交易号
);
```

### 6.2 客户端 (保持不变)

```typescript
interface Membership {
  active: boolean;
  tier: MembershipTier | null;
  activatedAt: number;
  expiresAt: number;
  method: ActivationMethod | null;   // 'alipay' | 'wechat' | 'code'
  code: string | null;
  token: string | null;              // NEW: 服务端 JWT
  _sig?: string;
}
```

### 6.3 新增 API

```yaml
POST /api/verify:
  description: 激活码验证 (统一入口)
  body: { code, deviceId, phone? }
  response: { valid, tier, token, activatedAt, expiresAt, reason? }

POST /api/verify-with-payment:
  description: 支付回调验证 (Phase B)
  body: { orderId, deviceId, phone? }
  response: { valid, tier, token, activatedAt, expiresAt, code }

POST /api/create-order:
  description: 创建支付订单 (Phase B)
  body: { tier, deviceId }
  response: { orderId, qrCode, amount }

GET /api/check-order/{orderId}:
  description: 查询订单状态 (Phase B)
  response: { status, code? }

POST /api/admin/generate:
  description: 批量生成激活码 (管理端)
  headers: { Authorization: Bearer ADMIN_TOKEN }
  body: { tier, count }
  response: { codes: [...] }

POST /api/admin/generate-for-payment:
  description: 为支付确认批量生成 (管理端, Phase A)
  headers: { Authorization: Bearer ADMIN_TOKEN }
  body: { tier, count, assignedTo }
  response: { codes: [...] }

POST /api/admin/revoke-code:
  description: 撤销激活码
  headers: { Authorization: Bearer ADMIN_TOKEN }
  body: { code }
  response: { ok }
```

---

## 7. 安全加固

### 7.1 当前安全措施 (保留)

- 激活码格式验证 (正则 + 前缀匹配)
- 防重放 (used_codes 表)
- 设备绑定 (deviceId)
- 5 次尝试 / 5 分钟冷却
- 会员签名防篡改 (membershipSign)
- 等级保护 (不可降级)
- RSA 2048 JWT 签名
- 常量时间比较 (防时序攻击)

### 7.2 新增安全措施

```
1. 服务端限速细化:
   - 验证接口: 10次/分钟/IP + 5次/分钟/deviceId
   - 管理端接口: ADMIN_TOKEN 必须通过环境变量，无硬编码

2. 激活码不可逆存储:
   - 数据库只存 SHA256(code)，不存明文
   - 激活码生成后只在内存中返回一次

3. 设备指纹增强:
   - 加入 expo-application 的 androidId / installationId
   - 服务端校验设备指纹一致性 (换设备需手机号验证)

4. JWT 定期刷新:
   - 客户端每 24h 调用 /api/validate-token
   - 过期前 7 天自动续签

5. 异常检测:
   - 同一设备频繁尝试不同激活码 → 临时封禁
   - 同一 IP 大量验证请求 → 触发告警
```

### 7.3 八卦编码层 (保留，降低优先级)

当前 `bagua-codec.ts` 是一层混淆编码，而非安全层。它增加了逆向难度但对实际安全贡献有限。建议：

- **保留作为混淆层** (不影响主流程)
- **不依赖八卦编码做安全判断**
- **安全依赖放在 RSA + JWT + HTTPS 上**

---

## 8. 实施路线

```
Phase 1: 修复激活码验证链路 (1-2天)
├── 统一客户端验证: 全部走 POST /api/verify
├── 移除客户端本地 HASH 验证
├── 保留离线降级 (预埋码)
├── 更新 activate.tsx 流程

Phase 2: 激活码管理端 (1天)
├── 新增 code_pool 表 + API
├── 客服分配码流程 (generate → assign → 发给用户)
├── 撤销码支持

Phase 3: Phase A 支付确认流 (0.5天)
├── 更新支付页面文案 (引导加客服微信)
├── 客服管理端: generate-for-payment API
├── 用户手动输入激活码完成闭环

Phase 4: Phase B 半自动支付 (3-5天)
├── 支付宝当面付集成
├── notify_url 异步回调
├── 自动签发激活码
├── App 内支付状态展示

Phase 5: 全自动支付 (远期)
├── 支付 → 自动激活
├── 移除激活码输入环节 (仅保留作为赠送/活动通道)
```

---

## 9. 关键决策点

| 决策 | 推荐 | 理由 |
|------|------|------|
| 验证走本地还是服务端 | **服务端** | 本地验证和远程生成不互通，必须统一 |
| 保留离线验证吗 | **是**，作为降级 | 预埋 5 个永久码，仅在服务端不可用时使用 |
| 支付走阶段几 | **Phase A 立刻 → Phase B 尽快** | Phase B 需要支付宝审核，Phase A 作为过渡 |
| 八卦编码是否保留 | **保留但不依赖** | 作为混淆层无伤大雅，但安全不依赖它 |
| 会员数据存哪里 | **本地为主，云端同步** | 离线优先，云端用作备份/恢复 |

---

## 10. 总结

当前系统有扎实的基础，核心问题在于**两条通道的实现不一致**：

- 支付通道依赖不可靠的 SMS 监听
- 激活码通道服务端和客户端使用两套验证机制

**核心修改**：
1. 统一激活码验证到服务端 `POST /api/verify`
2. 支付通道也回归到"用钱买激活码"的模型
3. 短期用手动确认过渡，中期接入支付宝当面付

修改范围：
- `pro-activation.ts`: 移除本地 HASH 验证，改为调用 `remote-activation.ts`
- `server/index.js`: 新增 code_pool 表 + 管理 API
- `activate.tsx`: 优化支付流程文案，引导 Phase A 流程
- 新增 `docs/Membership_Activation_Design.md` (本文件)
