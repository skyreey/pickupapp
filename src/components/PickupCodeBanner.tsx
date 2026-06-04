// ============================================================
// iOS 风格取件码大号横幅
// ============================================================
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Shadow, useColors } from '../constants/theme';
import type { ColorScheme } from '../constants/theme';
import { useResponsive } from '../hooks/useResponsive';
import type { ResponsiveConstants } from '../hooks/useResponsive';
import { scaleSize, scaleFont } from '../utils/scaling';

interface Props {
  code: string;
  companyName?: string;
}

export function PickupCodeBanner({ code, companyName }: Props) {
  const { colors } = useColors();
  const responsive = useResponsive();
  const styles = createStyles(colors, responsive);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(code);
    Alert.alert('已复制', `取件码 ${code} 已复制到剪贴板`);
  }, [code]);

  // 分割取件码为可视块（如 8-3-5021 → 8 / 3 / 5021）
  const parts = code.split(/[-—\s]/);

  return (
    <Pressable
      onPress={handleCopy}
      style={styles.container}
      accessibilityLabel={`取件码 ${code}，${companyName ? companyName + '，' : ''}双击复制到剪贴板`}
      accessibilityRole="button"
      accessibilityHint="双击复制取件码"
    >
      <View style={styles.banner}>
        <Text style={styles.headerText}>取件码</Text>
        {companyName ? (
          <Text style={styles.companyText}>{companyName}</Text>
        ) : null}
        <View style={styles.codeRow}>
          {parts.map((part, i) => (
            <React.Fragment key={i}>
              {i > 0 && <Text style={styles.separator}>—</Text>}
              <Text style={styles.codePart}>{part}</Text>
            </React.Fragment>
          ))}
        </View>
        <Text style={styles.hint}>轻触复制取件码</Text>
      </View>
    </Pressable>
  );
}

const createStyles = (colors: ColorScheme, r: ResponsiveConstants) => StyleSheet.create({
  container: {
    marginHorizontal: r.scaledSpacing.lg,
    marginVertical: r.scaledSpacing.md,
  },
  banner: {
    backgroundColor: colors.primary,
    borderRadius: r.scaledBorderRadius.xl,
    padding: r.scaledSpacing.xxl,
    alignItems: 'center',
    ...Shadow.medium,
  },
  headerText: {
    fontSize: r.scaledFontSize.footnote,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: scaleSize(2),
    marginBottom: r.scaledSpacing.xs,
  },
  companyText: {
    fontSize: r.scaledFontSize.subhead,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: r.scaledSpacing.lg,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: r.scaledSpacing.lg,
  },
  codePart: {
    fontSize: r.scaledFontSize.pickupCode,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'monospace',
    letterSpacing: scaleSize(2),
    paddingHorizontal: scaleSize(4),
  },
  separator: {
    fontSize: r.scaledFontSize.title1,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.6)',
    marginHorizontal: r.scaledSpacing.xs,
  },
  hint: {
    fontSize: r.scaledFontSize.caption,
    color: 'rgba(255,255,255,0.5)',
  },
});
