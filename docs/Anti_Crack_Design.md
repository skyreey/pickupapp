# 取件通 — 防破解体系设计

> 以"易经八卦"为编码层，以密码学为安全基座，构建多层防破解体系

---

## 一、设计哲学：以道驭术

```
道（策略层）：让破解成本 > 破解收益
├── 八卦编码：文化混淆，让逆向者"看不懂"
├── 密码学签名：数学保证，让伪造"做不了"
└── 多层校验：纵深防御，让绕过"绕不完"

术（实现层）：
├── 层0：八卦编码混淆 → 激活码不再是一串字母数字
├── 层1：RSA非对称签名 → 服务端签发，客户端验证
├── 层2：运行时完整性校验 → 检测dex/so篡改
├── 层3：反调试检测 → 检测Frida/Xposed/root
└── 层4：时间漂移检测 → 检测系统时间篡改
```

---

## 二、八卦编码体系

### 2.1 八卦基础映射

```
八卦（3位二进制，8个值）：

☰ 乾 (111 = 7)  ☱ 兑 (110 = 6)  ☲ 离 (101 = 5)  ☳ 震 (100 = 4)
☴ 巽 (011 = 3)  ☵ 坎 (010 = 2)  ☶ 艮 (001 = 1)  ☷ 坤 (000 = 0)

先天八卦序数：乾1 兑2 离3 震4 巽5 坎6 艮7 坤8
后天八卦方位：离南坎北 震东兑西 乾西北坤西南 艮东北巽东南
```

### 2.2 64卦编码表（6位二进制 → 卦象）

64卦由上下两个三爻卦组成，可编码6位数据（0-63），覆盖所有Base64字符。

```
上卦\下卦   ☰乾     ☱兑     ☲离     ☳震     ☴巽     ☵坎     ☶艮     ☷坤
☰乾       乾为天   泽天夬   火天大有 雷天大壮 风天小畜 水天需   山天大畜 地天泰
          00       01       02       03       04       05       06       07

☱兑       天泽履   兑为泽   火泽睽   雷泽归妹 风泽中孚 水泽节   山泽损   地泽临
          08       09       0A       0B       0C       0D       0E       0F

☲离       天火同人 泽火革   离为火   雷火丰   风火家人 水火既济 山火贲   地火明夷
          10       11       12       13       14       15       16       17

☳震       天雷无妄 泽雷随   火雷噬嗑 震为雷   风雷益   水雷屯   山雷颐   地雷复
          18       19       1A       1B       1C       1D       1E       1F

☴巽       天风姤   泽风大过 火风鼎   雷风恒   巽为风   水风井   山风蛊   地风升
          20       21       22       23       24       25       26       27

☵坎       天水讼   泽水困   火水未济 雷水解   风水涣   坎为水   山水蒙   地水师
          28       29       2A       2B       2C       2D       2E       2F

☶艮       天山遁   泽山咸   火山旅   雷山小过 风山渐   水山蹇   艮为山   地山谦
          30       31       32       33       34       35       36       37

☷坤       天地否   泽地萃   火地晋   雷地豫   风地观   水地比   山地剥   坤为地
          38       39       3A       3B       3C       3D       3E       3F
```

### 2.3 64卦名简称映射（用于激活码显示）

激活码最终展示为用户可见的卦象名称序列，例如：

```
内部二进制:  011010 110101 001111 ...
映射为卦名:  水天需 火泽睽 地山谦 ...
展示激活码:  需-睽-谦-...
```

---

## 三、激活码防破解方案（密码学 + 八卦）

### 3.1 方案对比

| 方案 | 原理 | 防破解等级 | 离线可用 |
|------|------|-----------|----------|
| **旧方案** | 固定密钥HMAC + 校验和 | ⭐ 弱（密钥在客户端） | ✅ |
| **八卦方案** | RSA签名 + 八卦编码混淆 | ⭐⭐⭐ 强 | ❌（需联网验证） |
| **混合方案** | 在线RSA验证 + 离线八卦HMAC兜底 | ⭐⭐⭐ 强 | ✅ 离线也可用 |

**推荐：混合方案** — 优先在线RSA验证，网络不可用时降级为八卦编码的离线校验。

### 3.2 激活码格式设计

```
激活码结构（24字符 → 8个卦象）：

┌──────────────┬──────────────┬──────────────┬──────────────┐
│  版本标识     │  设备指纹     │  有效期       │  RSA签名      │
│  1字节(2卦)  │  6字节(12卦)  │  2字节(4卦)   │  3字节(6卦)   │
│  固定: 乾乾   │  deviceId    │  到期时间偏移  │  签名的前3字节 │
│              │  的SHA256     │  距2026-01-01 │  八卦编码      │
│              │  前6字节      │  的天数(八卦)  │               │
└──────────────┴──────────────┴──────────────┴──────────────┘

展示格式：乾为天·水雷屯·火泽睽·地山谦·...
（用卦象名称代替字母数字，逆向者看到的是"算命的"）
```

