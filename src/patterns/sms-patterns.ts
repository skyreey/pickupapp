// ============================================================
// 快递取件码短信正则规则库
// 覆盖 15+ 家快递公司和驿站
// ============================================================
import type { CourierInfo, CarrierCode } from '../models';

export interface SmsPatternRule {
  /** 快递公司信息 */
  courier: CourierInfo;
  /** 发件人号码特征（用于快速预过滤） */
  senderPatterns: RegExp[];
  /** 短信内容特征词（至少命中一个才继续解析） */
  contentKeywords: string[];
  /** 取件码提取正则（优先级从高到低试） */
  codePatterns: RegExp[];
  /** 地址提取正则 */
  addressPatterns: RegExp[];
  /** 过期时间提取正则 */
  expirePatterns: RegExp[];
  /** 联系电话提取正则 */
  phonePatterns: RegExp[];
  /** 站点名称提取正则 */
  stationNamePatterns: RegExp[];
  /** 营业时间提取正则 */
  businessHoursPatterns: RegExp[];
}

// ============================================================
// 快递公司信息库
// ============================================================
export const COURIER_INFO: Record<CarrierCode, CourierInfo> = {
  // 别名
  sf:      { code: 'shunfeng',  name: '顺丰速运',   icon: '⚫', color: '#000000', phonePrefix: ['95338', '1069'] },
  yt:      { code: 'yuantong',  name: '圆通速递',   icon: '🟤', color: '#6B2F8B', phonePrefix: ['1069', '1065'] },
  zt:      { code: 'zhongtong', name: '中通快递',   icon: '🔷', color: '#0066B3', phonePrefix: ['1069', '1065'] },
  sto:     { code: 'shentong',  name: '申通快递',   icon: '⚪', color: '#888888', phonePrefix: ['1069', '1065'] },
  yd:      { code: 'yunda',     name: '韵达快递',   icon: '🟡', color: '#FFCC00', phonePrefix: ['1069', '1065'] },
  jt:      { code: 'jitu',      name: '极兔速递',   icon: '🔴', color: '#FF4757', phonePrefix: ['1069', '1065'] },
  best:    { code: 'baishi',    name: '百世快递',   icon: '🔶', color: '#ED7B1C', phonePrefix: ['1069', '1065'] },
  jd:      { code: 'jingdong',  name: '京东快递',   icon: '🔴', color: '#E2231A', phonePrefix: ['1069', '1065'] },
  // 主条目
  cainiao:        { code: 'cainiao',      name: '菜鸟驿站',     icon: '🟢', color: '#FF6A00', phonePrefix: ['1069', '1065'] },
  fengchao:       { code: 'fengchao',     name: '丰巢',         icon: '🔵', color: '#1677FF', phonePrefix: ['1069', '1065'] },
  jingdong:       { code: 'jingdong',     name: '京东快递',     icon: '🔴', color: '#E2231A', phonePrefix: ['1069', '1065'] },
  shunfeng:       { code: 'shunfeng',     name: '顺丰速运',     icon: '⚫', color: '#000000', phonePrefix: ['95338', '1069'] },
  ems:            { code: 'ems',          name: '邮政EMS',      icon: '🟡', color: '#006633', phonePrefix: ['11183', '1069'] },
  yuantong:       { code: 'yuantong',     name: '圆通速递',     icon: '🟤', color: '#6B2F8B', phonePrefix: ['1069', '1065'] },
  zhongtong:      { code: 'zhongtong',    name: '中通快递',     icon: '🔷', color: '#0066B3', phonePrefix: ['1069', '1065'] },
  shentong:       { code: 'shentong',     name: '申通快递',     icon: '⚪', color: '#888888', phonePrefix: ['1069', '1065'] },
  yunda:          { code: 'yunda',        name: '韵达快递',     icon: '🟡', color: '#FFCC00', phonePrefix: ['1069', '1065'] },
  jitu:           { code: 'jitu',         name: '极兔速递',     icon: '🔴', color: '#FF4757', phonePrefix: ['1069', '1065'] },
  baishi:         { code: 'baishi',       name: '百世快递',     icon: '🔶', color: '#ED7B1C', phonePrefix: ['1069', '1065'] },
  deppon:         { code: 'deppon',       name: '德邦快递',     icon: '🟠', color: '#FF7A00', phonePrefix: ['95353', '1069'] },
  duoduomaicai:   { code: 'duoduomaicai', name: '多多买菜',     icon: '🔴', color: '#E74C3C', phonePrefix: ['1069'] },
  meituanyouxuan: { code: 'meituanyouxuan', name: '美团优选',  icon: '🟡', color: '#FFC300', phonePrefix: ['1069'] },
  youzhengguonei: { code: 'ems',          name: '邮政国内',     icon: '🟡', color: '#006633', phonePrefix: ['11183', '1069'] },
  unknown:        { code: 'unknown',      name: '快递',         icon: '📦', color: '#757575', phonePrefix: [] },
};

