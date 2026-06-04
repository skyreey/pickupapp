// ============================================================
// iOS 风格包裹卡片
// ============================================================
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ToastAndroid, TouchableNativeFeedback } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { StatusBadge } from './StatusBadge';
import {
  Shadow, useColors,
  CourierColors, getPickupPointIcon,
} from '../constants/theme';
import type { ColorScheme } from '../constants/theme';
import type { Package } from '../models';
import { formatDate, formatTrackingNumber, getExpiryStatus } from '../utils/formatters';
import { navigateToAddress, callPhoneNumber } from '../utils/navigation';
import { useResponsive } from '../hooks/useResponsive';
import type { ResponsiveConstants } from '../hooks/useResponsive';
import { scaleSize, scaleFont } from '../utils/scaling';

interface Props {
  pkg: Package;
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  onMarkPickedUp?: () => void;
  onUndoPickup?: () => void;
  onTogglePin?: () => void;
  onShare?: () => void;
}

export function PackageCard({ pkg, onPress, onLongPress, selected, onMarkPickedUp, onUndoPickup, onTogglePin, onShare }: Props) {
  const { colors } = useColors();
  const responsive = useResponsive();
  const styles = createStyles(colors, responsive);
  const router = useRouter();
  const courierColor = CourierColors[pkg.carrier] || '#999999';
  const displayTn = pkg.trackingNumber ? formatTrackingNumber(pkg.trackingNumber) : '';

  const handleCopyTn = useCallback(async () => {
    if (!pkg.trackingNumber) return;
    try {
      await Clipboard.setStringAsync(pkg.trackingNumber);
      ToastAndroid.show('单号已复制', ToastAndroid.SHORT);
    } catch {
      // Clipboard 写入失败静默处理
    }
  }, [pkg.trackingNumber]);

  const handleCopyCode = useCallback(async () => {
    if (!pkg.pickupCode) return;
    try {
      await Clipboard.setStringAsync(pkg.pickupCode);
      ToastAndroid.show('取件码已复制', ToastAndroid.SHORT);
    } catch {
      // Clipboard 写入失败静默处理
    }
  }, [pkg.pickupCode]);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/detail/${pkg.id}`);
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { borderLeftWidth: 4, borderLeftColor: courierColor },
        pressed && styles.cardPressed,
        selected && styles.cardSelected,
      ]}
      onPress={handlePress}
      onLongPress={onLongPress}
    >
      {/* 取件点名称 + 状态 + 置顶 */}
      <View style={styles.topRow}>
        {pkg.pickupPointName ? (
          <View style={styles.pickupPointRow}>
            <Text style={styles.pickupPointIcon}>
              {getPickupPointIcon(pkg.pickupPointName)}
            </Text>
            <Text style={styles.pickupPointName}>{pkg.pickupPointName}</Text>
            <StatusBadge status={pkg.currentStatus} size="sm" />
            {pkg.pushedBy ? (
              <Text style={[styles.pinBadge, { color: '#007AFF' }]}>📨 {pkg.pushedBy}</Text>
            ) : pkg.assignedToName ? (
              <Text style={[styles.pinBadge, { color: '#FF9500' }]}>👤 {pkg.assignedToName}</Text>
            ) : null}
            {pkg.pinned ? <Text style={styles.pinBadge}>📦</Text> : null}
          </View>
        ) : <View />}
        {onShare ? (
          <Pressable onPress={onShare} style={styles.shareBtn}>
            <Text style={styles.shareBtnText}>↗ 分享</Text>
          </Pressable>
        ) : null}
      </View>

      {/* 快递行：公司名 + 单号(可复制) + 购买平台 */}
      <View style={styles.courierRow}>
        {(pkg.carrierName && !['菜鸟驿站', '菜鸟', '丰巢', '快递', '其他'].includes(pkg.carrierName)) ? (
          <Text style={styles.courierText}>{pkg.carrierName}</Text>
        ) : null}
        {displayTn ? (
          <Pressable
            onPress={handleCopyTn}
            style={styles.tnCopyBtn}
            hitSlop={8}
            accessibilityLabel={`快递单号 ${displayTn}，双击复制`}
            accessibilityRole="button"
          >
            <Text style={styles.tnCopyText} numberOfLines={1}>{displayTn}</Text>
            <Text style={styles.tnCopyIcon}>📋</Text>
          </Pressable>
        ) : null}
        {!pkg.trackingNumber && !pkg.carrierName ? (
          <Text style={styles.courierText}>{pkg.pickupPointName || '到站包裹'}</Text>
        ) : null}
        {pkg.orderSource ? (
          <Text style={styles.orderSourceText} numberOfLines={1}>{pkg.orderSource}</Text>
        ) : null}
        <View style={{ flex: 1 }} />
      </View>

      {/* 商品名 */}
      {pkg.productName ? (
        <Text style={styles.productName} numberOfLines={2}>
          商品名称  {pkg.productName}
        </Text>
      ) : null}

      {/* 取件码高亮区 — 点击复制 */}
      {pkg.pickupCode ? (
        <Pressable
          style={styles.codeContainer}
          onPress={handleCopyCode}
          accessibilityLabel={`取件码 ${pkg.pickupCode}，双击复制`}
          accessibilityRole="button"
        >
          <Text style={styles.codeLabel}>取件码（点击复制）</Text>
          <Text style={styles.codeValue}>{pkg.pickupCode}</Text>
        </Pressable>
      ) : null}

      {/* 联系电话 */}
      {pkg.pickupPointPhone ? (
        <View style={styles.stationRow}>
          <Text style={styles.infoIcon}>📞</Text>
          <Pressable
            style={styles.phoneBtn}
            onPress={() => callPhoneNumber(pkg.pickupPointPhone!)}
            accessibilityLabel={`拨打快递点电话 ${pkg.pickupPointPhone}`}
            accessibilityRole="button"
          >
            <Text style={styles.phoneBtnText}>联系电话</Text>
          </Pressable>
        </View>
      ) : null}

      {/* 地址 + 导航按钮（同一行） */}
      {pkg.pickupAddress ? (
        <View style={styles.addressRow}>
          <Text style={styles.infoIcon}>📍</Text>
          <Text style={styles.addressText} numberOfLines={2}>
            {pkg.pickupAddress}
            <Text style={styles.navSeparator}> · </Text>
          </Text>
          <Pressable
            style={styles.navBtn}
            onPress={() => navigateToAddress(pkg.pickupAddress!, pkg.pickupPointName || pkg.carrierName)}
            accessibilityLabel={`导航到 ${pkg.pickupAddress}`}
            accessibilityRole="button"
          >
            <Text style={styles.navBtnText}>🧭去这里</Text>
          </Pressable>
        </View>
      ) : null}

      {/* 操作按钮区 — 使用 TouchableNativeFeedback 绕过 RN 0.83.6 Pressable touch bug */}
      <View style={styles.actionArea}>
        {pkg.currentStatus !== 'picked_up' ? (
          <TouchableNativeFeedback
            onPress={() => onMarkPickedUp?.()}
            background={TouchableNativeFeedback.Ripple('#ffffff44', false)}
            accessibilityLabel={`标记包裹 ${pkg.productName || pkg.carrierName} 为已取件`}
          >
            <View style={styles.pickupBtn}>
              <Text style={styles.pickupBtnText}>✓ 标记已取件</Text>
            </View>
          </TouchableNativeFeedback>
        ) : (
          <TouchableNativeFeedback
            onPress={() => onUndoPickup?.()}
            background={TouchableNativeFeedback.Ripple('#ffffff44', false)}
            accessibilityLabel={`撤销取件 ${pkg.productName || pkg.carrierName}`}
          >
            <View style={styles.undoBtn}>
              <Text style={styles.undoBtnText}>↩ 撤销取件</Text>
            </View>
          </TouchableNativeFeedback>
        )}
      </View>

      {/* 底部：时间 + 过期倒计时 + 营业时间 */}
      <View style={styles.footer}>
        <Text style={styles.time}>{formatDate(pkg.createdAt).slice(0, -3)}</Text>
        <View style={styles.footerRight}>
          {(() => {
            if (!pkg.expiresAt || pkg.expiresAt <= 0 || pkg.currentStatus === 'picked_up') return null;
            const es = getExpiryStatus(pkg.expiresAt);
            if (!es.label) return null;
            return (
              <Text style={[styles.expiryLabel, es.expired && styles.expiryLabelExpired]}>
                {es.label}
              </Text>
            );
          })()}
          {pkg.businessHours ? (
            <Text style={styles.businessHours}>{pkg.businessHours}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const createStyles = (colors: ColorScheme, r: ResponsiveConstants) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: r.scaledBorderRadius.lg,
    padding: r.scaledSpacing.lg,
    marginHorizontal: r.scaledSpacing.lg,
    marginVertical: r.scaledSpacing.sm,
    ...Shadow.card,
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.985 }],
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  courierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: r.scaledSpacing.sm,
  },
  courierText: {
    fontSize: r.scaledFontSize.subhead,
    fontWeight: '500',
    color: colors.textPrimary,
    marginRight: r.scaledSpacing.sm,
    flexShrink: 1,
  },
  productName: {
    fontSize: r.scaledFontSize.footnote,
    color: colors.textSecondary,
    marginBottom: r.scaledSpacing.sm,
    marginLeft: r.scaledSpacing.xl,
    lineHeight: scaleFont(18),
  },
  codeContainer: {
    backgroundColor: colors.secondarySurface,
    borderRadius: r.scaledBorderRadius.md,
    paddingVertical: r.scaledSpacing.md,
    paddingHorizontal: r.scaledSpacing.lg,
    marginBottom: r.scaledSpacing.md,
    flexDirection: 'column',
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: r.scaledFontSize.caption1,
    color: colors.textSecondary,
    marginBottom: r.scaledSpacing.xs,
  },
  codeValue: {
    fontSize: r.scaledFontSize.pickupCode,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: scaleSize(2),
  },
  // 顶部行：取件点 + 置顶/分享操作
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: r.scaledSpacing.md,
  },
  pinBadge: {
    fontSize: scaleFont(12),
    color: '#FF9500',
    marginLeft: scaleSize(4),
  },
  shareBtn: {
    backgroundColor: colors.primary + '15',
    borderRadius: r.scaledBorderRadius.sm,
    paddingHorizontal: scaleSize(12),
    paddingVertical: scaleSize(6),
  },
  shareBtnText: {
    fontSize: r.scaledFontSize.subhead,
    color: colors.primary,
    fontWeight: '600',
  },
  // 取件点名称行：图标 + 名称
  pickupPointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pickupPointIcon: {
    fontSize: scaleFont(18),
    marginRight: scaleSize(6),
  },
  pickupPointName: {
    fontSize: r.scaledFontSize.subhead,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  // 站点行：📞联系电话
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scaleSize(2),
  },
  infoIcon: {
    fontSize: scaleFont(13),
    marginRight: scaleSize(6),
    width: scaleSize(18),
    textAlign: 'center',
  },
  stationNameText: {
    flex: 1,
    fontSize: r.scaledFontSize.footnote,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  phoneBtn: {
    marginLeft: r.scaledSpacing.sm,
    paddingHorizontal: scaleSize(6),
    paddingVertical: scaleSize(3),
  },
  phoneBtnText: {
    fontSize: r.scaledFontSize.caption1,
    color: colors.primary,
    fontWeight: '500',
  },
  // 地址行：📍 + 地址 + 🧭去这里
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: scaleSize(2),
    marginTop: scaleSize(1),
    minHeight: scaleSize(42),
  },
  addressText: {
    flex: 1,
    fontSize: r.scaledFontSize.footnote,
    color: colors.textSecondary,
    lineHeight: scaleFont(18),
  },
  navBtn: {
    marginLeft: r.scaledSpacing.sm,
    paddingHorizontal: scaleSize(6),
    paddingVertical: scaleSize(3),
  },
  navBtnText: {
    fontSize: r.scaledFontSize.caption1,
    color: colors.primary,
    fontWeight: '500',
  },
  navSeparator: {
    color: colors.textTertiary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: r.scaledSpacing.xs,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(6),
  },
  time: {
    fontSize: r.scaledFontSize.caption1,
    color: colors.textTertiary,
  },
  expiryLabel: {
    fontSize: r.scaledFontSize.caption1,
    color: '#FF9500',
    fontWeight: '600',
  },
  expiryLabelExpired: {
    color: '#FF3B30',
  },
  businessHours: {
    fontSize: r.scaledFontSize.caption1,
    color: colors.textTertiary,
    flexShrink: 1,
  },
  pickupBtn: {
    backgroundColor: colors.success,
    borderRadius: r.scaledBorderRadius.md,
    paddingVertical: scaleSize(12),
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  pickupBtnText: {
    color: '#FFFFFF',
    fontSize: r.scaledFontSize.subhead,
    fontWeight: '700',
  },
  undoBtn: {
    backgroundColor: colors.secondarySurface,
    borderRadius: r.scaledBorderRadius.md,
    paddingVertical: scaleSize(12),
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  undoBtnText: {
    color: colors.textSecondary,
    fontSize: r.scaledFontSize.subhead,
    fontWeight: '600',
  },
  tnCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondarySurface,
    borderRadius: r.scaledBorderRadius.md,
    paddingHorizontal: r.scaledSpacing.sm,
    paddingVertical: r.scaledSpacing.xs,
    marginRight: r.scaledSpacing.sm,
  },
  tnCopyText: {
    fontSize: r.scaledFontSize.subhead,
    fontWeight: '600',
    color: colors.primary,
    fontFamily: 'monospace',
  },
  tnCopyIcon: {
    fontSize: scaleFont(11),
    marginLeft: scaleSize(4),
    color: colors.primary,
  },
  orderSourceText: {
    fontSize: r.scaledFontSize.footnote,
    color: colors.textTertiary,
    flexShrink: 1,
    marginLeft: scaleSize(4),
  },
  actionArea: {
    minHeight: 44,
    justifyContent: 'center',
    marginTop: r.scaledSpacing.sm,
  },
});