### 3.3 服务端签发流程

```javascript
// server/generate-code-v2.js
function generateActivationCode(deviceId, tier, daysValid) {
  // 1. 设备指纹 → SHA256 → 取前6字节
  const deviceHash = sha256(deviceId).slice(0, 6);

  // 2. 有效期 → 距基准日天数 → 2字节
  const expireDays = daysFromBase(Date.now() + daysValid * 86400000);

  // 3. 组装12字节payload → 八卦编码
  const payload = concatBytes(deviceHash, expireDays);
  const guaPayload = encodeToGua(payload); // 八卦编码

  // 4. RSA签名payload → 取前3字节 → 八卦编码
  const signature = rsaSign(privateKey, payload);
  const guaSignature = encodeToGua(signature.slice(0, 3));

  // 5. 组合 → 完整激活码
  return [
    VERSION_GUA,           // 版本标识
    ...guaPayload,         // 载荷
    ...guaSignature,       // 签名
  ].join('·');             // 卦名用·分隔
}
```

### 3.4 客户端验证流程

```typescript
// src/services/activation-verify-v2.ts
function verifyActivationCode(code: string, deviceId: string): VerifyResult {
  // 1. 解析卦象 → 字节
  const parts = parseGuaCode(code);
  if (!parts) return { valid: false, reason: 'FORMAT_INVALID' };

  // 2. 提取版本 → 校验
  if (parts.version !== CURRENT_VERSION) {
    return { valid: false, reason: 'VERSION_MISMATCH' };
  }

  // 3. 提取设备指纹 → 比对
  const expectedDeviceHash = sha256(deviceId).slice(0, 6);
  if (!timingSafeEqual(parts.deviceHash, expectedDeviceHash)) {
    return { valid: false, reason: 'DEVICE_MISMATCH' };
  }

  // 4. 提取有效期 → 校验
  if (parts.expireDays < daysFromBase(Date.now())) {
    return { valid: false, reason: 'EXPIRED' };
  }

  // 5. RSA签名验证（联网时）
  if (isNetworkAvailable()) {
    return remoteVerifyRsaSignature(code, deviceId);
  }

  // 6. 离线降级：本地公钥验证签名
  const payload = concatBytes(parts.deviceHash, parts.expireBytes);
  if (!rsaVerify(publicKey, payload, parts.signature)) {
    return { valid: false, reason: 'SIGNATURE_INVALID' };
  }

  return { valid: true, tier: parts.tier, expiresAt: parts.expiresAt };
}
```

---

## 四、运行时防篡改（八卦 + 密码学）

### 4.1 多层校验链

```
App启动
  │
  ├── 层0：反调试检测
  │   ├── 检测 ptrace (TracerPid)
  │   ├── 检测 Frida 端口 (27042/27043)
  │   ├── 检测 Xposed 特征文件
  │   └── 检测 Magisk/Root
  │        ↓ 检测到 → 八卦混淆的退出码（不易搜索到）
  │
  ├── 层1：APK签名校验
  │   └── 对比当前签名SHA256 vs 硬编码值（八卦编码存储）
  │        ↓ 不匹配 → 功能降级/静默退出
  │
  ├── 层2：代码完整性校验
  │   ├── dex classes.dex 的SHA256
  │   └── 关键so库的SHA256
  │        ↓ 不匹配 → 功能降级
  │
  └── 层3：运行环境校验
      ├── 系统时间 vs NTP时间（偏移>24h → 异常）
      ├── 模拟器检测
      └── VPN/代理检测
```

### 4.2 八卦混淆技术

```typescript
// 方案1：敏感字符串八卦编码存储
// 不存 "https://api.pickupapp.com/verify"
// 而存其64卦编码的字节数组，运行时解码

const GUA_ENCODED_URL = [
  '水天需', '火泽睽', '地山谦', '雷火丰',  // "http"
  '乾为天', '泽天夬', '风火家人', '山雷颐',  // "s://"
  // ... 完整URL
];

function decodeGuaString(guaNames: string[]): string {
  return guaNames
    .map(g => GUA_TO_BYTE[g])    // 卦名 → 字节
    .map(b => String.fromCharCode(b)) // 字节 → 字符
    .join('');
}

// 方案2：控制流八卦化
// 将简单的 if-else 展开为64卦查表跳转
// 让静态分析工具难以还原原始逻辑

const FLOW_TABLE: Record<string, () => void> = {
  '乾为天': () => { /* 正常激活流程 */ },
  '泽天夬': () => { /* 联网验证 */ },
  '火天大有': () => { /* 离线验证 */ },
  // ... 64个条目，只有几个是真正的执行路径
  // 其余都是虚假分支（跳转到同样的错误退出）
};

// 方案3：八卦密钥派生
// 不直接存储密钥，而是通过八卦变换生成
function deriveKey(guaSequence: string): Uint8Array {
  const trigrams = parseTrigrams(guaSequence);
  let key = new Uint8Array(32);

  for (let i = 0; i < key.length; i++) {
    // 使用先天八卦数 + 后天八卦方位 混合运算
    const xianTian = trigrams[i % trigrams.length].xianTianValue; // 1-8
    const houTian = trigrams[i % trigrams.length].houTianDirection; // 方位角度

    // 混合：先天数 × 后天方位角 + 五行生克偏移
    key[i] = (xianTian * 31 + houTian * 17 + WU_XING_SHIFT[i % 5]) & 0xFF;
  }

  return key;
}
```

