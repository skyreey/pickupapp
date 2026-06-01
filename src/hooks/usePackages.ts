// ============================================================
// 包裹列表 Hook
// ============================================================
import { useState, useCallback, useEffect } from 'react';
import {
  getAllPackages,
  getPackageById,
  searchPackages,
  getStatusCounts,
  getPickupStats,
  markAsPickedUp,
  deletePackage,
  batchMarkAsPickedUp,
  batchDeletePackages,
  togglePin,
  type PackageSort,
} from '../database/dao';
import { initDatabase } from '../database';
import { refreshWidget } from '../services/widget-refresh';
import { refreshPendingCount } from '../services/foreground-service';
import type { Package, PackageStatus } from '../models';

export type FilterKey = PackageStatus | 'all' | 'active' | 'expired' | 'proxy';

export function usePackages() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [filter, setFilter] = useState<FilterKey>('stored');
  const [sort, setSort] = useState<PackageSort>('time-desc');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [pickupStats, setPickupStats] = useState({ totalPickedUp: 0, pickedUpThisMonth: 0, pickedUpLastMonth: 0 });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 初始化数据库
  useEffect(() => {
    initDatabase();
  }, []);

  // 加载数据
  useEffect(() => {
    loadData();
  }, [filter, sort]);

  // Sync foreground notification count whenever data changes
  useEffect(() => {
    refreshPendingCount();
  }, [packages]);

  const loadData = useCallback(() => {
    try {
      const data = getAllPackages(filter === 'expired' ? 'expired' : (filter as PackageStatus | 'all' | 'active'), sort);
      setPackages(data);
      setCounts(getStatusCounts());
      setPickupStats(getPickupStats());
    } catch (e) {
      console.error('加载数据失败:', e);
    } finally {
      setLoading(false);
    }
  }, [filter, sort]);

  const refresh = useCallback(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const search = useCallback((query: string) => {
    if (!query.trim()) {
      loadData();
      return;
    }
    const results = searchPackages(query);
    setPackages(results);
  }, [loadData]);

  const handleMarkPickedUp = useCallback((id: string) => {
    markAsPickedUp(id);
    refreshWidget();
    loadData();
  }, [loadData]);

  const handleDelete = useCallback((id: string) => {
    deletePackage(id);
    refreshWidget();
    loadData();
  }, [loadData]);

  const handleTogglePin = useCallback((id: string) => {
    togglePin(id);
    loadData();
  }, [loadData]);

  // 批量操作
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(packages.map(p => p.id)));
  }, [packages]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const enterEditMode = useCallback(() => {
    setIsEditing(true);
    setSelectedIds(new Set());
  }, []);

  const exitEditMode = useCallback(() => {
    setIsEditing(false);
    setSelectedIds(new Set());
  }, []);

  const handleBatchMarkPickedUp = useCallback(() => {
    if (selectedIds.size === 0) return;
    batchMarkAsPickedUp([...selectedIds]);
    setSelectedIds(new Set());
    refreshWidget();
    loadData();
  }, [selectedIds, loadData]);

  const handleBatchDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    batchDeletePackages([...selectedIds]);
    setSelectedIds(new Set());
    refreshWidget();
    loadData();
  }, [selectedIds, loadData]);

  return {
    packages,
    filter,
    setFilter,
    sort,
    setSort,
    counts,
    pickupStats,
    loading,
    refresh,
    search,
    markAsPickedUp: handleMarkPickedUp,
    deletePackage: handleDelete,
    togglePin: handleTogglePin,
    isEditing,
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    enterEditMode,
    exitEditMode,
    batchMarkAsPickedUp: handleBatchMarkPickedUp,
    batchDelete: handleBatchDelete,
  };
}

export function usePackageDetail(id: string) {
  const [pkg, setPkg] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initDatabase();
  }, []);

  useEffect(() => {
    const data = getPackageById(id);
    setPkg(data);
    setLoading(false);
  }, [id]);

  const refresh = useCallback(() => {
    const data = getPackageById(id);
    setPkg(data);
  }, [id]);

  const handleMarkPickedUp = useCallback(() => {
    const now = Date.now();
    markAsPickedUp(id);
    setPkg(prev => prev ? { ...prev, currentStatus: 'picked_up', statusUpdatedAt: now, pickedUpAt: now } : null);
    refreshPendingCount();
  }, [id]);

  const handleDelete = useCallback(() => {
    if (pkg) {
      deletePackage(pkg.id);
      setPkg(null);
    }
  }, [pkg]);

  return { pkg, loading, refresh, markAsPickedUp: handleMarkPickedUp, deletePackage: handleDelete };
}
