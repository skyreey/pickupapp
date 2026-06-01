// ============================================================
// 购物 App 推送通知解析规则库
// 按 App 包名过滤 → 正则提取商品/单号/快递公司/地址/电话/站点
// ============================================================

/** 购物 App 信息 */
export interface ShoppingApp {
  packageName: string;
  name: string;
  icon: string;
  color: string;
}

/** 推送解析规则 */
export interface NotificationRule {
  app: ShoppingApp;
  titleKeywords: string[];
  contentPatterns: {
    productPatterns: RegExp[];
    trackingPatterns: RegExp[];
    carrierPatterns: RegExp[];
    addressPatterns: RegExp[];
    phonePatterns: RegExp[];
    stationNamePatterns: RegExp[];
  };
}

// ============================================================
// 购物 App 信息库
// ============================================================
export const SHOPPING_APPS: Record<string, ShoppingApp> = {
  'com.taobao.taobao':        { packageName: 'com.taobao.taobao',        name: '淘宝',   icon: '🧡', color: '#FF5000' },
  'com.jingdong.app.mall':    { packageName: 'com.jingdong.app.mall',    name: '京东',   icon: '❤️', color: '#E2231A' },
  'com.xunmeng.pinduoduo':    { packageName: 'com.xunmeng.pinduoduo',    name: '拼多多', icon: '🔴', color: '#E74C3C' },
  'com.ss.android.ugc.aweme': { packageName: 'com.ss.android.ugc.aweme', name: '抖音',   icon: '🎵', color: '#000000' },
  'com.alibaba.android.rimet':{ packageName: 'com.alibaba.android.rimet',name: '钉钉',   icon: '🔵', color: '#0089FF' },
  'com.sankuai.meituan':      { packageName: 'com.sankuai.meituan',      name: '美团',   icon: '🟡', color: '#FFC300' },
  'com.taobao.idlefish':      { packageName: 'com.taobao.idlefish',      name: '闲鱼',   icon: '🟡', color: '#FFC300' },
  'com.alibaba.wireless':     { packageName: 'com.alibaba.wireless',     name: '1688',   icon: '🔴', color: '#FF6A00' },
  'com.xiaomi.shop':          { packageName: 'com.xiaomi.shop',          name: '小米商城', icon: '🟠', color: '#FF6700' },
  'com.cainiao.wireless':     { packageName: 'com.cainiao.wireless',     name: '菜鸟',   icon: '🟢', color: '#FF6A00' },
  'com.xingin.xhs':           { packageName: 'com.xingin.xhs',           name: '小红书', icon: '📕', color: '#FE2C55' },
  'com.kuaishou.nebula':      { packageName: 'com.kuaishou.nebula',      name: '快手',   icon: '🟡', color: '#FF4906' },
  'com.vipshop':              { packageName: 'com.vipshop',              name: '唯品会', icon: '🛍️', color: '#F1010A' },
  'com.suning.mobile.ebuy':   { packageName: 'com.suning.mobile.ebuy',   name: '苏宁',   icon: '🔵', color: '#FF6600' },
};

// ============================================================
// 通用地址/电话/站点提取正则
// ============================================================
const ADDR: RegExp[] = [
  /(?:已到(?!站|达)|已送达|已送至|已到达|存放于|存放至|已存至|已到站|已抵达)\s*(.+?)(?:[，,。.\n]|取件码|取件|领取|请凭|过期|兔喜生活|兔喜快递|兔喜超市|兔喜|菜鸟驿站|丰巢|妈妈驿站|韵达超市|快递超市|邻里驿站|自提柜|代收点|快递柜|驿站|$)/,
  /(?:派送地址|收货地址|取件地址|自提地址|领取地址|驿站地址)[：:]\s*(.+?)(?:[，,。.\n]|$)/,
  /地址[：:]\s*(.+?)(?:[，,。.\n]|$)/,
  /请到[：:]?\s*(.+?)(?:取件|取货|领取)/,
  /前往[：:]?\s*(.+?)(?:取件|取货|领取|自提)/,
  /([一-龥]{2,}(?:小区|村|路|街|号|楼|栋|单元|门头房|门面|底商|商铺|大厦|广场|商场|超市|市场|学院|学校|医院)[一-龥\d\-]*(?:菜鸟驿站|妈妈驿站|丰巢|快递|兔喜生活|兔喜快递|兔喜超市|兔喜|韵达超市|快递超市|邻里驿站|自提柜|代收点|快递柜|驿站)?)/,
];

const PHONE: RegExp[] = [
  /(?:电话|联系电话|联系方式|客服|咨询|联系)[：:]\s*(1[3-9]\d{9})/,
  /(?:电话|联系电话|联系方式|客服|咨询|联系)[：:]\s*((?:0\d{2,3}[-\s]?\d{7,8}|\d{3,4}[-\s]?\d{7,8}))/,
  /(1[3-9]\d{9})/,
];

