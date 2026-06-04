// ============================================================
// Package 工厂函数 — 统一构造入口
//
// 背景：sms-listener 和 notification-listener 中各有几乎完全相同的
// Package 对象构造逻辑（20行+），新增字段时极易遗漏。
// 这个文件是所有新建包裹的唯一入口。
// ============================================================
import { generateId } from './formatters';
import type { Package, PackageStatus, PackageSource, CarrierCode } from '../models';

interface CreatePackageParams {
  trackingNumber?: string;
  carrier?: CarrierCode;
  carrierName?: string;
  orderSource?: string;
  productName?: string;
  pickupCode?: string | null;
  pickupAddress?: string | null;
  pickupPointName?: string | null;
  pickupPointPhone?: string | null;
  businessHours?: string | null;
  notes?: string | null;
  tailNumber?: string | null;     // 快递单号尾号（仅有后几位时使用）
  currentStatus: PackageStatus;
  source: PackageSource;
  createdAt?: number;
  pickedUpAt?: number;
  expiresAt?: number;
  smsRawText?: string | null;
  screenshotPaths?: string | null;
  assignedTo?: string | null;
  assignedToName?: string | null;
  pushedBy?: string | null;
  pushStatus?: string | null;
}

/**
 * 创建包裹记录（所有新建包裹的唯一入口）
 *
 * 用法：
 *   const pkg = createPackage({
 *     trackingNumber: 'SF1234567890',
 *     carrier: 'shunfeng',
 *     carrierName: '顺丰速运',
 *     pickupCode: '8-3-5021',
 *     currentStatus: 'stored',
 *     source: 'sms',
 *   });
 *   insertPackage(pkg);
 */
export function createPackage(params: CreatePackageParams): Package {
  const now = Date.now();
  const createdAt = params.createdAt && params.createdAt > 0 ? params.createdAt : now;

  return {
    id: generateId(),
    trackingNumber: params.trackingNumber || (params.tailNumber ? `尾号${params.tailNumber}` : ''),
    carrier: params.carrier || 'unknown',
    carrierName: params.carrierName || '快递',
    orderSource: params.orderSource || '',
    productName: params.productName || '',
    pickupCode: params.pickupCode ?? null,
    pickupAddress: params.pickupAddress ?? null,
    pickupPointName: params.pickupPointName ?? null,
    pickupPointPhone: params.pickupPointPhone ?? null,
    businessHours: params.businessHours ?? null,
    notes: params.notes ?? null,
    currentStatus: params.currentStatus,
    statusUpdatedAt: now,
    source: params.source,
    createdAt,
    pickedUpAt: params.pickedUpAt ?? 0,
    expiresAt: params.expiresAt ?? 0,
    pinned: false,
    smsRawText: params.smsRawText ?? null,
    screenshotPaths: params.screenshotPaths ?? null,
    assignedTo: params.assignedTo ?? null,
    assignedToName: params.assignedToName ?? null,
    pushedBy: params.pushedBy ?? null,
    pushStatus: params.pushStatus ?? null,
  };
}
