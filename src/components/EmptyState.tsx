// ============================================================
// iOS 风格空状态
// ============================================================
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../constants/theme';
import type { ColorScheme } from '../constants/theme';
import { useResponsive } from '../hooks/useResponsive';
import type { ResponsiveConstants } from '../hooks/useResponsive';
import { scaleSize, scaleFont } from '../utils/scaling';

interface Props {
  icon?: string;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon = '📦', title, subtitle }: Props) {
  const { colors } = useColors();
  const responsive = useResponsive();
  const styles = createStyles(colors, responsive);
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const createStyles = (colors: ColorScheme, r: ResponsiveConstants) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scaleSize(80),
    paddingHorizontal: r.scaledSpacing.xl,
  },
  icon: {
    fontSize: scaleFont(56),
    marginBottom: r.scaledSpacing.lg,
  },
  title: {
    fontSize: r.scaledFontSize.title3,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: r.scaledSpacing.sm,
  },
  subtitle: {
    fontSize: r.scaledFontSize.subhead,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: scaleFont(20),
  },
});