### 4.3 五行生克校验

```
五行相生：木→火→土→金→水→木
五行相克：木→土→水→火→金→木

激活码的每个段隐含一个五行属性，客户端验证时必须满足相生关系：

激活码段：  [段1:木] → [段2:火] → [段3:土] → [段4:金] → [段5:水]
校验规则：  段2必须生段3?  段3必须生段4?  ...
           （实际上是字节序列的数学约束，但代码看起来像"五行验证"）
```

---

## 五、完整激活流程（八卦版）

```
用户购买 → 获得激活码（如"需·睽·谦·丰·无妄"）
         ↓
打开取件通 → Pro页面 → 输入卦象激活码
         ↓
客户端解析：
  1. 卦象名 → 字节数组（查64卦表）
  2. 提取版本号 → 校验
  3. 提取设备指纹 → SHA256比对当前设备
  4. 提取有效期 → 比对当前时间
         ↓
联网验证（优先）：
  → POST /api/verify-v2
  → 服务端RSA签名验证
  → 返回 { valid: true, tier, expiresAt }
         ↓
离线验证（降级）：
  → 本地RSA公钥验证签名
  → 通过 → 存储激活状态
         ↓
激活成功 → 写入加密的Membership到KeyStore
         ↓
每次启动：
  → KeyStore读取Membership
  → 八卦解码 → 验证签名 → 验证有效期
  → 通过 → Pro功能启用
```

---

## 六、实施优先级

| 优先级 | 组件 | 复杂度 | 防破解效果 |
|--------|------|--------|-----------|
| P0 | 修复CRITICAL #1（移除debug自动激活） | 低 | 立即阻止白嫖 |
| P0 | RSA签名激活码（替换固定密钥HMAC） | 中 | 彻底消除客户端密钥泄露 |
| P1 | 64卦编码激活码展示 | 中 | 增加逆向难度 |
| P1 | 敏感字符串八卦编码存储 | 低 | 增加静态分析难度 |
| P2 | 反调试检测（Frida/Xposed） | 中 | 阻止动态调试 |
| P2 | APK签名校验 | 中 | 阻止重打包 |
| P3 | 控制流八卦混淆 | 高 | 高级保护 |
| P3 | 虚拟化关键代码段 | 高 | 专业级保护 |

---

## 七、八卦编码工具库

在项目中实现 `src/utils/bagua-codec.ts`：

```typescript
// 八卦基础类型
type Trigram = '☰' | '☱' | '☲' | '☳' | '☴' | '☵' | '☶' | '☷';
type GuaName = '乾' | '兑' | '离' | '震' | '巽' | '坎' | '艮' | '坤';

// 八卦 → 3位二进制值
const TRIGRAM_TO_VALUE: Record<Trigram, number> = {
  '☰': 7, '☱': 6, '☲': 5, '☳': 4,
  '☴': 3, '☵': 2, '☶': 1, '☷': 0,
};

// 64卦名 → 6位值 (0-63)
const HEXAGRAM_TO_BYTE: Record<string, number> = {
  '乾为天': 0x00, '泽天夬': 0x01, '火天大有': 0x02, '雷天大壮': 0x03,
  '风天小畜': 0x04, '水天需': 0x05, '山天大畜': 0x06, '地天泰': 0x07,
  // ... 全部64卦
  '天地否': 0x38, '泽地萃': 0x39, '火地晋': 0x3A, '雷地豫': 0x3B,
  '风地观': 0x3C, '水地比': 0x3D, '山地剥': 0x3E, '坤为地': 0x3F,
};

// 编码：字节数组 → 卦象名称数组
export function encodeToGua(bytes: Uint8Array): string[] { ... }

// 解码：卦象名称数组 → 字节数组
export function decodeFromGua(guaNames: string[]): Uint8Array { ... }

// 密钥派生：八卦序列 → 32字节密钥
export function deriveBaguaKey(seed: string): Uint8Array { ... }
```

---

> **核心思想**：让逆向者看到的不是 `if (signature === expected)`，而是 `if (checkWuXingBalance(guaSeq))` —— 代码看起来像算命程序，实际上执行的是密码学验证。
