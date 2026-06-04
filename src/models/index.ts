// ============================================================
// 数据模型 —— 包裹全链路追踪
// ============================================================

/** 包裹状态 */
export type PackageStatus =
  | 'pending'       // 待发货
  | 'shipped'       // 已发货
  | 'in_transit'    // 运输中
  | 'arrived'       // 已到达目的地
  | 'stored'        // 已入库/待取件
  | 'picked_up'     // 已取件
  | 'error';        // 异常

/** 数据来源 */
export type PackageSource =
  | 'sms'           // 短信监听
  | 'notification'  // 通知栏推送
  | 'api'           // 快递API查询
  | 'manual';       // 手动录入

/** 快递公司编码 */
export type CarrierCode =
  | 'shunfeng' | 'sf'
  | 'yuantong' | 'yt'
  | 'zhongtong' | 'zt'
  | 'shentong' | 'sto'
  | 'yunda' | 'yd'
  | 'jitu' | 'jt'
  | 'baishi' | 'best'
  | 'jingdong' | 'jd'
  | 'ems' | 'youzhengguonei'
  | 'deppon'
  | 'cainiao'
  | 'fengchao'
  | 'duoduomaicai'
  | 'meituanyouxuan'
  | 'unknown';

/** 包裹主表 */
export interface Package {
  id: string;
  trackingNumber: string;       // 快递单号
  carrier: CarrierCode;         // 快递公司编码
  carrierName: string;          // 快递公司中文名
  orderSource: string;          // 购买平台：淘宝/京东/拼多多/抖音/...
  productName: string;          // 商品名称
  pickupCode: string | null;    // 取件码
  pickupAddress: string | null; // 取件地址
  pickupPointName: string | null;   // 快递点名称
  pickupPointPhone: string | null;  // 快递点联系电话
  businessHours: string | null;     // 快递点营业时间
  notes: string | null;              // 用户备注
  currentStatus: PackageStatus;
  statusUpdatedAt: number;      // 状态更新时间戳
  source: PackageSource;        // 数据来源
  createdAt: number;
  pickedUpAt: number;           // 取件时间戳(0=未取)
  expiresAt: number;            // 取件截止时间戳(0=无)
  pinned: boolean;              // 是否置顶
  smsRawText: string | null;    // 短信原文（来源=sms时有值）
  screenshotPaths: string | null; // 截图路径JSON数组（来源=manual+OCR时有值）
  assignedTo: string | null;    // 分配给的家庭成员ID（null=自己）
  assignedToName: string | null; // 分配给的家庭成员名称
  pushedBy: string | null;      // 推送来源：推送者名称（从其他设备分享过来的）
  pushStatus: string | null;    // 推送状态：pending/received/done
}

// ============================================================
// 会员体系
// ============================================================

/** 会员等级 */
export type MembershipTier = 'monthly' | 'yearly' | 'lifetime';

/** 激活方式 */
export type ActivationMethod = 'alipay' | 'wechat' | 'code';

/** 会员状态 */
export interface Membership {
  active: boolean;               // 是否已激活
  tier: MembershipTier | null;   // 当前等级
  activatedAt: number;           // 激活时间戳
  expiresAt: number;             // 到期时间戳（永久会员为 0）
  method: ActivationMethod | null; // 激活方式
  code: string | null;           // 使用的激活码（method=code时有值）
  _sig?: string;                 // 防篡改签名（内部字段）
}

/** 会员等级显示配置 */
export interface MembershipTierConfig {
  key: MembershipTier;
  name: string;                  // 月度VIP / 年度VIP / 永久VIP
  nameShort: string;             // 月度 / 年度 / 永久
  price: string;                 // ¥3.99
  amount: number;                // 3.99
  period: string;                // 月 / 年 / 永久
  desc: string;                  // 描述文案
  color: string;                 // 徽章金色调
  durationDays: number;          // 有效天数（永久=0）
}

/** 家庭成员 */
export interface FamilyMember {
  id: string;
  name: string;
  color: string;       // 标识色
}

/** 物流轨迹明细 */
export interface TrackingEvent {
  id: string;
  packageId: string;            // 关联包裹ID
  time: number;                 // 事件时间戳
  status: string;               // 事件描述
  location: string;             // 发生地点
  rawDescription: string;       // 原始描述全文
}

/** SMS 解析结果 */
export interface ParsedSmsResult {
  code: string;
  company: CarrierCode;
  companyName: string;
  address: string;
  expiresAt: number | null;
  stationName: string | null;   // 快递点/驿站名称
  stationPhone: string | null;  // 快递点联系电话
  businessHours?: string;       // 快递点营业时间
  trackingNumber?: string;      // 从短信中提取的快递单号
  tailNumber?: string;          // 快递单号尾号（如短信中"尾号1234"）
}

/** 通知推送解析结果 */
export interface ParsedNotificationResult {
  productName: string;
  trackingNumber: string;
  carrier: CarrierCode;
  carrierName: string;
  orderSource: string;
  address: string | null;
  phone: string | null;
  stationName: string | null;
}

/** API 轨迹查询结果 */
export interface TrackingApiResult {
  state: string;                // 0=途中 1=揽收 2=疑难 3=签收 4=退签
  events: ApiTrackingEvent[];
  pickupCode: string | null;   // 从轨迹中提取的取件码
}

export interface ApiTrackingEvent {
  time: string;
  location: string;
  context: string;
}

/** 快递公司显示信息 */
export interface CourierInfo {
  code: CarrierCode;
  name: string;                 // 中文名
  icon: string;                 // emoji 图标
  color: string;                // 主题色
  phonePrefix: string[];        // 发件人号码前缀（106开头通道号）
}
