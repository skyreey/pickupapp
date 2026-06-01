/**
 * 取件通 Pro 自助支付服务
 * ================================================================
 * 支付渠道：PayJS (payjs.cn) — 个人可注册，微信/支付宝扫码，免营业执照
 * 部署平台：阿里云函数计算 FC 或 Vercel（免费）
 *
 * === 阿里云部署 ===
 * 1. 开通 函数计算FC (https://fc.console.aliyun.com)
 * 2. 创建函数：HTTP触发器 → Node.js 18 → 上传此文件
 * 3. 设置环境变量：PAYJS_MCHID、PAYJS_KEY
 * 4. 得到公网URL：https://xxx.cn-hangzhou.fc.aliyuncs.com
 *
 * === Vercel 部署（更简单） ===
 * 1. npm install -g vercel
 * 2. vercel login && vercel deploy scripts/payment-worker.js
 * 3. 设置环境变量：vercel env add PAYJS_MCHID
 *
 * === 注册 PayJS ===
 * 1. https://payjs.cn → 个人注册 → 实名认证（微信扫码）
 * 2. 获取：商户号(mchid) + 密钥(key)
 * 3. 费率 0.38%，微信/支付宝通用
 *
 * 用户流程：
 *   App → 选方案 → /api/create-order → WebView显示扫码页
 *   → 用户微信/支付宝扫码 → PayJS回调 /api/notify
 *   → Worker生成激活码 → 存入 → 页面自动显示激活码
 * ================================================================
 */