// ============================================================
// 通用取件码正则（兜底规则）
// ============================================================
const COMMON_CODE_PATTERNS: RegExp[] = [
  // 标准格式：取件码: xxx / 取件码：xxx
  /取件码\s*[：:]\s*([\d\-A-Za-z]{4,20})/,
  /取件码\s*([\d\-A-Za-z]{4,20})/,
  // 提货码
  /提货码\s*[：:]\s*([\d\-A-Za-z]{4,20})/,
  /提货码\s*([\d\-A-Za-z]{4,20})/,
  // 验证码（部分快递用这个发取件码）
  /验证码\s*[：:]\s*([\d\-A-Za-z]{4,20})/,
  // 包裹码
  /包裹码\s*[：:]\s*([\d\-A-Za-z]{4,20})/,
  // 自提码
  /自提码\s*[：:]\s*([\d\-A-Za-z]{4,20})/,
  // 提取码
  /提取码\s*[：:]\s*([\d\-A-Za-z]{4,20})/,
  // 您的快递.*?([A-Z]?\d{1,2}[-—]\d{1,2}[-—]\d{4,6})  -- 菜鸟格式
  /([A-Z]?\d{1,2}[-—]\d{1,2}[-—]\d{4,6})/,
];

// ============================================================
// 通用地址提取正则
//
// 策略：三层优先级，由精确到模糊
//   1. 明确地址标签（"取件地址：XXX"）→ 误提取率最低
//   2. 动作引导词 + 地址（"已到XXX"、"存放于XXX"）→ 主要场景
//   3. 地理关键词直接匹配 → 兜底，匹配含路/街/号/小区等地标的片段
//
// 核心防乱提取机制：
//   a) 懒惰匹配 (.+?) 配全面终结符集（标点 + 取件码 + 联系方式 + 时间 + 动词引导词）
//   b) 术语黑名单：单号格式、纯数字、快递公司名
//   c) 地址特征白名单：必须含路/街/号/小区/村/驿站等地理关键词
//   d) 提取后最小长度 ≥ 4 且 ≤ 100 字符
// ============================================================

