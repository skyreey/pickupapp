// ============================================================
// 响应式 Hook —— 返回缩放后的尺寸常量
// ============================================================
import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { scaleSize, scaleFont, scaleModerate } from '../utils/scaling';
import { Spacing, FontSize, BorderRadius } from '../constants/theme';

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

    return {
      scaledSpacing: {
        xs: scaleSize(Spacing.xs),
        sm: scaleSize(Spacing.sm),
        md: scaleSize(Spacing.md),
        lg: scaleSize(Spacing.lg),
        xl: scaleSize(Spacing.xl),
        xxl: scaleSize(Spacing.xxl),
      },
      scaledFontSize: {
        caption: scaleFont(FontSize.caption),
        caption1: scaleFont(FontSize.caption1),
        footnote: scaleFont(FontSize.footnote),
        subhead: scaleFont(FontSize.subhead),
        body: scaleFont(FontSize.body),
        headline: scaleFont(FontSize.headline),
        title3: scaleFont(FontSize.title3),
        title2: scaleFont(FontSize.title2),
        title1: scaleFont(FontSize.title1),
        pickupCode: scaleFont(FontSize.pickupCode),
        largeTitle: scaleFont(FontSize.largeTitle),
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
