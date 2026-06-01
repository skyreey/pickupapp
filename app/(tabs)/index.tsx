// ============================================================
// 首页 — 包裹列表
// ============================================================
import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, Text,
  Pressable, TextInput, AppState, ScrollView, Share, Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { usePackages, type FilterKey } from '../../src/hooks/usePackages';
import { PackageCard } from '../../src/components/PackageCard';
import { SwipeableCard } from '../../src/components/SwipeableCard';
import { PackageGroupList } from '../../src/components/PackageGroupList';
import { EmptyState } from '../../src/components/EmptyState';
import { markAsPickedUp, updatePackageStatus, deletePackage, type PackageSort } from '../../src/database/dao';
import type { Package } from '../../src/models';
import {
  Shadow, useColors, type ColorScheme,
} from '../../src/constants/theme';
import { useResponsive } from '../../src/hooks/useResponsive';
import type { ResponsiveConstants } from '../../src/hooks/useResponsive';
import { rescanInboxSms } from '../../src/services/sms-listener';
import { formatPackageForShare } from '../../src/utils/formatters';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'stored', label: '待取件' },
  { key: 'proxy', label: '代取' },
  { key: 'picked_up', label: '已取件' },
  { key: 'expired', label: '已过期' },
];

const SORT_OPTIONS: { key: PackageSort; label: string }[] = [
  { key: 'time-desc', label: '最新' },
  { key: 'time-asc', label: '最早' },
  { key: 'station', label: '按驿站' },
  { key: 'deadline', label: '按截止' },
];

const GAP = 6;
const FILTER_COUNT = 4;