const COMMON_ADDRESS_PATTERNS: RegExp[] = [
  // ======== 第一层：明确地址标签（最可靠） ========
  /(?:取件地址|驿站地址|柜机地址|自提地址|领取地址|取货地址|收货地址|快递地址)\s*[：:]\s*(.+?)(?=[，,。.\n]|取件码|联系电话|营业时间|请凭|过期|$)/,
  /地址\s*[：:]\s*(.+?)(?=[，,。.\n]|取件码|联系电话|营业时间|请凭|过期|$)/,
  /地点\s*[：:]\s*(.+?)(?=[，,。.\n]|取件码|联系电话|营业时间|请凭|过期|$)/,
  /(?:取件地点|自提地点|领取地点|取货地点|收货地点)\s*[：:]\s*(.+?)(?=[，,。.\n]|取件码|联系电话|营业时间|请凭|过期|$)/,

  // ======== 第二层：动作引导词 + 地址（覆盖绝大多数短信） ========
  // "已到/已送达/存放于 + 地址"
  /(?:已到(?!站|达)|已送达|已送至|已到达|存放于|存放至|已存至|已到站|已抵达|已放置于|已投递至|已入柜)\s*(.+?)\s*(?=[，,。.\n]|取件码|提货码|包裹码|提取码|联系电话|联系|电话|营业时间|工作时间|请凭|请到|请前|请尽快|过期|快递柜|丰巢|菜鸟|兔喜生活|兔喜快递|兔喜超市|兔喜|妈妈驿站|韵达超市|快递超市|邻里驿站|自提柜|代收点|驿站|\[|\{|\]|咨询|详询|有问题|如需|速来|$)/,
  // "快递/包裹 + 状态词 + 地址" — 如"您的圆通快递已到达XX小区"
  /(?:快递|您的快递|包裹|您的包裹|运单)\s*(?:已到(?!站|达)|已送达|已到达|已送至|在)\s*(.+?)\s*(?=[，,。.\n]|取件码|提货码|包裹码|提取码|联系电话|联系|电话|营业时间|工作时间|请凭|请到|请前|请尽快|过期|快递柜|丰巢|菜鸟|兔喜生活|兔喜快递|兔喜超市|兔喜|妈妈驿站|韵达超市|快递超市|邻里驿站|自提柜|代收点|驿站|\[|\{|\]|咨询|详询|有问题|如需|速来|$)/,
  // 引导动作 + 地址
  /请到[：:]?\s*(.+?)\s*(?:取件|取货|领取)/,
  /前往[：:]?\s*(.+?)\s*(?:取件|取货|领取|自提)/,
  /至[：:]?\s*(.+?)\s*(?:取件|取货|领取)/,

  // ======== 第三层：地理关键词直接匹配（兜底） ========
  // 扩充了更多地标关键词：园区、花园、公寓、社区、巷、弄、里、苑、坊等
  /([一-龥]{2,8}(?:小区|社区|新村|花园|公寓|园区|村|镇|乡|路|街|道|巷|弄|里|园|苑|坊|庄|屯|营|堡|号|号楼|栋|幢|楼|单元|室|门头房|门面|底商|商铺|大厦|广场|商场|超市|市场|学院|学校|大学|医院|银行|邮局)[一-龥\d\-\s]*(?:菜鸟驿站|妈妈驿站|丰巢|快递|兔喜生活|兔喜快递|兔喜超市|兔喜|韵达超市|快递超市|邻里驿站|自提柜|代收点|快递柜|驿站)?)/,
];

// ============================================================
// 通用过期时间提取正则
// ============================================================
const COMMON_EXPIRE_PATTERNS: RegExp[] = [
  /请于\s*(.+?)\s*前取件/,
  /请在\s*(.+?)\s*前取/,
  /保留至\s*(.+?)(?:[，,。.\n]|$)/,
  /有效期至\s*(.+?)(?:[，,。.\n]|$)/,
  /超过\s*(.+?)\s*将/,
  /(.+?)之前取件/,
];

// ============================================================
// 通用营业时间提取正则
// ============================================================
const COMMON_BUSINESS_HOURS_PATTERNS: RegExp[] = [
  /营业时间[：:]\s*(.+?)(?:[，,。.\n]|$)/,
  /工作时间[：:]\s*(.+?)(?:[，,。.\n]|$)/,
  /营业[：:]\s*(.+?)(?:[，,。.\n]|$)/,
  /(\d{1,2}:\d{2}\s*[-–—至到]\s*\d{1,2}:\d{2})/,
];

// ============================================================
// 通用联系电话提取正则
// ============================================================
const COMMON_PHONE_PATTERNS: RegExp[] = [
  /(?:电话|联系电话|联系方式|客服|咨询|联系)[：:]\s*(1[3-9]\d{9})/,
  /(?:电话|联系电话|联系方式|客服|咨询|联系)[：:]\s*((?:0\d{2,3}[-\s]?\d{7,8}|\d{3,4}[-\s]?\d{7,8}))/,
  /(1[3-9]\d{9})/,
];

// ============================================================
// 通用站点名称提取正则
// ============================================================
const COMMON_STATION_NAME_PATTERNS: RegExp[] = [
  /(菜鸟驿站[一-龥\d\-]{0,10}(?:店|点|站)?)/,
  /(丰巢(?:智能柜|快递柜)?[一-龥\d\-]{0,10})/,
  /(妈妈驿站[一-龥\d\-]{0,10})/,
  /(兔喜(?:快递)?[一-龥\d\-]{0,10})/,
  /(韵达超市[一-龥\d\-]{0,10})/,
  /(京东快递[一-龥\d\-]{0,10}(?:店|点|站)?)/,
  /(快递超市[一-龥\d\-]{0,10})/,
  /(邻里驿站[一-龥\d\-]{0,10})/,
  /(多多买菜[一-龥\d\-]{0,10}(?:自提点|店|点)?)/,
  /(美团优选[一-龥\d\-]{0,10}(?:自提点|店|点)?)/,
  /([一-龥]{1,6}快递[一-龥\d\-]{0,8}(?:店|点|站|柜)?)/,
  /([一-龥]{1,6}驿站[一-龥\d\-]{0,10})/,
];

// ============================================================
// 各快递公司专用规则
// ============================================================
export const SMS_PATTERN_RULES: SmsPatternRule[] = [
  // ---------- 菜鸟驿站 ----------
  {
    courier: COURIER_INFO.cainiao,
    senderPatterns: [/1069/, /1065/, /菜鸟/],
    contentKeywords: ['菜鸟', '驿站', '菜鸟驿站', '包裹'],
    codePatterns: [
      /取件码\s*[：:]\s*([\d\-A-Za-z]{4,20})/,
      /取件码\s*([\d\-A-Za-z]{4,20})/,
      /验证码\s*[：:]\s*([\d\-A-Za-z]{4,20})/,
      ...COMMON_CODE_PATTERNS,
    ],
    addressPatterns: [
      /驿站地址[：:]\s*(.+?)(?:[，,。.\n]|$)/,
      /取件地址[：:]\s*(.+?)(?:[，,。.\n]|$)/,
      ...COMMON_ADDRESS_PATTERNS,
    ],
    expirePatterns: COMMON_EXPIRE_PATTERNS,
      phonePatterns: COMMON_PHONE_PATTERNS,
      stationNamePatterns: COMMON_STATION_NAME_PATTERNS,
      businessHoursPatterns: COMMON_BUSINESS_HOURS_PATTERNS,
  },

  // ---------- 丰巢 ----------
  {
    courier: COURIER_INFO.fengchao,
    senderPatterns: [/1069/, /1065/, /丰巢/],
    contentKeywords: ['丰巢', '快递柜', '自提柜', '智能柜'],
    codePatterns: [
      /取件码\s*[：:]\s*(\d{6,10})/,
      /取件码\s*(\d{6,10})/,
      ...COMMON_CODE_PATTERNS,
    ],
    addressPatterns: [
      /丰巢(?:智能柜)?[：:]\s*(.+?)(?:[，,。.\n]|$)/,
      /柜机地址[：:]\s*(.+?)(?:[，,。.\n]|$)/,
      ...COMMON_ADDRESS_PATTERNS,
    ],
    expirePatterns: [
      ...COMMON_EXPIRE_PATTERNS,
      /(\d+)小时内取件/,
      /超时.*?收费/,
    ],
      phonePatterns: COMMON_PHONE_PATTERNS,
      stationNamePatterns: COMMON_STATION_NAME_PATTERNS,
      businessHoursPatterns: COMMON_BUSINESS_HOURS_PATTERNS,
  },

  // ---------- 京东快递 ----------
  {
    courier: COURIER_INFO.jingdong,
    senderPatterns: [/1069/, /1065/, /京东/, /JD/],
    contentKeywords: ['京东', 'JD', '京东快递'],
    codePatterns: [
      /取件码\s*[：:]\s*(\d{6,10})/,
      /提货码\s*[：:]\s*(\d{6,10})/,
      ...COMMON_CODE_PATTERNS,
    ],
    addressPatterns: [
      /京东(?:快递)?[：:]\s*(.+?)(?:[，,。.\n]|$)/,
      ...COMMON_ADDRESS_PATTERNS,
    ],
    expirePatterns: COMMON_EXPIRE_PATTERNS,
      phonePatterns: COMMON_PHONE_PATTERNS,
      stationNamePatterns: COMMON_STATION_NAME_PATTERNS,
      businessHoursPatterns: COMMON_BUSINESS_HOURS_PATTERNS,
  },

  // ---------- 顺丰 ----------
  {
    courier: COURIER_INFO.shunfeng,
    senderPatterns: [/95338/, /1069/, /顺丰/, /SF/],
    contentKeywords: ['顺丰', 'SF', '顺丰速运', '丰巢.*顺丰'],
    codePatterns: [
      /取件码\s*[：:]\s*(SF\d{6,12}|\d{6,10})/i,
      /取件码\s*([A-Za-z0-9]{6,14})/,
      ...COMMON_CODE_PATTERNS,
    ],
    addressPatterns: [
      /顺丰.*?[：:]\s*(.+?)(?:[，,。.\n]|$)/,
      ...COMMON_ADDRESS_PATTERNS,
    ],
    expirePatterns: COMMON_EXPIRE_PATTERNS,
      phonePatterns: COMMON_PHONE_PATTERNS,
      stationNamePatterns: COMMON_STATION_NAME_PATTERNS,
      businessHoursPatterns: COMMON_BUSINESS_HOURS_PATTERNS,
  },

  // ---------- 邮政EMS ----------
  {
    courier: COURIER_INFO.ems,
    senderPatterns: [/11183/, /1069/, /邮政/, /EMS/],
    contentKeywords: ['邮政', 'EMS', '中国邮政', '邮政速递'],
    codePatterns: [
      /取件码\s*[：:]\s*([\d\-A-Za-z]{4,20})/,
      /取件码\s*([\d\-A-Za-z]{4,20})/,
      ...COMMON_CODE_PATTERNS,
    ],
    addressPatterns: [
      /邮政[：:]\s*(.+?)(?:[，,。.\n]|$)/,
      ...COMMON_ADDRESS_PATTERNS,
    ],
    expirePatterns: COMMON_EXPIRE_PATTERNS,
      phonePatterns: COMMON_PHONE_PATTERNS,
      stationNamePatterns: COMMON_STATION_NAME_PATTERNS,
      businessHoursPatterns: COMMON_BUSINESS_HOURS_PATTERNS,
  },

  // ---------- 圆通 ----------
  {
    courier: COURIER_INFO.yuantong,
    senderPatterns: [/1069/, /1065/, /圆通/, /YT/],
    contentKeywords: ['圆通', 'YT', '圆通速递'],
    codePatterns: [
      /取件码\s*[：:]\s*([\d\-A-Za-z]{4,20})/,
      ...COMMON_CODE_PATTERNS,
    ],
    addressPatterns: COMMON_ADDRESS_PATTERNS,
    expirePatterns: COMMON_EXPIRE_PATTERNS,
      phonePatterns: COMMON_PHONE_PATTERNS,
      stationNamePatterns: COMMON_STATION_NAME_PATTERNS,
      businessHoursPatterns: COMMON_BUSINESS_HOURS_PATTERNS,
  },

  // ---------- 中通 ----------
  {
    courier: COURIER_INFO.zhongtong,
    senderPatterns: [/1069/, /1065/, /中通/, /ZT/],
    contentKeywords: ['中通', 'ZT', '中通快递'],
    codePatterns: [
      /取件码\s*[：:]\s*([\d\-A-Za-z]{4,20})/,
      ...COMMON_CODE_PATTERNS,
    ],
    addressPatterns: COMMON_ADDRESS_PATTERNS,
    expirePatterns: COMMON_EXPIRE_PATTERNS,
      phonePatterns: COMMON_PHONE_PATTERNS,
      stationNamePatterns: COMMON_STATION_NAME_PATTERNS,
      businessHoursPatterns: COMMON_BUSINESS_HOURS_PATTERNS,
  },

  // ---------- 申通 ----------
  {
    courier: COURIER_INFO.shentong,
    senderPatterns: [/1069/, /1065/, /申通/, /STO/],
    contentKeywords: ['申通', 'STO', '申通快递'],
    codePatterns: [
      /取件码\s*[：:]\s*([\d\-A-Za-z]{4,20})/,
      ...COMMON_CODE_PATTERNS,
    ],
    addressPatterns: COMMON_ADDRESS_PATTERNS,
    expirePatterns: COMMON_EXPIRE_PATTERNS,
      phonePatterns: COMMON_PHONE_PATTERNS,
      stationNamePatterns: COMMON_STATION_NAME_PATTERNS,
      businessHoursPatterns: COMMON_BUSINESS_HOURS_PATTERNS,
  },

  // ---------- 韵达 ----------
  {
    courier: COURIER_INFO.yunda,
    senderPatterns: [/1069/, /1065/, /韵达/, /YUNDA/],
    contentKeywords: ['韵达', 'YUNDA', '韵达快递'],
    codePatterns: [
      /取件码\s*[：:]\s*([\d\-A-Za-z]{4,20})/,
      ...COMMON_CODE_PATTERNS,
    ],
    addressPatterns: COMMON_ADDRESS_PATTERNS,
    expirePatterns: COMMON_EXPIRE_PATTERNS,
      phonePatterns: COMMON_PHONE_PATTERNS,
      stationNamePatterns: COMMON_STATION_NAME_PATTERNS,
      businessHoursPatterns: COMMON_BUSINESS_HOURS_PATTERNS,
  },

  // ---------- 极兔 ----------
  {
    courier: COURIER_INFO.jitu,
    senderPatterns: [/1069/, /1065/, /极兔/, /J&T/],
    contentKeywords: ['极兔', 'J&T', '极兔速递', '极兔快递'],
    codePatterns: [
      /取件码\s*[：:]\s*([\d\-A-Za-z]{4,20})/,
      ...COMMON_CODE_PATTERNS,
    ],
    addressPatterns: COMMON_ADDRESS_PATTERNS,
    expirePatterns: COMMON_EXPIRE_PATTERNS,
      phonePatterns: COMMON_PHONE_PATTERNS,
      stationNamePatterns: COMMON_STATION_NAME_PATTERNS,
      businessHoursPatterns: COMMON_BUSINESS_HOURS_PATTERNS,
  },

  // ---------- 百世 ----------
  {
    courier: COURIER_INFO.baishi,
    senderPatterns: [/1069/, /1065/, /百世/, /BEST/],
    contentKeywords: ['百世', 'BEST', '百世快递'],
    codePatterns: [
      /取件码\s*[：:]\s*([\d\-A-Za-z]{4,20})/,
      ...COMMON_CODE_PATTERNS,
    ],
    addressPatterns: COMMON_ADDRESS_PATTERNS,
    expirePatterns: COMMON_EXPIRE_PATTERNS,
      phonePatterns: COMMON_PHONE_PATTERNS,
      stationNamePatterns: COMMON_STATION_NAME_PATTERNS,
      businessHoursPatterns: COMMON_BUSINESS_HOURS_PATTERNS,
  },

  // ---------- 德邦 ----------
  {
    courier: COURIER_INFO.deppon,
    senderPatterns: [/95353/, /1069/, /德邦/, /Deppon/],
    contentKeywords: ['德邦', 'Deppon', '德邦快递', '德邦物流'],
    codePatterns: [
      /取件码\s*[：:]\s*([\d\-A-Za-z]{4,20})/,
      ...COMMON_CODE_PATTERNS,
    ],
    addressPatterns: COMMON_ADDRESS_PATTERNS,
    expirePatterns: COMMON_EXPIRE_PATTERNS,
      phonePatterns: COMMON_PHONE_PATTERNS,
      stationNamePatterns: COMMON_STATION_NAME_PATTERNS,
      businessHoursPatterns: COMMON_BUSINESS_HOURS_PATTERNS,
  },

  // ---------- 多多买菜 ----------
  {
    courier: COURIER_INFO.duoduomaicai,
    senderPatterns: [/1069/, /多多/],
    contentKeywords: ['多多买菜', '多多', '团长', '自提点'],
    codePatterns: [
      /取件码\s*[：:]\s*([\d\-A-Za-z]{4,20})/,
      /提货码\s*[：:]\s*(\d{4,8})/,
      ...COMMON_CODE_PATTERNS,
    ],
    addressPatterns: [
      /自提点[：:]\s*(.+?)(?:[，,。.\n]|$)/,
      ...COMMON_ADDRESS_PATTERNS,
    ],
    expirePatterns: COMMON_EXPIRE_PATTERNS,
      phonePatterns: COMMON_PHONE_PATTERNS,
      stationNamePatterns: COMMON_STATION_NAME_PATTERNS,
      businessHoursPatterns: COMMON_BUSINESS_HOURS_PATTERNS,
  },

  // ---------- 美团优选 ----------
  {
    courier: COURIER_INFO.meituanyouxuan,
    senderPatterns: [/1069/, /美团/],
    contentKeywords: ['美团优选', '美团', '团长', '自提点'],
    codePatterns: [
      /取件码\s*[：:]\s*([\d\-A-Za-z]{4,20})/,
      /提货码\s*[：:]\s*(\d{4,8})/,
      ...COMMON_CODE_PATTERNS,
    ],
    addressPatterns: [
      /自提点[：:]\s*(.+?)(?:[，,。.\n]|$)/,
      ...COMMON_ADDRESS_PATTERNS,
    ],
    expirePatterns: COMMON_EXPIRE_PATTERNS,
      phonePatterns: COMMON_PHONE_PATTERNS,
      stationNamePatterns: COMMON_STATION_NAME_PATTERNS,
      businessHoursPatterns: COMMON_BUSINESS_HOURS_PATTERNS,
  },

  // ---------- 通用兜底（快递超市/服务中心等） ----------
  {
    courier: COURIER_INFO.unknown,
    senderPatterns: [/1069/, /1065/],
    contentKeywords: [
      '取件码', '提货码', '快递', '包裹', '驿站', '快递柜',
      '自提柜', '代收点', '快递超市', '服务中心', '妈妈驿站',
      '兔喜', '邻里驿站', '菜鸟', '丰巢', '韵达超市',
    ],
    codePatterns: COMMON_CODE_PATTERNS,
    addressPatterns: COMMON_ADDRESS_PATTERNS,
    expirePatterns: COMMON_EXPIRE_PATTERNS,
      phonePatterns: COMMON_PHONE_PATTERNS,
      stationNamePatterns: COMMON_STATION_NAME_PATTERNS,
      businessHoursPatterns: COMMON_BUSINESS_HOURS_PATTERNS,
  },
];