// 定价（分）
const TIERS = {
  yearly:  { name: '年付会员', price: 2990 },
  monthly: { name: '月付会员', price: 399 },
  lifetime:{ name: '永久买断', price: 6800 },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    // ================================================================
    // 1. 创建订单 → 返回 PayJS 支付链接
    // GET /api/create-order?tier=yearly
    // ================================================================
    if (path === '/api/create-order') {
      const tier = url.searchParams.get('tier') || 'yearly';
      const plan = TIERS[tier];
      if (!plan) return json({ error: '无效方案' }, 400, corsHeaders);

      const orderId = `PICKUP-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
      const notifyUrl = `${url.origin}/api/notify`;
      const returnUrl = `${url.origin}/success?order=${orderId}`;

      try {
        const payjsRes = await fetch('https://payjs.cn/api/native', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            mchid: env.PAYJS_MCHID,
            total_fee: String(plan.price),
            out_trade_no: orderId,
            body: `取件通Pro-${plan.name}`,
            notify_url: notifyUrl,
            callback_url: returnUrl,
          }),
        });
        const data = await payjsRes.json();

        // PayJS 需要签名
        // 注：生产环境需要实现完整的 PayJS 签名算法
        // 详见 https://payjs.cn/docs/api

        if (data.return_code === 1) {
          // 保存订单信息
          await env.PRO_ORDERS?.put(orderId, JSON.stringify({
            tier, amount: plan.price, status: 'pending', createdAt: Date.now(),
          }), { expirationTtl: 7 * 86400 });

          return json({
            success: true,
            orderId,
            qrUrl: data.qrcode_url || data.code_url, // 支付二维码URL
            payUrl: data.pay_url || data.code_url,     // 也可用这个跳转
            amount: plan.price / 100,
          }, 200, corsHeaders);
        }
        return json({ error: data.return_msg || '创建订单失败' }, 400, corsHeaders);
      } catch (e) {
        return json({ error: `支付服务异常: ${e.message}` }, 500, corsHeaders);
      }
    }

    // ================================================================
    // 2. PayJS 回调 → 生成激活码 → 存储
    // POST /api/notify
    // ================================================================
    if (path === '/api/notify' && request.method === 'POST') {
      const body = await request.text();
      const params = new URLSearchParams(body);

      const returnCode = params.get('return_code');
      const orderId = params.get('out_trade_no');
      const transactionId = params.get('transaction_id');

      if (returnCode === '1' && orderId) {
        const code = generateCode();
        // 存储激活码
        await env.PRO_CODES?.put(`code:${code}`, JSON.stringify({
          orderId, transactionId, createdAt: Date.now(), used: false,
        }), { expirationTtl: 365 * 86400 });
        // 关联订单到激活码
        await env.PRO_ORDERS?.put(orderId, JSON.stringify({
          status: 'paid', code, transactionId,
        }), { expirationTtl: 365 * 86400 });
        console.log(`✅ 支付成功: ${orderId} → ${code}`);
      }
      return new Response('success'); // PayJS 要求返回 success
    }

    // ================================================================
    // 3. 查询订单状态（App轮询）
    // GET /api/order-status?orderId=xxx
    // ================================================================
    if (path === '/api/order-status') {
      const orderId = url.searchParams.get('orderId');
      if (!orderId) return json({ error: '缺少orderId' }, 400, corsHeaders);
      const raw = await env.PRO_ORDERS?.get(orderId);
      if (!raw) return json({ status: 'not_found' }, 200, corsHeaders);
      const order = JSON.parse(raw);
      return json(order, 200, corsHeaders);
    }

    // ================================================================
    // 4. 支付成功页
    // GET /success?order=xxx
    // ================================================================
    if (path === '/success') {
      const orderId = url.searchParams.get('order');
      let code = '';
      if (orderId && env.PRO_ORDERS) {
        const raw = await env.PRO_ORDERS.get(orderId);
        if (raw) {
          const order = JSON.parse(raw);
          code = order.code || '';
        }
      }
      return new Response(renderSuccessPage(code || '正在生成...请稍等'), {
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders },
      });
    }

    // ================================================================
    // 5. 验证激活码
    // GET /api/verify?code=xxx
    // ================================================================
    if (path === '/api/verify') {
      const code = url.searchParams.get('code')?.toUpperCase().trim();
      if (!code) return json({ valid: false }, 200, corsHeaders);
      try {
        const raw = await env.PRO_CODES?.get(`code:${code}`);
        if (raw) {
          const data = JSON.parse(raw);
          if (!data.used) {
            await env.PRO_CODES.put(`code:${code}`, JSON.stringify({ ...data, used: true, usedAt: Date.now() }));
          }
          return json({ valid: true }, 200, corsHeaders);
        }
      } catch {}
      return json({ valid: false }, 200, corsHeaders);
    }

    // ================================================================
    // 6. 首页（Web版定价页，可选）
    // ================================================================
    return new Response(renderHomePage(url.origin), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders },
    });
  },
};

// ======== 工具 ========
function generateCode() {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = 'PICKUP-';
  for (let i = 0; i < 12; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

// ======== HTML 页面 ========
function renderSuccessPage(code) {
  return `<!DOCTYPE html><html lang="zh">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>支付成功 · 取件通</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#F2F2F7;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}
.card{background:#fff;border-radius:20px;padding:40px 30px;text-align:center;max-width:400px;width:100%;box-shadow:0 2px 20px rgba(0,0,0,.08)}
.icon{font-size:64px;margin-bottom:16px}h1{font-size:24px;color:#1C1C1E;margin-bottom:8px}
.sub{font-size:14px;color:#8E8E93;margin-bottom:24px}
.code-box{background:#007AFF10;border:2px dashed #007AFF;border-radius:12px;padding:20px;margin-bottom:24px}
.code{font-size:28px;font-weight:800;color:#007AFF;letter-spacing:2px;font-family:monospace;user-select:all}
.hint{font-size:13px;color:#8E8E93;margin-top:12px;line-height:1.6}
.btn{background:#007AFF;color:#fff;border:none;border-radius:12px;padding:14px 40px;font-size:16px;font-weight:700;cursor:pointer;width:100%}
.btn:active{opacity:.8}
</style></head><body>
<div class="card"><div class="icon">🎉</div><h1>支付成功！</h1><p class="sub">感谢升级取件通 Pro</p>
<div class="code-box"><div class="code" id="code">${code}</div></div>
<p class="hint">👆 长按复制激活码<br>回到取件通 App<br>设置 → Pro → 激活码 → 粘贴激活</p>
<button class="btn" onclick="navigator.clipboard.writeText('${code}')">📋 复制激活码</button></div>
</body></html>`;
}

function renderHomePage(origin) {
  return `<!DOCTYPE html><html lang="zh">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>取件通 Pro</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#F2F2F7;padding:40px 20px}
h1{text-align:center;color:#1C1C1E}.sub{text-align:center;color:#8E8E93;font-size:14px;margin:8px 0 30px}
.tiers{max-width:400px;margin:0 auto}
.tier{background:#fff;border-radius:16px;padding:24px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 1px 8px rgba(0,0,0,.06);text-decoration:none;color:inherit}
.tier-best{border:2px solid #FF9500}.tier-name{font-size:18px;font-weight:700;color:#1C1C1E}
.best-tag{background:#FF9500;color:#fff;font-size:11px;padding:2px 8px;border-radius:8px;margin-left:6px}
.tier-price{font-size:24px;font-weight:800;color:#007AFF}
.tier-per{font-size:13px;color:#8E8E93}
</style></head><body>
<h1>取件通 Pro</h1><p class="sub">无限包裹 · 全家共享 · 优先支持</p>
<div class="tiers">
<a class="tier tier-best" href="${origin}/api/create-order?tier=yearly"><span class="tier-name">年付 <span class="best-tag">推荐</span></span><span class="tier-price">¥29.9<span class="tier-per">/年</span></span></a>
<a class="tier" href="${origin}/api/create-order?tier=monthly"><span class="tier-name">月付</span><span class="tier-price">¥3.99<span class="tier-per">/月</span></span></a>
<a class="tier" href="${origin}/api/create-order?tier=lifetime"><span class="tier-name">买断</span><span class="tier-price">¥68<span class="tier-per">永久</span></span></a>
</div></body></html>`;
}
