// Simulate normalizeText
const normalizeText = (text) => text
  .replace(/：/g, ':')
  .replace(/（/g, '(')
  .replace(/）/g, ')')
  .replace(/，/g, ',')
  .replace(/。/g, '.')
  .replace(/；/g, ';')
  .replace(/！/g, '!')
  .replace(/？/g, '?')
  .replace(/＂/g, '"')
  .replace(/＇/g, "'")
  .replace(/【/g, '[')
  .replace(/】/g, ']')
  .replace(/　/g, ' ')
  .trim();

const sms = '【兔喜生活】您有包裹已到达鸭旺口小区20号楼兔喜生活，取件码为8-3-4836';
const normalized = normalizeText(sms);
console.log('Normalized:', normalized);
console.log('');

// Test all main address patterns
const p106 = /(?:已到(?!站|达)|已送达|已送至|已到达|存放于|存放至|已存至|已到站|已抵达|已放置于|已投递至|已入柜)\s*(.+?)\s*(?:[，,。.\n]|取件码|提货码|包裹码|提取码|联系电话|联系|电话|营业时间|工作时间|请凭|请到|请前|请尽快|过期|快递柜|丰巢|菜鸟|兔喜|妈妈驿站|韵达超市|快递超市|邻里驿站|自提柜|代收点|驿站|【|\{|咨询|详询|有问题|如需|速来|$)/;
const p108 = /(?:快递|您的快递|包裹|您的包裹|运单)\s*(?:已到(?!站|达)|已送达|已到达|已送至|在)\s*(.+?)\s*(?:[，,。.\n]|取件码|提货码|包裹码|提取码|联系电话|联系|电话|营业时间|工作时间|请凭|请到|请前|请尽快|过期|快递柜|丰巢|菜鸟|兔喜|妈妈驿站|韵达超市|快递超市|邻里驿站|自提柜|代收点|驿站|【|\{|咨询|详询|有问题|如需|速来|$)/;
const p116 = /([一-龥]{2,8}(?:小区|社区|新村|花园|公寓|园区|村|镇|乡|路|街|道|巷|弄|里|园|苑|坊|庄|屯|营|堡|号|号楼|栋|幢|楼|单元|室|门头房|门面|底商|商铺|大厦|广场|商场|超市|市场|学院|学校|大学|医院|银行|邮局)[一-龥\d\-\s]*(?:菜鸟驿站|妈妈驿站|丰巢|快递|兔喜|韵达超市|快递超市|邻里驿站|自提柜|代收点|快递柜|驿站)?)/;

// Also test ALL patterns that will be tried (Layer 1 first)
const p99 = /(?:取件地址|驿站地址|柜机地址|自提地址|领取地址|取货地址|收货地址|快递地址)\s*[：:]\s*(.+?)(?:[，,。.\n]|取件码|联系电话|营业时间|请凭|过期|$)/;
const p100 = /地址\s*[：:]\s*(.+?)(?:[，,。.\n]|取件码|联系电话|营业时间|请凭|过期|$)/;
const p101 = /地点\s*[：:]\s*(.+?)(?:[，,。.\n]|取件码|联系电话|营业时间|请凭|过期|$)/;
const p102 = /(?:取件地点|自提地点|领取地点|取货地点|收货地点)\s*[：:]\s*(.+?)(?:[，,。.\n]|取件码|联系电话|营业时间|请凭|过期|$)/;
const p110 = /请到[：:]?\s*(.+?)\s*(?:取件|取货|领取)/;
const p111 = /前往[：:]?\s*(.+?)\s*(?:取件|取货|领取|自提)/;
const p112 = /至[：:]?\s*(.+?)\s*(?:取件|取货|领取)/;

const patterns = [
  ['p99 label', p99],
  ['p100 addr:', p100],
  ['p101 loc:', p101],
  ['p102 pickupLoc:', p102],
  ['p106 action-no-prefix', p106],
  ['p108 action-with-prefix', p108],
  ['p110 qingdao', p110],
  ['p111 qianwang', p111],
  ['p112 zhi', p112],
  ['p116 layer3', p116],
];

const NON_ADDR = [
  /^(顺丰|圆通|中通|申通|韵达|极兔|百世|京东|德邦|菜鸟|丰巢|EMS|邮政|德邦物流|京东快递|顺丰速运|圆通速递|中通快递|申通快递|韵达快递|极兔速递|百世快递|邮政EMS)$/,
  /^(淘宝|天猫|京东|拼多多|抖音|快手|1688|闲鱼|苏宁|唯品会|美团|小红书|小米商城)$/,
  /^(已发货|已签收|已取件|运输中|派送中|待取件|已揽收|已发出|已到达)$/,
  /^[A-Z]{1,4}\d{6,20}$/,
  /^\d{1,2}[-\s]\d{1,2}[-\s]\d{4,6}$/,
  /^[\d\-\s]{4,20}$/,
  /^\d{6,10}$/,
];
const ADDR_FEATURES = [
  /(?:路|街|道|巷|弄|里|园|苑|坊|庄|屯|营|堡)/,
  /(?:号|栋|幢|楼|层|单元|室)/,
  /(?:小区|社区|新村|花园|公寓|广场|大厦|中心|商城)/,
  /(?:村|镇|乡|县|区|市|省)/,
  /(?:驿站|快递柜|丰巢|菜鸟|妈妈驿站|兔喜|韵达超市|邻里驿站|自提柜|代收点|快递超市)/,
  /(?:店|铺|门头房|门面|底商|商铺)/,
  /(?:学校|学院|大学|医院|商场|超市|市场|银行|邮局)/,
  /(?:座|层|F\d|B\d)/i,
];

function isValidAddress(text) {
  if (!text || text.length < 4) return false;
  if (NON_ADDR.some(p => p.test(text))) return false;
  if (!/[一-龥]/.test(text)) return false;
  if (!ADDR_FEATURES.some(p => p.test(text))) return false;
  return true;
}

console.log('Extract address simulation (order matters):');
console.log('');

for (const [name, pattern] of patterns) {
  const m = normalized.match(pattern);
  if (m) {
    const addr = m[1].trim();
    const valid = isValidAddress(addr);
    console.log(name + ': capture=' + JSON.stringify(addr) + ' valid=' + valid + ' | full match=' + JSON.stringify(m[0]));
    if (valid) {
      console.log('  ==> WOULD RETURN: ' + addr);
      break;
    }
  } else {
    console.log(name + ': NO MATCH');
  }
}
