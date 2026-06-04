// ============================================================
// 快递公司工具函数
// 从 sms-parser.ts 抽出，打破 cn-tokenizer ↔ sms-parser 循环引用
// ============================================================
import type { CarrierCode } from '../models';

/** 根据快递单号前缀推断快递公司 */
export function guessCarrierByTrackingNumber(tn: string): { code: CarrierCode; name: string } {
  const upper = tn.toUpperCase();
  if (upper.startsWith('SF'))    return { code: 'shunfeng',  name: '顺丰速运' };
  if (upper.startsWith('YT'))    return { code: 'yuantong',  name: '圆通速递' };
  if (upper.startsWith('JT'))    return { code: 'jitu',      name: '极兔速递' };
  if (upper.startsWith('JD'))    return { code: 'jingdong',  name: '京东快递' };
  if (upper.startsWith('STO'))   return { code: 'shentong',  name: '申通快递' };
  if (upper.startsWith('YUNDA')) return { code: 'yunda',     name: '韵达快递' };
  if (upper.startsWith('DPK'))   return { code: 'deppon',    name: '德邦快递' };
  if (/^[A-Z]{2}\d{9,13}$/.test(upper)) return { code: 'ems', name: '邮政EMS' };

  // 数字开头的推断
  if (/^77\d{10,}/.test(upper) || /^78\d{10,}/.test(upper))
    return { code: 'zhongtong', name: '中通快递' };
  if (/^88\d{10,}/.test(upper))
    return { code: 'ems', name: '邮政EMS' };

  return { code: 'unknown', name: '快递' };
}
