// ============================================================
// 取件通 Pro · RSA 密钥对生成工具
//
// 用法：node generate-keys.js
// 输出：在 server/.env 文件中写入 JWT_PRIVATE_KEY 和 JWT_PUBLIC_KEY
//
// ⚠️ 安全提醒：
//   1. 生成的私钥绝对不能提交到 Git
//   2. 将 .env 文件加入 .gitignore
//   3. 生产环境使用保管服务（如 AWS Secrets Manager）管理密钥
// ============================================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('[取件通Pro] 正在生成 RSA 2048 密钥对...\n');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// 去掉换行，方便写入 .env（单行 base64）
const privB64 = Buffer.from(privateKey).toString('base64');
const pubB64 = Buffer.from(publicKey).toString('base64');

const envPath = path.join(__dirname, '.env');
const envContent = [
  '# 取件通 Pro · 环境变量',
  '# 由 generate-keys.js 自动生成',
  '',
  '# RSA 2048 私钥（base64编码）— 绝！对！不！要！泄露！',
  `JWT_PRIVATE_KEY=${privB64}`,
  '',
  '# RSA 2048 公钥（base64编码）',
  `JWT_PUBLIC_KEY=${pubB64}`,
  '',
  '# 管理端 Token（自行修改为随机字符串）',
  '# 生成方式：node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  'ADMIN_TOKEN=',
  '',
].join('\n');

fs.writeFileSync(envPath, envContent, 'utf-8');
console.log(`✅ 密钥对已写入 ${envPath}`);
console.log('⚠️  请立即执行以下操作：');
console.log('   1. 设置 ADMIN_TOKEN（用强随机字符串）');
console.log('   2. 确保 .env 已加入 .gitignore');
console.log('   3. 备份私钥到安全位置\n');