export default function HomeScreen() {
  const { colors } = useColors();
  const responsive = useResponsive();
  const { scaledSpacing, scaledFontSize, scaledBorderRadius, screenWidth } = responsive;
  const styles = createStyles(colors, responsive);
  const PADDING_H = scaledSpacing.lg;
  const chipWidth = (screenWidth - PADDING_H * 2 - GAP * (FILTER_COUNT - 1)) / FILTER_COUNT;
  const {
    packages, filter, setFilter, sort, setSort, counts, pickupStats, loading, refresh, search,
    isEditing, selectedIds, toggleSelection, selectAll, clearSelection,
    enterEditMode, exitEditMode, batchMarkAsPickedUp, batchDelete, togglePin,
  } = usePackages();
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'group'>('group');
  const [showSortPicker, setShowSortPicker] = useState(false);
  const initialRefreshDone = useRef(false);

  // 包裹刷新 + SMS 扫描
  const refreshWithScan = useCallback(() => {
    refresh();
    rescanInboxSms().catch(() => {});
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (initialRefreshDone.current) return;
    initialRefreshDone.current = true;

    const t1 = setTimeout(() => refresh(), 3000);
    const t2 = setTimeout(() => refresh(), 8000);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setTimeout(() => {
          refresh();
          rescanInboxSms().catch(() => {});
        }, 1500);
      }
    });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      sub.remove();
    };
  }, [refresh]);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    search(text);
  }, [search]);

  // 获取当前排序标签
  const currentSortLabel = SORT_OPTIONS.find(o => o.key === sort)?.label || '最新';

  // 分享单个包裹
  const handleSharePackage = useCallback(async (pkg: Package) => {
    try {
      const { getSetting } = require('../../modules/expo-notification-reader');
      const phone = await getSetting('my_phone') || '';
      const prefix = phone ? `📦 取件通代取\n来自：${phone}\n` : '';
      await Share.share({ message: prefix + formatPackageForShare(pkg) });
    } catch {
      // 用户取消分享
    }
  }, []);

  // 批量分享
  const handleBatchShare = useCallback(async () => {
    const selected = packages.filter(p => selectedIds.has(p.id));
    if (selected.length === 0) return;
    const lines = selected.map((pkg, i) => {
      return [
        `【${i + 1}】取件码：${pkg.pickupCode || '暂无'}`,
        pkg.pickupPointName ? `📍 ${pkg.pickupPointName}` : '',
        pkg.pickupAddress ? `🏠 ${pkg.pickupAddress}` : '',
      ].filter(Boolean).join('\n');
    }).join('\n\n');
    try {
      await Share.share({ message: `📦 共${selected.length}个包裹待取\n\n${lines}` });
    } catch {
      // 用户取消分享
    }
  }, [packages, selectedIds]);

  return (
    <View style={styles.container}>
      {/* 顶部操作栏 */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>
          {isEditing ? `已选 ${selectedIds.size} 个` : `共 ${counts.all || 0} 个包裹`}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {isEditing ? (
            <>
              <Pressable onPress={selectedIds.size === packages.length ? clearSelection : selectAll}>
                <Text style={styles.topBarAction}>
                  {selectedIds.size === packages.length ? '取消全选' : '全选'}
                </Text>
              </Pressable>
              <Pressable onPress={handleBatchShare}>
                <Text style={styles.topBarAction}>分享</Text>
              </Pressable>
              <Pressable onPress={exitEditMode}>
                <Text style={styles.topBarAction}>完成</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable onPress={() => setShowSortPicker(!showSortPicker)}>
                <Text style={styles.topBarAction}>⇅ {currentSortLabel}</Text>
              </Pressable>
              <Pressable
                onPress={() => setViewMode(viewMode === 'list' ? 'group' : 'list')}
              >
                <Text style={styles.topBarAction}>
                  {viewMode === 'list' ? '分组' : '列表'}
                </Text>
              </Pressable>
              <Pressable onPress={enterEditMode}>
                <Text style={styles.topBarAction}>编辑</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* 排序下拉 */}
      {showSortPicker && !isEditing ? (
        <View style={styles.sortPicker}>
          {SORT_OPTIONS.map(opt => (
            <Pressable
              key={opt.key}
              style={[styles.sortOption, sort === opt.key && styles.sortOptionActive]}
              onPress={() => { setSort(opt.key); setShowSortPicker(false); }}
            >
              <Text style={[styles.sortOptionText, sort === opt.key && styles.sortOptionTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* 筛选标签 */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => {
          const active = filter === f.key;
          const count = counts[f.key] || 0;
          return (
            <Pressable
              key={f.key}
              style={[styles.filterChip, { width: chipWidth }, active && (f.key === 'expired' ? styles.filterChipExpired : styles.filterChipActive)]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {f.label}
              </Text>
              {count > 0 ? (
                <View style={[styles.countBadge, active && styles.countBadgeActive]}>
                  <Text style={[styles.countText, active && styles.countTextActive]}>
                    {count}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* 搜索框 */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="搜索商品/单号/取件码..."
          placeholderTextColor={colors.textPlaceholder}
          value={query}
          onChangeText={handleSearch}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => { setQuery(''); search(''); }} hitSlop={8}>
            <Text style={styles.searchClear}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {/* 列表 / 分组切换 */}
      {viewMode === 'list' ? (
        <FlatList
          data={packages}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            isEditing ? (
              <PackageCard
                pkg={item}
                selected={selectedIds.has(item.id)}
                onPress={() => toggleSelection(item.id)}
              />
            ) : (
              <SwipeableCard
                pkg={item}
                selected={selectedIds.has(item.id)}
                onLongPress={enterEditMode}
                onMarkPickedUp={() => {
                  markAsPickedUp(item.id);
                  refresh();
                }}
                onUndoPickup={() => {
                  updatePackageStatus(item.id, 'stored');
                  refresh();
                }}
                onDelete={() => {
                  deletePackage(item.id);
                  refresh();
                }}
                onTogglePin={() => togglePin(item.id)}
                onShare={() => handleSharePackage(item)}
              />
            )
          )}
          contentContainerStyle={packages.length === 0 ? styles.emptyContainer : styles.listContent}
          ListHeaderComponent={
            <>
              {filter === 'picked_up' ? (
                <View style={styles.pickupStatsBanner}>
                  <Text style={styles.pickupStatsTitle}>取件统计</Text>
                  <View style={styles.pickupStatsRow}>
                    <View style={styles.pickupStatItem}>
                      <Text style={styles.pickupStatNumber}>{pickupStats.totalPickedUp}</Text>
                      <Text style={styles.pickupStatLabel}>累计取件</Text>
                    </View>
                    <View style={styles.pickupStatItem}>
                      <Text style={styles.pickupStatNumber}>{pickupStats.pickedUpThisMonth}</Text>
                      <Text style={styles.pickupStatLabel}>本月取件</Text>
                    </View>
                    <View style={styles.pickupStatItem}>
                      <Text style={styles.pickupStatNumber}>{pickupStats.pickedUpLastMonth}</Text>
                      <Text style={styles.pickupStatLabel}>上月取件</Text>
                    </View>
                  </View>
                </View>
              ) : null}
            </>
          }
          ListEmptyComponent={
            <EmptyState
              icon="📭"
              title={filter === 'expired' ? '暂无过期包裹' : '暂无包裹'}
              subtitle={filter === 'expired' ? '所有待取件包裹都在有效期内' : '收到快递短信或发货通知后\n取件码会自动出现在这里'}
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refreshWithScan}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
        />
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={packages.length === 0 ? styles.emptyContainer : undefined}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={refreshWithScan}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          >
            {filter === 'picked_up' ? (
              <View style={styles.pickupStatsBanner}>
                <Text style={styles.pickupStatsTitle}>取件统计</Text>
                <View style={styles.pickupStatsRow}>
                  <View style={styles.pickupStatItem}>
                    <Text style={styles.pickupStatNumber}>{pickupStats.totalPickedUp}</Text>
                    <Text style={styles.pickupStatLabel}>累计取件</Text>
                  </View>
                  <View style={styles.pickupStatItem}>
                    <Text style={styles.pickupStatNumber}>{pickupStats.pickedUpThisMonth}</Text>
                    <Text style={styles.pickupStatLabel}>本月取件</Text>
                  </View>
                  <View style={styles.pickupStatItem}>
                    <Text style={styles.pickupStatNumber}>{pickupStats.pickedUpLastMonth}</Text>
                    <Text style={styles.pickupStatLabel}>上月取件</Text>
                  </View>
                </View>
              </View>
            ) : null}
            {packages.length === 0 ? (
              <EmptyState
                icon="📭"
                title={filter === 'expired' ? '暂无过期包裹' : '暂无包裹'}
                subtitle={filter === 'expired' ? '所有待取件包裹都在有效期内' : '收到快递短信或发货通知后\n取件码会自动出现在这里'}
              />
            ) : (
              <PackageGroupList
                packages={packages}
                isEditing={isEditing}
                selectedIds={selectedIds}
                onToggleSelection={toggleSelection}
                onEnterEditMode={enterEditMode}
                onMarkPickedUp={(id) => {
                  markAsPickedUp(id);
                  refresh();
                }}
                onUndoPickup={(id) => {
                  updatePackageStatus(id, 'stored');
                  refresh();
                }}
                onDelete={(id) => {
                  deletePackage(id);
                  refresh();
                }}
                onTogglePin={(id) => togglePin(id)}
                onShare={(pkg) => handleSharePackage(pkg)}
              />
            )}
          </ScrollView>
        </View>
      )}

      {/* 批量操作工具栏 */}
      {isEditing && (
        <View style={styles.batchBar}>
          <Pressable style={styles.batchBtn} onPress={batchMarkAsPickedUp}>
            <Text style={styles.batchBtnText}>📦 标记已取件</Text>
          </Pressable>
          <View style={styles.batchDivider} />
          <Pressable style={styles.batchBtn} onPress={handleBatchShare}>
            <Text style={styles.batchBtnText}>↗ 分享</Text>
          </Pressable>
          <View style={styles.batchDivider} />
          <Pressable style={styles.batchBtn} onPress={batchDelete}>
            <Text style={[styles.batchBtnText, { color: colors.error }]}>🗑️ 删除</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ColorScheme, r: ResponsiveConstants) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: r.scaledSpacing.lg,
    paddingTop: r.scaledSpacing.sm,
    paddingBottom: r.scaledSpacing.xs,
  },
  topBarTitle: {
    fontSize: r.scaledFontSize.subhead,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  topBarAction: {
    fontSize: r.scaledFontSize.subhead,
    color: colors.primary,
    fontWeight: '500',
  },
  // 排序下拉
  sortPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: r.scaledSpacing.lg,
    paddingBottom: r.scaledSpacing.sm,
    gap: 6,
  },
  sortOption: {
    paddingHorizontal: r.scaledSpacing.md,
    paddingVertical: r.scaledSpacing.xs,
    borderRadius: r.scaledBorderRadius.pill,
    backgroundColor: colors.surface,
  },
  sortOptionActive: {
    backgroundColor: colors.primary,
  },
  sortOptionText: {
    fontSize: r.scaledFontSize.caption1,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  sortOptionTextActive: {
    color: '#FFFFFF',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: r.scaledSpacing.lg,
    marginBottom: r.scaledSpacing.sm,
    backgroundColor: colors.secondarySurface,
    borderRadius: r.scaledBorderRadius.md,
    paddingHorizontal: r.scaledSpacing.md,
  },
  searchIcon: {
    fontSize: r.scaledFontSize.footnote,
    marginRight: r.scaledSpacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: r.scaledSpacing.sm,
    fontSize: r.scaledFontSize.subhead,
    color: colors.textPrimary,
  },
  searchClear: {
    fontSize: r.scaledFontSize.footnote,
    color: colors.textTertiary,
    paddingHorizontal: r.scaledSpacing.xs,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: r.scaledSpacing.lg,
    paddingTop: r.scaledSpacing.sm,
    paddingBottom: r.scaledSpacing.sm,
    gap: r.scaledSpacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: r.scaledSpacing.sm - 1,
    borderRadius: r.scaledBorderRadius.pill,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipExpired: {
    backgroundColor: '#FF9500',
  },
  filterChipText: {
    fontSize: r.scaledFontSize.subhead,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  countBadge: {
    marginLeft: r.scaledSpacing.xs,
    backgroundColor: colors.secondarySurface,
    borderRadius: r.scaledBorderRadius.pill,
    paddingHorizontal: r.scaledSpacing.xs,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  countText: {
    fontSize: r.scaledFontSize.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  countTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 100,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  pickupStatsBanner: {
    backgroundColor: colors.surface,
    marginHorizontal: r.scaledSpacing.lg,
    marginBottom: r.scaledSpacing.sm,
    borderRadius: r.scaledBorderRadius.xl,
    padding: r.scaledSpacing.lg,
    ...Shadow.card,
  },
  pickupStatsTitle: {
    fontSize: r.scaledFontSize.subhead,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: r.scaledSpacing.md,
  },
  pickupStatsRow: {
    flexDirection: 'row',
    gap: r.scaledSpacing.sm,
  },
  pickupStatItem: {
    flex: 1,
    backgroundColor: colors.secondarySurface,
    borderRadius: r.scaledBorderRadius.lg,
    paddingVertical: r.scaledSpacing.md,
    paddingHorizontal: r.scaledSpacing.sm,
    alignItems: 'center',
  },
  pickupStatNumber: {
    fontSize: r.scaledFontSize.title1,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pickupStatLabel: {
    fontSize: r.scaledFontSize.caption1,
    color: colors.textSecondary,
    marginTop: 2,
  },
  batchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopWidth: 0.5,
    borderTopColor: colors.separator,
    paddingBottom: r.scaledSpacing.sm,
    paddingTop: r.scaledSpacing.sm,
    ...Shadow.card,
  },
  batchBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: r.scaledSpacing.sm,
  },
  batchBtnText: {
    fontSize: r.scaledFontSize.subhead,
    color: colors.primary,
    fontWeight: '600',
  },
  batchDivider: {
    width: 0.5,
    height: 24,
    backgroundColor: colors.separator,
  },
});
