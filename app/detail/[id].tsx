// ============================================================
// 包裹详情页
// ============================================================
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Button, StyleSheet, Alert, TextInput, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePackageDetail } from '../../src/hooks/usePackages';
import { PickupCodeBanner } from '../../src/components/PickupCodeBanner';
import { StatusBadge } from '../../src/components/StatusBadge';
import { updatePackageInfo, markAsPickedUp, togglePin, assignPackage } from '../../src/database/dao';
import { getMembers, findMember } from '../../src/services/family-service';
import type { FamilyMember } from '../../src/models';
import { initDatabase } from '../../src/database';
import { navigateToAddress, callPhoneNumber } from '../../src/utils/navigation';
import {
  Shadow, useColors,
  CourierIcons, CourierColors, PlatformIcons,
} from '../../src/constants/theme';
import type { ColorScheme } from '../../src/constants/theme';
import { formatDate, formatTrackingNumber, getExpiryStatus, formatPackageForShare } from '../../src/utils/formatters';
import { useResponsive } from '../../src/hooks/useResponsive';
import type { ResponsiveConstants } from '../../src/hooks/useResponsive';
import { scaleSize, scaleFont } from '../../src/utils/scaling';

export default function DetailScreen() {
  const { colors } = useColors();
  const responsive = useResponsive();
  const styles = createStyles(colors, responsive);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { pkg, loading, refresh, deletePackage } = usePackageDetail(id);
  const [editing, setEditing] = useState(false);
  const [editProductName, setEditProductName] = useState('');
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    initDatabase();
  }, []);

  if (!pkg && !loading) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📭</Text>
        <Text style={styles.emptyText}>包裹不存在</Text>
      </View>
    );
  }

  if (!pkg) return null;

  const courierIcon = CourierIcons[pkg.carrier] || '📦';
  const courierColor = CourierColors[pkg.carrier] || '#999999';
  const platformIcon = PlatformIcons[pkg.orderSource] || '';

  const handleDelete = () => {
    Alert.alert('删除包裹', '确定要删除此包裹记录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: () => { deletePackage(); router.back(); },
      },
    ]);
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: formatPackageForShare(pkg) });
    } catch {}
  };

  const [showAssign, setShowAssign] = useState(false);
  const [members, setMembers] = useState<FamilyMember[]>([]);

  useEffect(() => { getMembers().then(setMembers); }, []);

  const handleTogglePin = () => {
    togglePin(pkg.id);
    refresh();
  };

  const handleAssign = async (memberId: string | null, memberName: string | null) => {
    assignPackage(pkg.id, memberId, memberName);
    setShowAssign(false);
    refresh();
  };

  const expiresAt = pkg.expiresAt || 0;
  const expiry = expiresAt > 0 ? getExpiryStatus(expiresAt) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* 取件码横幅 */}
      {pkg.pickupCode ? (
        <PickupCodeBanner code={pkg.pickupCode} companyName={pkg.carrierName} />
      ) : null}

      {/* 取件点信息卡片 */}
      {pkg.pickupPointName || pkg.pickupPointPhone || pkg.pickupAddress ? (
        <View style={styles.stationCard}>
          <Text style={styles.stationSectionTitle}>取件点</Text>

          {pkg.pickupPointName ? (
            <View style={styles.stationRow}>
              <Text style={styles.stationIcon}>🏪</Text>
              <Text style={styles.stationName}>{pkg.pickupPointName}</Text>
            </View>
          ) : null}

          {pkg.pickupPointPhone ? (
            <View style={styles.stationRow}>
              <Text style={styles.stationIcon}>📞</Text>
              <Text style={styles.stationPhone}>{pkg.pickupPointPhone}</Text>
              <Pressable
                style={styles.callButton}
                onPress={() => callPhoneNumber(pkg.pickupPointPhone!)}
              >
                <Text style={styles.callButtonText}>拨打</Text>
              </Pressable>
            </View>
          ) : null}

          {pkg.pickupAddress ? (
            <View style={styles.stationRow}>
              <Text style={styles.stationIcon}>📍</Text>
              <Text style={styles.stationAddress}>{pkg.pickupAddress}</Text>
            </View>
          ) : null}

          <Pressable
            style={styles.navButton}
            onPress={() => navigateToAddress(
              pkg.pickupAddress || pkg.pickupPointName || '',
              pkg.pickupPointName,
            )}
          >
            <Text style={styles.navButtonText}>🧭 导航至此</Text>
          </Pressable>
        </View>
      ) : null}

      {/* 包裹信息卡片 */}
      <View style={[styles.infoCard, { borderLeftWidth: 4, borderLeftColor: courierColor }]}>
        {/* 商品信息 */}
        {pkg.productName ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>商品</Text>
            {platformIcon ? <Text style={{ marginRight: 4 }}>{platformIcon}</Text> : null}
            <Text style={styles.infoValue}>{pkg.productName}</Text>
          </View>
        ) : null}

        {/* 来源平台 */}
        {pkg.orderSource ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>平台</Text>
            <Text style={styles.infoValue}>{pkg.orderSource}</Text>
          </View>
        ) : null}

        {/* 快递信息 */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>快递</Text>
          <View style={[styles.courierIconBadge, { backgroundColor: courierColor + '22' }]}>
            <Text style={styles.courierIcon}>{courierIcon}</Text>
          </View>
          <Text style={styles.infoValue}>{pkg.carrierName}</Text>
        </View>

        {/* 快递单号 */}
        {pkg.trackingNumber ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>单号</Text>
            <Text style={[styles.infoValue, styles.monoText]}>
              {formatTrackingNumber(pkg.trackingNumber)}
            </Text>
          </View>
        ) : null}

        {/* 取件地址 */}
        {pkg.pickupAddress ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>地址</Text>
            <Text style={styles.infoValue}>{pkg.pickupAddress}</Text>
          </View>
        ) : null}

        {/* 状态 */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>状态</Text>
          <StatusBadge status={pkg.currentStatus} />
        </View>

        {/* 取件截止时间 */}
        {expiry ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>截止</Text>
            <Text style={[styles.infoValue, expiry.expired && { color: '#FF3B30', fontWeight: '700' }]}>
              {expiry.expired ? '⚠ ' : ''}{expiry.label}
              {' · '}
              {formatDate(expiresAt).slice(0, -3)}
            </Text>
          </View>
        ) : null}

        {/* 更新时间 */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>更新</Text>
          <Text style={styles.infoValue}>{formatDate(pkg.statusUpdatedAt)}</Text>
        </View>

        {/* 取件时间 */}
        {pkg.currentStatus === 'picked_up' && pkg.pickedUpAt ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>取件</Text>
            <Text style={styles.infoValue}>{formatDate(pkg.pickedUpAt)}</Text>
          </View>
        ) : null}
      </View>

      {/* 编辑按钮 */}
      {!editing ? (
        <Pressable
          style={styles.editButton}
          onPress={() => {
            setEditProductName(pkg.productName || '');
            setEditNotes(pkg.notes || '');
            setEditing(true);
          }}
        >
          <Text style={styles.editButtonText}>✏️ 编辑商品/备注</Text>
        </Pressable>
      ) : null}

      {/* 编辑表单 */}
      {editing ? (
        <View style={styles.editForm}>
          <Text style={styles.editFormTitle}>编辑包裹信息</Text>
          <Text style={styles.editLabel}>商品名称</Text>
          <TextInput
            style={styles.editInput}
            value={editProductName}
            onChangeText={setEditProductName}
            placeholder="如：手机壳、零食..."
            placeholderTextColor={colors.textPlaceholder}
          />
          <Text style={styles.editLabel}>备注</Text>
          <TextInput
            style={[styles.editInput, styles.editNotesInput]}
            value={editNotes}
            onChangeText={setEditNotes}
            placeholder="如：记得带身份证、周末去取..."
            placeholderTextColor={colors.textPlaceholder}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <View style={styles.editActions}>
            <Pressable
              style={styles.editCancelBtn}
              onPress={() => setEditing(false)}
            >
              <Text style={styles.editCancelText}>取消</Text>
            </Pressable>
            <Pressable
              style={styles.editSaveBtn}
              onPress={() => {
                updatePackageInfo(pkg.id, editProductName, editNotes);
                refresh();
                setEditing(false);
              }}
            >
              <Text style={styles.editSaveText}>保存</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* 分配给家人 */}
      {pkg.assignedToName ? (
        <View style={styles.assignedBanner}>
          <Text style={styles.assignedIcon}>👤</Text>
          <Text style={styles.assignedText}>已分配给 {pkg.assignedToName} 取件</Text>
          <Pressable onPress={() => handleAssign(null, null)}><Text style={styles.assignedUndo}>撤销</Text></Pressable>
        </View>
      ) : null}

      {showAssign && members.length > 0 && (
        <View style={styles.assignSheet}>
          <Text style={styles.assignSheetTitle}>分配给家人取件</Text>
          <Pressable style={styles.assignOption} onPress={() => handleAssign(null, null)}>
            <Text style={styles.assignOptionText}>🙋 我自己取</Text>
          </Pressable>
          {members.map(m => (
            <Pressable key={m.id} style={[styles.assignOption, { borderLeftColor: m.color, borderLeftWidth: 3 }]} onPress={() => handleAssign(m.id, m.name)}>
              <View style={[styles.assignDot, { backgroundColor: m.color }]} />
              <Text style={styles.assignOptionText}>{m.name}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.assignCancel} onPress={() => setShowAssign(false)}>
            <Text style={styles.assignCancelText}>取消</Text>
          </Pressable>
        </View>
      )}

      {/* 快捷操作栏 */}
      <View style={styles.quickActions}>
        <Pressable style={styles.quickBtn} onPress={handleTogglePin}>
          <Text style={styles.quickBtnText}>{pkg.pinned ? '📌 取消置顶' : '📌 置顶'}</Text>
        </Pressable>
        <Pressable style={styles.quickBtn} onPress={() => { getMembers().then(setMembers); setShowAssign(true); }}>
          <Text style={styles.quickBtnText}>👤 {pkg.assignedToName ? '改分配' : '分配给'}</Text>
        </Pressable>
        <Pressable style={styles.quickBtn} onPress={async () => {
          try {
            const { getSetting } = require('../../modules/expo-notification-reader');
            const phone = await getSetting('my_phone') || '';
            const lines = [
              '📦 取件通代取',
              phone ? `来自：${phone}` : '',
              pkg.pickupCode ? `取件码：${pkg.pickupCode}` : '',
              pkg.carrierName ? `快递：${pkg.carrierName}` : '',
              pkg.pickupPointName ? `驿站：${pkg.pickupPointName}` : '',
              pkg.pickupAddress ? `地址：${pkg.pickupAddress}` : '',
              pkg.pickupPointPhone ? `电话：${pkg.pickupPointPhone}` : '',
              pkg.productName ? `物品：${pkg.productName}` : '',
            ].filter(Boolean).join('\n');
            await Share.share({ message: lines });
          } catch {}
        }}>
          <Text style={styles.quickBtnText}>📤 分享代取</Text>
        </Pressable>
      </View>

      {/* 操作按钮 */}
      <View style={styles.actions}>
        {pkg.currentStatus !== 'picked_up' ? (
          <View style={styles.btnPrimary}>
            <Button
              title="标记已取件"
              color="#34C759"
              onPress={() => {
                try {
                  markAsPickedUp(pkg.id);
                  refresh();
                } catch (e: any) {
                  Alert.alert('错误', e.message || String(e));
                }
              }}
            />
          </View>
        ) : null}
        <View style={styles.btnDanger}>
          <Button
            title="删除此包裹"
            color="#FF3B30"
            onPress={handleDelete}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ColorScheme, r: ResponsiveConstants) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: scaleSize(120),
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  emptyIcon: {
    fontSize: scaleFont(48),
    marginBottom: r.scaledSpacing.md,
  },
  emptyText: {
    fontSize: r.scaledFontSize.body,
    color: colors.textSecondary,
  },
  infoCard: {
    backgroundColor: colors.surface,
    marginHorizontal: r.scaledSpacing.lg,
    borderRadius: r.scaledBorderRadius.lg,
    padding: r.scaledSpacing.lg,
    ...Shadow.card,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: r.scaledSpacing.sm,
    borderBottomWidth: scaleSize(0.5),
    borderBottomColor: colors.separator,
  },
  infoLabel: {
    width: scaleSize(44),
    fontSize: r.scaledFontSize.subhead,
    color: colors.textSecondary,
  },
  infoValue: {
    flex: 1,
    fontSize: r.scaledFontSize.subhead,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  courierIconBadge: {
    width: scaleSize(28),
    height: scaleSize(28),
    borderRadius: scaleSize(8),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scaleSize(6),
  },
  courierIcon: {
    fontSize: scaleFont(14),
  },
  monoText: {
    fontFamily: 'monospace',
    fontSize: r.scaledFontSize.footnote,
  },
  sectionTitle: {
    fontSize: r.scaledFontSize.footnote,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: scaleSize(0.5),
    paddingHorizontal: r.scaledSpacing.lg,
    paddingTop: r.scaledSpacing.xl,
    paddingBottom: r.scaledSpacing.sm,
  },
  actions: {
    paddingHorizontal: r.scaledSpacing.lg,
    paddingTop: r.scaledSpacing.xl,
  },
  btnPrimary: {
    marginBottom: r.scaledSpacing.sm,
    borderRadius: r.scaledBorderRadius.md,
    overflow: 'hidden',
    minHeight: 44,
  },
  btnDanger: {
    borderRadius: r.scaledBorderRadius.md,
    borderWidth: 1,
    borderColor: colors.separator,
    overflow: 'hidden',
    minHeight: 44,
  },
  stationCard: {
    backgroundColor: colors.surface,
    marginHorizontal: r.scaledSpacing.lg,
    borderRadius: r.scaledBorderRadius.lg,
    padding: r.scaledSpacing.lg,
    ...Shadow.card,
    marginBottom: r.scaledSpacing.sm,
  },
  stationSectionTitle: {
    fontSize: r.scaledFontSize.footnote,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: r.scaledSpacing.md,
  },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scaleSize(6),
  },
  stationIcon: {
    fontSize: scaleFont(16),
    marginRight: r.scaledSpacing.sm,
    width: scaleSize(24),
    textAlign: 'center',
  },
  stationName: {
    fontSize: r.scaledFontSize.subhead,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  stationPhone: {
    fontSize: r.scaledFontSize.subhead,
    color: colors.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  stationAddress: {
    fontSize: r.scaledFontSize.footnote,
    color: colors.textSecondary,
    flex: 1,
  },
  callButton: {
    backgroundColor: colors.success,
    borderRadius: r.scaledBorderRadius.sm,
    paddingHorizontal: r.scaledSpacing.md,
    paddingVertical: scaleSize(4),
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: r.scaledFontSize.caption1,
    fontWeight: '600',
  },
  navButton: {
    backgroundColor: colors.primary,
    borderRadius: r.scaledBorderRadius.md,
    paddingVertical: r.scaledSpacing.md,
    alignItems: 'center',
    marginTop: r.scaledSpacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  navButtonText: {
    color: '#FFFFFF',
    fontSize: r.scaledFontSize.body,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: colors.surface,
    marginHorizontal: r.scaledSpacing.lg,
    marginBottom: r.scaledSpacing.md,
    borderRadius: r.scaledBorderRadius.md,
    paddingVertical: r.scaledSpacing.md,
    alignItems: 'center',
    borderWidth: scaleSize(1),
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  editButtonText: {
    color: colors.primary,
    fontSize: r.scaledFontSize.subhead,
    fontWeight: '500',
  },
  editForm: {
    backgroundColor: colors.surface,
    marginHorizontal: r.scaledSpacing.lg,
    marginBottom: r.scaledSpacing.md,
    borderRadius: r.scaledBorderRadius.lg,
    padding: r.scaledSpacing.lg,
    ...Shadow.card,
  },
  editFormTitle: {
    fontSize: r.scaledFontSize.headline,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: r.scaledSpacing.md,
  },
  editLabel: {
    fontSize: r.scaledFontSize.subhead,
    color: colors.textSecondary,
    marginBottom: scaleSize(4),
    marginTop: r.scaledSpacing.sm,
  },
  editInput: {
    backgroundColor: colors.secondarySurface,
    borderRadius: r.scaledBorderRadius.md,
    paddingHorizontal: r.scaledSpacing.md,
    paddingVertical: r.scaledSpacing.sm,
    fontSize: r.scaledFontSize.body,
    color: colors.textPrimary,
  },
  editNotesInput: {
    minHeight: scaleSize(72),
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: r.scaledSpacing.sm,
    marginTop: r.scaledSpacing.lg,
  },
  editCancelBtn: {
    paddingVertical: r.scaledSpacing.sm,
    paddingHorizontal: r.scaledSpacing.lg,
    borderRadius: r.scaledBorderRadius.md,
  },
  editCancelText: {
    color: colors.textSecondary,
    fontSize: r.scaledFontSize.subhead,
    fontWeight: '500',
  },
  editSaveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: r.scaledSpacing.sm,
    paddingHorizontal: r.scaledSpacing.xl,
    borderRadius: r.scaledBorderRadius.md,
  },
  editSaveText: {
    color: '#FFFFFF',
    fontSize: r.scaledFontSize.subhead,
    fontWeight: '600',
  },
  // 快捷操作栏
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: r.scaledSpacing.lg,
    paddingBottom: r.scaledSpacing.md,
    gap: r.scaledSpacing.sm,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: r.scaledBorderRadius.md,
    paddingVertical: r.scaledSpacing.md,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: colors.separator,
  },
  quickBtnText: {
    fontSize: r.scaledFontSize.subhead,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  assignedBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF950010', marginHorizontal: r.scaledSpacing.lg, borderRadius: 8, padding: r.scaledSpacing.md, marginBottom: r.scaledSpacing.sm, borderLeftWidth: 3, borderLeftColor: '#FF9500' },
  assignedText: { flex: 1, fontSize: r.scaledFontSize.subhead, color: '#FF9500', fontWeight: '600' },
  assignedUndo: { fontSize: r.scaledFontSize.caption1, color: colors.textTertiary, paddingHorizontal: 8 },
  assignSheet: { backgroundColor: colors.surface, marginHorizontal: r.scaledSpacing.lg, borderRadius: 16, padding: 16, marginBottom: r.scaledSpacing.sm, ...Shadow.card },
  assignSheetTitle: { fontSize: r.scaledFontSize.subhead, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 },
  assignOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8 },
  assignOptionText: { fontSize: r.scaledFontSize.body, color: colors.textPrimary, fontWeight: '500' },
  assignedIcon: { fontSize: scaleFont(16), marginRight: scaleSize(8) },
  assignDot: { width: 12, height: 12, borderRadius: 6, marginRight: scaleSize(10) },
  assignCancel: { alignItems: 'center', paddingTop: 12 },
  assignCancelText: { fontSize: r.scaledFontSize.subhead, color: colors.textTertiary },
});
