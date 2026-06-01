// ============================================================
// iOS 风格状态标签
// ============================================================
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PackageStatusColors, PackageStatusLabels } from '../constants/theme';
import { useResponsive } from '../hooks/useResponsive';
import type { ResponsiveConstants } from '../hooks/useResponsive';
import { scaleSize, scaleFont } from '../utils/scaling';

interface Props {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: Props) {
  const responsive = useResponsive();
  const color = PackageStatusColors[status] || '#8E8E93';
  const label = PackageStatusLabels[status] || status;
  const isSmall = size === 'sm';

  const styles = useMemo(() => createStyles(responsive), [responsive]);

  return (
    <View style={[styles.badge, { backgroundColor: color + '1A' }, isSmall && styles.badgeSm]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }, isSmall && styles.textSm]}>
        {label}
      </Text>
    </View>
  );
}

const createStyles = (r: ResponsiveConstants) => StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: r.scaledSpacing.sm,
    paddingVertical: scaleSize(3),
    borderRadius: r.scaledBorderRadius.pill,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: scaleSize(6),
    paddingVertical: scaleSize(2),
  },
  dot: {
    width: scaleSize(6),
    height: scaleSize(6),
    borderRadius: scaleSize(3),
    marginRight: scaleSize(4),
  },
  text: {
    fontSize: r.scaledFontSize.caption1,
    fontWeight: '600',
  },
  textSm: {
    fontSize: r.scaledFontSize.caption,
  },
});
