// ============================================================
// 取件点分组视图 — 按取件点分组的可展开卡片列表
// ============================================================
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';

// Android 需要手动启用 LayoutAnimation
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { PackageCard } from './PackageCard';
import { SwipeableCard } from './SwipeableCard';
import { navigateToAddress } from '../utils/navigation';
import {
  Shadow, useColors, getPickupPointColor, getPickupPointIcon,
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
}

export function PackageGroupList({
  packages, isEditing, selectedIds,
  onToggleSelection, onEnterEditMode, onMarkPickedUp, onUndoPickup, onDelete,
  onTogglePin, onShare,
}: Props) {
  const { colors } = useColors();
  const responsive = useResponsive();
  const styles = createStyles(colors, responsive);

  const groups = useMemo(() => {
    const map = new Map<string, Package[]>();
    for (const pkg of packages) {
      const key = pkg.pickupPointName || pkg.pickupAddress || '其他';
      const list = map.get(key);
      if (list) list.push(pkg);
      else map.set(key, [pkg]);
    }
    const result: PackageGroup[] = [];
    for (const [key, pkgs] of map) {
      result.push({
        key,
        name: pkgs[0].pickupPointName || key,
        address: pkgs[0].pickupAddress || '',
        packages: pkgs,
      });
    }
    result.sort((a, b) => b.packages.length - a.packages.length);
    return result;
  }, [packages]);

  // 默认展开第一个（包裹最多的）分组
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

  if (groups.length === 0) return null;

  return (
    <View style={styles.container}>
      {groups.map(group => {
        const expanded = expandedKeys.has(group.key);
        return (
          <View key={group.key} style={styles.groupSection}>
            {/* 分组头部 */}
            <Pressable
              style={({ pressed }) => [
                styles.groupHeader,
                pressed && styles.groupHeaderPressed,
              ]}
              onPress={() => toggleGroup(group.key)}
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
                {group.address ? (
                  <Pressable
                    style={styles.navMiniBtn}
                    onPress={() => navigateToAddress(group.address, group.name)}
                    hitSlop={8}
                  >
                    <Text style={styles.navMiniText}>🧭</Text>
                  </Pressable>
                ) : null}
                <Text style={[styles.chevron, expanded && styles.chevronExpanded]}>
                  ▸
                </Text>
              </View>
            </Pressable>

            {/* 分组内容（可折叠） */}
            {expanded && (
              <View style={styles.groupBody}>
                {group.packages.map((pkg, idx) => (
                  <View key={pkg.id} style={styles.groupCardWrapper}>
                    {isEditing ? (
                      <PackageCard
                        pkg={pkg}
                        selected={selectedIds.has(pkg.id)}
                        onPress={() => onToggleSelection(pkg.id)}
                      />
                    ) : (
                      <SwipeableCard
                        pkg={pkg}
                        selected={selectedIds.has(pkg.id)}
                        onLongPress={onEnterEditMode}
                        onMarkPickedUp={() => onMarkPickedUp(pkg.id)}
                        onUndoPickup={() => onUndoPickup(pkg.id)}
                        onDelete={() => onDelete(pkg.id)}
                        onTogglePin={onTogglePin ? () => onTogglePin(pkg.id) : undefined}
                        onShare={onShare ? () => onShare(pkg) : undefined}
                      />
                    )}
                    {idx < group.packages.length - 1 && (
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
  container: {
    flex: 1,
  },
  groupSection: {
    marginBottom: r.scaledSpacing.sm,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: r.scaledSpacing.lg,
    borderRadius: r.scaledBorderRadius.lg,
    paddingVertical: scaleSize(14),
    paddingHorizontal: r.scaledSpacing.lg,
    minHeight: scaleSize(64),
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.primary,
  },
  groupHeaderPressed: {
    opacity: 0.8,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupIcon: {
    fontSize: scaleFont(22),
    marginRight: r.scaledSpacing.sm,
  },
  groupInfo: {
    flex: 1,
  },
  groupNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupName: {
    fontSize: r.scaledFontSize.subhead,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  groupCountBadge: {
    backgroundColor: '#FF9500',
    borderRadius: r.scaledBorderRadius.pill,
    paddingHorizontal: scaleSize(8),
    paddingVertical: scaleSize(1),
    marginLeft: scaleSize(8),
  },
  groupCountText: {
    fontSize: r.scaledFontSize.caption1,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  groupAddress: {
    fontSize: r.scaledFontSize.footnote,
    color: colors.textSecondary,
    marginTop: scaleSize(3),
  },
  groupHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navMiniBtn: {
    paddingHorizontal: scaleSize(6),
    paddingVertical: scaleSize(4),
  },
  navMiniText: {
    fontSize: scaleFont(16),
  },
  chevron: {
    fontSize: scaleFont(14),
    color: colors.textTertiary,
    marginLeft: scaleSize(4),
    transform: [{ rotate: '0deg' }],
  },
  chevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  groupBody: {
    backgroundColor: colors.secondarySurface,
    marginHorizontal: r.scaledSpacing.lg,
    borderBottomLeftRadius: r.scaledBorderRadius.lg,
    borderBottomRightRadius: r.scaledBorderRadius.lg,
    paddingTop: r.scaledSpacing.xs,
    paddingBottom: r.scaledSpacing.sm,
  },
  groupCardWrapper: {
    marginHorizontal: -r.scaledSpacing.lg,
  },
  packageDivider: {
    height: scaleSize(1),
    backgroundColor: colors.separator,
    marginHorizontal: r.scaledSpacing.lg,
  },
});
