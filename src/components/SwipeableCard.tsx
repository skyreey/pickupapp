// ============================================================
// 可滑动包裹卡片 — 左滑露出操作按钮
// ============================================================
import React, { useRef, useCallback } from 'react';
import {
  View, Text, Animated, PanResponder, StyleSheet, Pressable,
  TouchableNativeFeedback,
} from 'react-native';
import { PackageCard } from './PackageCard';
import { useColors } from '../constants/theme';
import type { ColorScheme } from '../constants/theme';
import { useResponsive } from '../hooks/useResponsive';
import type { ResponsiveConstants } from '../hooks/useResponsive';
import { scaleSize, scaleFont } from '../utils/scaling';
import type { Package } from '../models';

const ACTION_WIDTH = 72;
const SNAP_THRESHOLD = ACTION_WIDTH * 0.5;

interface Props {
  pkg: Package;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onMarkPickedUp?: () => void;
  onUndoPickup?: () => void;
  onDelete?: () => void;
  onTogglePin?: () => void;
  onShare?: () => void;
}

export function SwipeableCard({
  pkg, selected, onPress, onLongPress, onMarkPickedUp, onUndoPickup, onDelete, onTogglePin, onShare,
}: Props) {
  const { colors } = useColors();
  const responsive = useResponsive();
  const styles = createStyles(colors, responsive);
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const actionCount = 4; // 置顶 + 取件/撤销 + 分享 + 删除
  const maxSwipe = ACTION_WIDTH * actionCount;

  const snapTo = useCallback((toValue: number) => {
    isOpen.current = toValue !== 0;
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
  }, [translateX]);

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) =>
      Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
    onPanResponderMove: (_, gs) => {
      const currentOffset = isOpen.current ? -maxSwipe : 0;
      const newX = Math.min(0, Math.max(-maxSwipe, currentOffset + gs.dx));
      translateX.setValue(newX);
    },
    onPanResponderRelease: (_, gs) => {
      const currentOffset = isOpen.current ? -maxSwipe : 0;
      const totalDx = currentOffset + gs.dx;
      if (totalDx < -SNAP_THRESHOLD) {
        snapTo(-maxSwipe);
      } else {
        snapTo(0);
      }
    },
  })).current;

  const closeAndCall = useCallback((fn?: () => void) => {
    snapTo(0);
    setTimeout(() => fn?.(), 200);
  }, [snapTo]);

  return (
    <View style={styles.container}>
      {/* 背后操作按钮 */}
      <View style={styles.actionsRow}>
        {/* 置顶 */}
        <TouchableNativeFeedback
          onPress={() => closeAndCall(onTogglePin)}
          background={TouchableNativeFeedback.Ripple('#ffffff44', false)}
        >
          <View style={[styles.actionBtn, styles.pinBtn]}>
            <Text style={styles.actionText}>{pkg.pinned ? '📦 取消' : '📦 置顶'}</Text>
          </View>
        </TouchableNativeFeedback>
        {/* 分享 */}
        {onShare ? (
          <TouchableNativeFeedback onPress={() => closeAndCall(onShare)} background={TouchableNativeFeedback.Ripple('#ffffff44', false)}>
            <View style={[styles.actionBtn, styles.shareBtn]}><Text style={styles.actionText}>↗ 分享</Text></View>
          </TouchableNativeFeedback>
        ) : null}
        {/* 取件 / 撤销 */}
        {pkg.currentStatus !== 'picked_up' ? (
          <TouchableNativeFeedback
            onPress={() => closeAndCall(onMarkPickedUp)}
            background={TouchableNativeFeedback.Ripple('#ffffff44', false)}
          >
            <View style={[styles.actionBtn, styles.pickupBtn]}>
              <Text style={styles.actionText}>✓ 取件</Text>
            </View>
          </TouchableNativeFeedback>
        ) : (
          <TouchableNativeFeedback
            onPress={() => closeAndCall(onUndoPickup)}
            background={TouchableNativeFeedback.Ripple('#ffffff44', false)}
          >
            <View style={[styles.actionBtn, styles.undoBtn]}>
              <Text style={styles.actionText}>↩ 撤销</Text>
            </View>
          </TouchableNativeFeedback>
        )}
        {/* 删除 */}
        <TouchableNativeFeedback
          onPress={() => closeAndCall(onDelete)}
          background={TouchableNativeFeedback.Ripple('#ffffff44', false)}
        >
          <View style={[styles.actionBtn, styles.deleteBtn]}>
            <Text style={styles.actionText}>🗑 删除</Text>
          </View>
        </TouchableNativeFeedback>
      </View>

      {/* 前景卡片 */}
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        <PackageCard
          pkg={pkg}
          selected={selected}
          onPress={onPress}
          onLongPress={onLongPress}
          onMarkPickedUp={onMarkPickedUp}
          onUndoPickup={onUndoPickup}
          onTogglePin={onTogglePin}
          onShare={onShare}
        />
      </Animated.View>
    </View>
  );
}

const createStyles = (colors: ColorScheme, r: ResponsiveConstants) => StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  actionsRow: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    paddingHorizontal: r.scaledSpacing.lg,
    paddingVertical: r.scaledSpacing.sm,
    gap: 0,
  },
  actionBtn: {
    width: scaleSize(ACTION_WIDTH),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: r.scaledBorderRadius.lg,
    marginLeft: scaleSize(4),
  },
  pinBtn: {
    backgroundColor: '#FF9500',
  },
  pickupBtn: {
    backgroundColor: colors.success,
  },
  undoBtn: {
    backgroundColor: colors.primary,
  },
  shareBtn: {
    backgroundColor: colors.primary,
  },
  deleteBtn: {
    backgroundColor: colors.error,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: r.scaledFontSize.caption1,
    fontWeight: '700',
  },
});