const STATION: RegExp[] = [
  /(菜鸟驿站[一-龥\d\-]{0,15}(?:店|点|站)?)/,
  /(丰巢(?:智能柜|快递柜)?[一-龥\d\-]{0,10})/,
  /(妈妈驿站[一-龥\d\-]{0,10})/,
  /(兔喜(?:快递)?[一-龥\d\-]{0,10})/,
  /(韵达超市[一-龥\d\-]{0,10})/,
  /(京东快递[一-龥\d\-]{0,10}(?:店|点|站)?)/,
  /(快递超市[一-龥\d\-]{0,10})/,
  /(邻里驿站[一-龥\d\-]{0,10})/,
  /(多多买菜[一-龥\d\-]{0,10}(?:自提点|店|点)?)/,
  /(美团优选[一-龥\d\-]{0,10}(?:自提点|店|点)?)/,
];

// ============================================================
// 各 App 推送解析规则
// ============================================================
export const NOTIFICATION_RULES: NotificationRule[] = [
  // ---------- 淘宝 ----------
  {
    app: SHOPPING_APPS['com.taobao.taobao'],
    titleKeywords: ['发货', '物流', '已发出', '包裹', '快递', '订单', '运单', '揽收', '派送', '运输', '签收', '商品'],
    contentPatterns: {
      productPatterns: [
        /您的订单[：:\s]*[【\[](.*?)[】\]].*?已/,
        /订单[：:\s]*[【\[](.*?)[）\]].*?(?:已发货|已发出|运输中|派送)/,
        /[【\[](.*?)[】\]].*?(?:已发货|已发出|正在派送|已揽收)/,
        /商品[：:]\s*[【\[](.*?)[】\]]/,
        /商品[：:]\s*(.+?)(?:[，,。.\n]|$)/,
        /(.*?)(?:已发货|物流单号|快递单号)/,
        /[【\[](.*?)[】\]]/,
      ],
      trackingPatterns: [
        /快递单号[：:\s]*([A-Z0-9]{6,30})/i,
        /物流单号[：:\s]*([A-Z0-9]{6,30})/i,
        /运单号[：:\s]*([A-Z0-9]{6,30})/i,
        /单号[：:\s]*([A-Z0-9]{6,30})/i,
        /([A-Z]{1,4}\d{8,25})/,
        /(\d{10,20})/,
      ],
      carrierPatterns: [
        /快递[公司]?[：:\s]*(.+?)(?:[，,。.\n]|$)/,
        /物流[公司]?[：:\s]*(.+?)(?:[，,。.\n]|$)/,
        /由[：:\s]?(.+?)(?:快递|速运|配送|揽收)/,
        /(顺丰|圆通|中通|申通|韵达|极兔|百世|京东|德邦|EMS|邮政|菜鸟)/,
      ],
      addressPatterns: ADDR,
      phonePatterns: PHONE,
      stationNamePatterns: STATION,
    },
  },
  // ---------- 京东 ----------
  {
    app: SHOPPING_APPS['com.jingdong.app.mall'],
    titleKeywords: ['发货', '物流', '订单', '配送', '包裹', '快递', '运单', '揽收', '运输', '签收', '商品', '出库'],
    contentPatterns: {
      productPatterns: [
        /您的订单[：:\s]*[【\[](.*?)[】\]].*?已/,
        /[【\[](.*?)[】\]].*?(?:已出库|已发货|正在配送|运输中|已揽收)/,
        /(.*?)(?:正在发往|已到达|已签收)/,
        /商品[：:]\s*[【\[](.*?)[】\]]/,
        /商品[：:]\s*(.+?)(?:[，,。.\n]|$)/,
        /[【\[](.*?)[】\]]/,
      ],
      trackingPatterns: [
        /快递单号[：:\s]*([A-Z0-9]{6,30})/i,
        /运单号[：:\s]*([A-Z0-9]{6,30})/i,
        /JD[A-Z0-9]{8,20}/i,
        /JDV?\d{8,20}/i,
        /([A-Z]{1,4}\d{8,25})/,
        /(\d{10,20})/,
      ],
      carrierPatterns: [
        /快递[：:\s]*(.+?)(?:[，,。.\n]|$)/,
        /承运[：:\s]*(.+?)(?:[，,。.\n]|$)/,
        /由[：:\s]?(.+?)(?:快递|配送|揽收)/,
        /京东(?:快递|物流)/,
        /(顺丰|圆通|中通|申通|韵达|极兔|百世|京东|德邦|EMS|邮政|菜鸟)/,
      ],
      addressPatterns: ADDR,
      phonePatterns: PHONE,
      stationNamePatterns: STATION,
    },
  },
  // ---------- 拼多多 ----------
  {
    app: SHOPPING_APPS['com.xunmeng.pinduoduo'],
    titleKeywords: ['发货', '物流', '订单', '包裹', '快递', '已发出', '运单', '揽收', '派送', '运输', '商品', '提醒'],
    contentPatterns: {
      productPatterns: [
        /(?:你|您)的[【\[](.*?)[】\]].*?已发货/,
        /订单.*?[【\[](.*?)[）\]].*?(?:已|正在|运输)/,
        /(.*?)(?:已发货|正在路上|已揽收)/,
        /商品[：:]\s*[【\[](.*?)[】\]]/,
        /商品[：:]\s*(.+?)(?:[，,。.\n]|$)/,
        /[【\[](.*?)[】\]].*?(?:快递|物流)/,
        /[【\[](.*?)[】\]]/,
      ],
      trackingPatterns: [
        /快递单号[：:\s]*([A-Z0-9]{6,30})/i,
        /运单号[：:\s]*([A-Z0-9]{6,30})/i,
        /单号[：:\s]*([A-Z0-9]{6,30})/i,
        /([A-Z]{1,4}\d{8,25})/,
        /(\d{10,20})/,
      ],
      carrierPatterns: [
        /快递[：:\s]*(.+?)(?:[，,。.\n]|$)/,
        /物流[：:\s]*(.+?)(?:[，,。.\n]|$)/,
        /由[：:\s]?(.+?)(?:快递|配送|发出|揽收)/,
        /(顺丰|圆通|中通|申通|韵达|极兔|百世|京东|德邦|EMS|邮政|菜鸟)/,
      ],
      addressPatterns: ADDR,
      phonePatterns: PHONE,
      stationNamePatterns: STATION,
    },
  },
  // ---------- 抖音 ----------
  {
    app: SHOPPING_APPS['com.ss.android.ugc.aweme'],
    titleKeywords: ['发货', '物流', '订单', '商品', '快递', '已发出', '运单', '揽收', '派送', '运输'],
    contentPatterns: {
      productPatterns: [
        /(?:你|您)购买的[【\[](.*?)[】\]].*?已发货/,
        /订单[：:\s]*[【\[](.*?)[】\]].*?已/,
        /(.*?)(?:已发货|已发出|物流更新)/,
        /商品[：:]\s*[【\[](.*?)[】\]]/,
        /商品[：:]\s*(.+?)(?:[，,。.\n]|$)/,
        /[【\[](.*?)[】\]]/,
      ],
      trackingPatterns: [
        /快递单号[：:\s]*([A-Z0-9]{6,30})/i,
        /运单号[：:\s]*([A-Z0-9]{6,30})/i,
        /单号[：:\s]*([A-Z0-9]{6,30})/i,
        /([A-Z]{1,4}\d{8,25})/,
        /(\d{10,20})/,
      ],
      carrierPatterns: [
        /快递[：:\s]*(.+?)(?:[，,。.\n]|$)/,
        /物流[：:\s]*(.+?)(?:[，,。.\n]|$)/,
        /由[：:\s]?(.+?)(?:快递|配送|揽收)/,
        /(顺丰|圆通|中通|申通|韵达|极兔|百世|京东|德邦|EMS|邮政|菜鸟)/,
      ],
      addressPatterns: ADDR,
      phonePatterns: PHONE,
      stationNamePatterns: STATION,
    },
  },
  // ---------- 菜鸟 ----------
  {
    app: SHOPPING_APPS['com.cainiao.wireless'],
    titleKeywords: ['物流', '快递', '包裹', '发货', '取件', '签收', '运单', '揽收', '派送', '运输', '已到', '已送达'],
    contentPatterns: {
      productPatterns: [
        /[【\[](.*?)[】\]].*?(?:已发出|运输中|派送中|已签收|已到|已送达)/,
        /包裹[：:\s]*[【\[](.*?)[】\]]/,
        /商品[：:]\s*(.+?)(?:[，,。.\n]|$)/,
        /[【\[](.*?)[】\]]/,
      ],
      trackingPatterns: [
        /快递单号[：:\s]*([A-Z0-9]{6,30})/i,
        /运单号[：:\s]*([A-Z0-9]{6,30})/i,
        /单号[：:\s]*([A-Z0-9]{6,30})/i,
        /([A-Z]{1,4}\d{8,25})/,
        /(\d{10,20})/,
      ],
      carrierPatterns: [
        /快递[：:\s]*(.+?)(?:[，,。.\n]|$)/,
        /物流[：:\s]*(.+?)(?:[，,。.\n]|$)/,
        /由[：:\s]?(.+?)(?:快递|配送|承运|揽收)/,
        /(顺丰|圆通|中通|申通|韵达|极兔|百世|京东|德邦|EMS|邮政|菜鸟)/,
      ],
      addressPatterns: ADDR,
      phonePatterns: PHONE,
      stationNamePatterns: STATION,
    },
  },
  // ---------- 美团 ----------
  {
    app: SHOPPING_APPS['com.sankuai.meituan'],
    titleKeywords: ['发货', '订单', '配送', '快递', '运单', '物流'],
    contentPatterns: {
      productPatterns: [
        /(?:你|您)的[【\[](.*?)[】\]].*?已/,
        /订单[：:\s]*[【\[](.*?)[】\]]/,
        /(.*?)(?:已发货|已发出)/,
        /商品[：:]\s*(.+?)(?:[，,。.\n]|$)/,
        /[【\[](.*?)[】\]]/,
      ],
      trackingPatterns: [
        /快递单号[：:\s]*([A-Z0-9]{6,30})/i,
        /单号[：:\s]*([A-Z0-9]{6,30})/i,
        /([A-Z]{1,4}\d{8,25})/,
        /(\d{10,20})/,
      ],
      carrierPatterns: [
        /快递[：:\s]*(.+?)(?:[，,。.\n]|$)/,
        /由[：:\s]?(.+?)(?:快递|配送)/,
        /(顺丰|圆通|中通|申通|韵达|极兔|百世|京东|德邦|EMS|邮政|菜鸟)/,
      ],
      addressPatterns: ADDR,
      phonePatterns: PHONE,
      stationNamePatterns: STATION,
    },
  },
  // ---------- 通用兜底 ----------
  {
    app: { packageName: '*', name: '其他', icon: '📦', color: '#757575' },
    titleKeywords: ['发货', '物流', '快递', '包裹', '订单', '运单', '揽收', '派送', '运输', '签收', '商品', '已发出', '已到'],
    contentPatterns: {
      productPatterns: [
        /[【\[](.*?)[】\]].*?(?:已发货|已发出|正在|已揽收|派送|运输|已到|已签收)/,
        /订单.*?[【\[](.*?)[】\]]/,
        /(.*?)(?:已发货|已发出|物流更新)/,
        /商品[：:]\s*(.+?)(?:[，,。.\n]|$)/,
        /[【\[](.*?)[】\]]/,
      ],
      trackingPatterns: [
        /快递单号[：:\s]*([A-Z0-9]{6,30})/i,
        /运单号[：:\s]*([A-Z0-9]{6,30})/i,
        /物流单号[：:\s]*([A-Z0-9]{6,30})/i,
        /单号[：:\s]*([A-Z0-9]{6,30})/i,
        /包裹号[：:\s]*([A-Z0-9]{6,30})/i,
        /([A-Z]{1,4}\d{8,25})/,
        /(\d{12,20})/,
      ],
      carrierPatterns: [
        /快递[：:\s]*(.+?)(?:[，,。.\n]|$)/,
        /物流[：:\s]*(.+?)(?:[，,。.\n]|$)/,
        /由[：:\s]?(.+?)(?:快递|配送|揽收)/,
        /(顺丰|圆通|中通|申通|韵达|极兔|百世|京东|德邦|EMS|邮政|菜鸟)/,
      ],
      addressPatterns: ADDR,
      phonePatterns: PHONE,
      stationNamePatterns: STATION,
    },
  },
];

