// ============================================================
// UI Strings — centralized text constants for future i18n
// ============================================================

// Package status labels
export const PACKAGE_STATUS: Record<string, string> = {
  pending: '待发货',
  shipped: '已发货',
  in_transit: '运输中',
  arrived: '已到达',
  stored: '待取件',
  picked_up: '已取件',
  error: '异常',
};

// Settings section labels
export const SETTINGS = {
  pickupPro: '取件通 Pro',
  proMembership: 'Pro 会员已激活',
  proBenefits: '无限包裹 · 成员共享 · 优先支持',
  freeTier: '免费版',
  accountSetup: '账号设置',
  myPhone: '我的手机号',
  corePermissions: '核心权限',
  smsReading: '短信读取',
  smsGranted: '已授权 — 自动识别取件码',
  smsDenied: '未授权 — 需手动粘贴短信',
  shoppingAppMonitor: '购物 App 监控',
  backgroundMonitor: '后台监听',
  bgEnabled: '已开启 — 自动扫描短信，防止杀后台',
  bgDisabled: '已关闭 — 需手动刷新',
  desktopWidget: '桌面挂件',
  pickupReminder: '取件提醒',
  historyData: '历史数据',
  dataManagement: '数据管理',
  exportData: '导出数据',
  importData: '导入数据',
  clearAllData: '清空全部数据',
  themeSettings: '主题设置',
  about: '关于',
  checkUpdate: '检查更新',
  privacyPolicy: '隐私政策',
  userAgreement: '用户协议',
  feedback: '反馈与建议',
  rateApp: '给个好评',
};

// Notification content templates
export const NOTIFICATIONS = {
  deadlineWarning: (hoursLeft: number): string =>
    hoursLeft <= 4 ? `${Math.floor(hoursLeft)}小时后截止` :
    hoursLeft <= 12 ? '今晚截止' : '明天截止',
  arrivedDays: (days: number): string => `已到站 ${days} 天`,
  pleasePickup: '记得去取件哦！',
  pickupSoon: '请尽快取件，避免超时！',
  expiredPickup: '取件截止时间已过，请确认是否已取件',
};

// Empty state messages
export const EMPTY_STATE = {
  noPackages: {
    title: '暂无包裹',
    subtitle: '收到快递短信或发货通知后\n取件码会自动出现在这里',
  },
  noExpired: {
    title: '暂无过期包裹',
    subtitle: '所有待取件包裹都在有效期内',
  },
};

// Filter labels (used in home screen tabs)
export const FILTERS = {
  stored: '待取件',
  proxy: '代取',
  picked_up: '已取件',
  expired: '已过期',
};

// Sort labels
export const SORT = {
  timeDesc: '最新',
  timeAsc: '最早',
  station: '按驿站',
  deadline: '按截止',
};