// ============================================================
// 取件点分组视图 — 按取件点分组的可展开卡片列表
// v2: 长按分组2秒 → 进入拖拽模式 → ↑↓按钮移动 → 点「完成」
// ============================================================
import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, LayoutAnimation,
  Platform, UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { PackageCard } from './PackageCard';
import { navigateToAddress } from '../utils/navigation';
import {
  Shadow, useColors, getPickupPointIcon,
} from '../constants/theme';
import type { ColorScheme } from '../constants/theme';
import type { Package } from '../models';
import { useResponsive } from '../hooks/useResponsive';
import type { ResponsiveConstants } from '../hooks/useResponsive';
import { scaleSize, scaleFont } from '../utils/scaling';

interface PackageGroup {
  key: string;
  name: string;
  address: string;
  packages: Package[];
}

interface Props {
  packages: Package[];
  isEditing: boolean;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onEnterEditMode: () => void;
  onMarkPickedUp: (id: string) => void;
  onUndoPickup: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onShare?: (pkg: Package) => void;
  onBatchCodes?: (group: { name: string; address: string; packages: Package[] }) => void;
}

export function PackageGroupList({
  packages, isEditing, selectedIds,
  onToggleSelection, onEnterEditMode, onMarkPickedUp, onUndoPickup, onDelete,
  onTogglePin, onShare, onBatchCodes,
}: Props) {
  const { colors } = useColors();
  const responsive = useResponsive();
  const styles = createStyles(colors, responsive);

  const [customOrder, setCustomOrder] = useState<string[] | null>(null);
  const [reorderKey, setReorderKey] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, Package[]>();
    for (const pkg of packages) {
      // 同名驿站 + 不同地址 → 分开分组
      const name = pkg.pickupPointName || pkg.carrierName || '';
      const addr = pkg.pickupAddress || '';
      const key = (name && addr) ? `${name}|||${addr}` : (name || addr || '其他');
      const list = map.get(key);
      if (list) list.push(pkg);
      else map.set(key, [pkg]);
    }
    const result: PackageGroup[] = [];
    for (const [key, pkgs] of map) {
      const first = pkgs[0];
      const displayName = first.pickupPointName || first.carrierName || '其他';
      // 折叠头显示地址（同名站点有地址时追加地址）
      const displayAddr = first.pickupAddress || '';
      result.push({
        key,
        name: displayName,
        address: displayAddr,
        packages: pkgs,
      });
    }
    if (customOrder) {
      result.sort((a, b) => {
        const ai = customOrder.indexOf(a.key);
        const bi = customOrder.indexOf(b.key);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
    } else {
      result.sort((a, b) => {
        if (a.key === '其他') return 1;
        if (b.key === '其他') return -1;
        return b.packages.length - a.packages.length;
      });
    }
    return result;
  }, [packages, customOrder]);

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ===== 拖拽排序 =====
  const enterReorder = useCallback((key: string) => {
    if (!customOrder) setCustomOrder(groups.map(g => g.key));
    setReorderKey(key);
  }, [customOrder, groups]);

  const exitReorder = useCallback(() => setReorderKey(null), []);

  const moveUp = useCallback(() => {
    if (!reorderKey) return;
    const keys = customOrder || groups.map(g => g.key);
    const idx = keys.indexOf(reorderKey);
    if (idx <= 0) return;
    const newKeys = [...keys];
    [newKeys[idx - 1], newKeys[idx]] = [newKeys[idx], newKeys[idx - 1]];
    setCustomOrder(newKeys);
  }, [reorderKey, customOrder, groups]);

  const moveDown = useCallback(() => {
    if (!reorderKey) return;
    const keys = customOrder || groups.map(g => g.key);
    const idx = keys.indexOf(reorderKey);
    if (idx < 0 || idx >= keys.length - 1) return;
    const newKeys = [...keys];
    [newKeys[idx], newKeys[idx + 1]] = [newKeys[idx + 1], newKeys[idx]];
    setCustomOrder(newKeys);
  }, [reorderKey, customOrder, groups]);

  if (groups.length === 0) return null;

  return (
    <View style={styles.container}>
      {groups.map((group, idx) => {
        const expanded = expandedKeys.has(group.key);
        const isReordering = reorderKey === group.key;

        return (
          <View key={group.key} style={styles.groupSection}>
            {/* 分组头部 */}
            <Pressable
              style={({ pressed }) => [
                styles.groupHeader,
                isReordering && styles.groupHeaderReordering,
                pressed && !isReordering && styles.groupHeaderPressed,
              ]}
              onPress={() => toggleGroup(group.key)}
              onLongPress={() => enterReorder(group.key)}
              delayLongPress={2000}
            >
              <View style={styles.groupHeaderLeft}>
                <Text style={styles.groupIcon}>{getPickupPointIcon(group.name)}</Text>
                <View style={styles.groupInfo}>
                  <View style={styles.groupNameRow}>
                    <Text style={styles.groupName} numberOfLines={1}>
                      {group.name}
                    </Text>
                    <View style={styles.groupCountBadge}>
                      <Text style={styles.groupCountText}>{group.packages.length}</Text>
                    </View>
                  </View>
                  {group.address ? (
                    <Text style={styles.groupAddress} numberOfLines={1}>
                      {group.address}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.groupHeaderRight}>
                {isReordering ? (
                  <>
                    <Pressable style={styles.reorderBtn} onPress={moveUp}>
                      <Text style={styles.reorderBtnText}>↑</Text>
                    </Pressable>
                    <Pressable style={styles.reorderBtn} onPress={moveDown}>
                      <Text style={styles.reorderBtnText}>↓</Text>
                    </Pressable>
                    <Pressable style={styles.reorderDoneBtn} onPress={exitReorder}>
                      <Text style={styles.reorderDoneText}>完成</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    {onBatchCodes && group.packages.some(p => p.pickupCode) ? (
                      <Pressable
                        style={styles.iconBtn}
                        onPress={() => onBatchCodes({ name: group.name, address: group.address, packages: group.packages })}
                        hitSlop={8}
                      >
                        <Text style={styles.iconBtnLabel}>取件码</Text>
                        <Text style={styles.iconBtnIcon}>📋</Text>
                      </Pressable>
                    ) : null}
                    {group.address ? (
                      <Pressable
                        style={styles.iconBtn}
                        onPress={() => navigateToAddress(group.address, group.name)}
                        hitSlop={8}
                      >
                        <Text style={styles.iconBtnLabel}>导航</Text>
                        <Text style={styles.iconBtnIcon}>🧭</Text>
                      </Pressable>
                    ) : null}
                    <Text style={[styles.chevron, expanded && styles.chevronExpanded]}>▸</Text>
                  </>
                )}
              </View>
            </Pressable>

            {/* 折叠内容 */}
            {expanded && (
              <View style={styles.groupBody}>
                {group.packages.map((pkg, pidx) => (
                  <View key={pkg.id} style={styles.groupCardWrapper}>
                    {isEditing ? (
                      <PackageCard
                        pkg={pkg}
                        selected={selectedIds.has(pkg.id)}
                        onPress={() => onToggleSelection(pkg.id)}
                      />
                    ) : (
                      <PackageCard
                        pkg={pkg}
                        selected={selectedIds.has(pkg.id)}
                        onLongPress={onEnterEditMode}
                        onMarkPickedUp={() => onMarkPickedUp(pkg.id)}
                        onUndoPickup={() => onUndoPickup(pkg.id)}
                        onTogglePin={onTogglePin ? () => onTogglePin(pkg.id) : undefined}
                      />
                    )}
                    {pidx < group.packages.length - 1 && (
                      <View style={styles.packageDivider} />
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
      <View style={{ height: 100 }} />
    </View>
  );
}

const createStyles = (colors: ColorScheme, r: ResponsiveConstants) => StyleSheet.create({
  container: { flex: 1 },
  groupSection: { marginBottom: r.scaledSpacing.sm },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: r.scaledSpacing.lg,
    borderRadius: r.scaledBorderRadius.lg,
    paddingVertical: scaleSize(14),
    paddingHorizontal: r.scaledSpacing.lg,
    minHeight: 64,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.primary,
  },
  groupHeaderPressed: { opacity: 0.8 },
  groupHeaderReordering: {
    borderColor: '#FF9500',
    borderWidth: 2,
    backgroundColor: '#FFF8E1',
  },
  groupHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  groupIcon: { fontSize: scaleFont(22), marginRight: r.scaledSpacing.sm },
  groupInfo: { flex: 1 },
  groupNameRow: { flexDirection: 'row', alignItems: 'center' },
  groupName: { fontSize: r.scaledFontSize.subhead, fontWeight: '600', color: colors.textPrimary, flexShrink: 1 },
  groupCountBadge: { backgroundColor: '#FF9500', borderRadius: r.scaledBorderRadius.pill, paddingHorizontal: scaleSize(8), paddingVertical: scaleSize(1), marginLeft: scaleSize(8) },
  groupCountText: { fontSize: r.scaledFontSize.caption1, fontWeight: '700', color: '#FFFFFF' },
  groupAddress: { fontSize: r.scaledFontSize.footnote, color: colors.textSecondary, marginTop: scaleSize(3) },
  groupHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { alignItems: 'center', paddingHorizontal: scaleSize(6), paddingVertical: scaleSize(2) },
  iconBtnLabel: { fontSize: scaleFont(9), color: colors.textSecondary, marginBottom: scaleSize(1) },
  iconBtnIcon: { fontSize: scaleFont(15) },
  chevron: { fontSize: scaleFont(14), color: colors.textTertiary, marginLeft: scaleSize(4), transform: [{ rotate: '0deg' }] },
  chevronExpanded: { transform: [{ rotate: '90deg' }] },
  reorderBtn: { paddingHorizontal: scaleSize(10), paddingVertical: scaleSize(6), backgroundColor: '#FF9500', borderRadius: r.scaledBorderRadius.sm, marginLeft: scaleSize(4) },
  reorderBtnText: { fontSize: scaleFont(16), color: '#FFFFFF', fontWeight: '700' },
  reorderDoneBtn: { paddingHorizontal: scaleSize(12), paddingVertical: scaleSize(6), backgroundColor: colors.primary, borderRadius: r.scaledBorderRadius.md, marginLeft: scaleSize(6) },
  reorderDoneText: { fontSize: r.scaledFontSize.caption1, color: '#FFFFFF', fontWeight: '700' },
  groupBody: { backgroundColor: colors.secondarySurface, marginHorizontal: r.scaledSpacing.lg, borderBottomLeftRadius: r.scaledBorderRadius.lg, borderBottomRightRadius: r.scaledBorderRadius.lg, paddingTop: r.scaledSpacing.xs, paddingBottom: r.scaledSpacing.sm },
  groupCardWrapper: { marginHorizontal: -r.scaledSpacing.lg },
  packageDivider: { height: scaleSize(1), backgroundColor: colors.separator, marginHorizontal: r.scaledSpacing.lg },
});
