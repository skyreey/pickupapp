// ============================================================
// 响应式 Hook —— 返回缩放后的尺寸常量
// ============================================================
import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { scaleSize, scaleFont, scaleModerate } from '../utils/scaling';
import { Spacing, FontSize, BorderRadius } from '../constants/theme';
import { getLargeFontMode } from '../services/settings-store';

export interface ResponsiveConstants {
  scaledSpacing: typeof Spacing;
  scaledFontSize: typeof FontSize;
  scaledBorderRadius: typeof BorderRadius;
  screenWidth: number;
  screenHeight: number;
  isSmallScreen: boolean;
  isLargeScreen: boolean;
}

/**
 * 返回按当前屏幕宽度缩放后的尺寸常量
 */
export function useResponsive(): ResponsiveConstants {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const w = Math.min(width, height); // 取短边（竖屏宽度）
    const largeMult = getLargeFontMode() ? 1.3 : 1.0;

    return {
      scaledSpacing: {
        xs: scaleSize(Spacing.xs * largeMult),
        sm: scaleSize(Spacing.sm * largeMult),
        md: scaleSize(Spacing.md * largeMult),
        lg: scaleSize(Spacing.lg * largeMult),
        xl: scaleSize(Spacing.xl * largeMult),
        xxl: scaleSize(Spacing.xxl * largeMult),
      },
      scaledFontSize: {
        caption: scaleFont(FontSize.caption * largeMult),
        caption1: scaleFont(FontSize.caption1 * largeMult),
        footnote: scaleFont(FontSize.footnote * largeMult),
        subhead: scaleFont(FontSize.subhead * largeMult),
        body: scaleFont(FontSize.body * largeMult),
        headline: scaleFont(FontSize.headline * largeMult),
        title3: scaleFont(FontSize.title3 * largeMult),
        title2: scaleFont(FontSize.title2 * largeMult),
        title1: scaleFont(FontSize.title1 * largeMult),
        pickupCode: scaleFont(FontSize.pickupCode * largeMult),
        largeTitle: scaleFont(FontSize.largeTitle * largeMult),
      },
      scaledBorderRadius: {
        sm: scaleSize(BorderRadius.sm),
        md: scaleSize(BorderRadius.md),
        lg: scaleSize(BorderRadius.lg),
        xl: scaleSize(BorderRadius.xl),
        pill: scaleSize(BorderRadius.pill),
      },
      screenWidth: width,
      screenHeight: height,
      isSmallScreen: w < 360,
      isLargeScreen: w >= 428,
    };
  }, [width, height]);
}
