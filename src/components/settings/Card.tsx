// ============================================================
// 设置卡片容器（彩色左边框）
// ============================================================
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Spacing, BorderRadius, Shadow } from '../../constants/theme';
import type { ColorScheme } from '../../constants/theme';

interface Props {
  color: string;
  colors: ColorScheme;
  children: React.ReactNode;
}

export function SettingsCard({ color, colors, children }: Props) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderLeftColor: color }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderLeftWidth: 3,
    ...Shadow.card,
  },
});