// ============================================================
// 支付 App 通知解析（用于 Pro 自动激活）
// ============================================================
export const PAYMENT_APPS: Record<string, { name: string; amountPattern: RegExp }> = {
  // 微信支付成功通知
  'com.tencent.mm': {
    name: '微信支付',
    // "支付成功 ¥29.90" / "已支付￥29.9" / "向*支付29.90元"
    amountPattern: /(?:支付成功|已支付|付款成功|交易成功|向.*支付)\s*[¥￥]?\s*(\d+\.?\d{0,2})\s*元?/,
  },
  // 支付宝到账通知
  'com.eg.android.AlipayGphone': {
    name: '支付宝',
    // "成功收款 ¥29.90" / "到账 ¥29.90元" / "转账 ¥29.90"
    amountPattern: /(?:收款|到账|转账|汇款|支付成功|已收到)\s*[¥￥]?\s*(\d+\.?\d{0,2})\s*元?/,
  },
};

/** 从支付通知文本中提取金额（返回元为单位） */
export function extractPaymentAmount(packageName: string, text: string): number | null {
  const app = PAYMENT_APPS[packageName];
  if (!app) return null;
  const match = text.match(app.amountPattern);
  if (!match || !match[1]) return null;
  const amount = parseFloat(match[1]);
  if (isNaN(amount) || amount <= 0) return null;
  // 过滤明显不是支付的通知（红包、退款等）
  if (/红包|退款|提现|免密|代扣|自动扣/.test(text)) return null;
  return amount;
}
