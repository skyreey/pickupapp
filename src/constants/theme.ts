// ============================================================
// iOS 风格主题常量
// ============================================================
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import { getSetting, setSetting } from '../../modules/expo-notification-reader';

// ========== 浅色模式 ==========
export const lightColors = {
  primary: '#007AFF',
  primaryLight: '#409CFF',
  primaryDark: '#0055CC',

  accent: '#FF9500',
  error: '#FF3B30',
  success: '#34C759',
  warning: '#FF9500',

  background: '#F2F2F7',
  surface: '#FFFFFF',
  secondarySurface: '#F9F9F9',

  textPrimary: '#000000',
  textSecondary: '#8E8E93',
  textTertiary: '#C7C7CC',
  textPlaceholder: '#C7C7CC',

  separator: '#E5E5EA',
  hairline: '#D1D1D6',

  navBar: '#FFFFFF',
  tabBar: '#FFFFFF',
  statusBar: '#007AFF',

  statusGrantedBg: '#E8F5E9',
  statusDeniedBg: '#FFEBEE',
};

// ========== 深色模式 ==========
export const darkColors: typeof lightColors = {
  primary: '#0A84FF',
  primaryLight: '#5AB5FF',
  primaryDark: '#0066CC',

  accent: '#FF9F0A',
  error: '#FF453A',
  success: '#30D158',
  warning: '#FF9F0A',

  background: '#000000',
  surface: '#1C1C1E',
  secondarySurface: '#2C2C2E',

  textPrimary: '#FFFFFF',
  textSecondary: '#98989D',
  textTertiary: '#636366',
  textPlaceholder: '#636366',

  separator: '#38383A',
  hairline: '#48484A',

  navBar: '#1C1C1E',
  tabBar: '#1C1C1E',
  statusBar: '#0A84FF',

  statusGrantedBg: '#1A332A',
  statusDeniedBg: '#3A1F1F',
};

export type ColorScheme = typeof lightColors;

/** 向后兼容 */
export const Colors = lightColors;

// ========== 主题自定义 ==========

export type ThemeMode = 'system' | 'light' | 'dark';
export type ThemeAccent = 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'pink';

interface AccentColors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  statusBar: string;
}

const accentPalettes: Record<ThemeAccent, { light: AccentColors; dark: AccentColors }> = {
  blue: {
    light: { primary: '#007AFF', primaryLight: '#409CFF', primaryDark: '#0055CC', statusBar: '#007AFF' },
    dark: { primary: '#0A84FF', primaryLight: '#5AB5FF', primaryDark: '#0066CC', statusBar: '#0A84FF' },
  },
  green: {
    light: { primary: '#34C759', primaryLight: '#60D87A', primaryDark: '#28A745', statusBar: '#34C759' },
    dark: { primary: '#30D158', primaryLight: '#63E07C', primaryDark: '#248A3D', statusBar: '#30D158' },
  },
  red: {
    light: { primary: '#FF3B30', primaryLight: '#FF6B63', primaryDark: '#CC2F26', statusBar: '#FF3B30' },
    dark: { primary: '#FF453A', primaryLight: '#FF6B63', primaryDark: '#CC2F26', statusBar: '#FF453A' },
  },
  orange: {
    light: { primary: '#FF9500', primaryLight: '#FFB040', primaryDark: '#CC7700', statusBar: '#FF9500' },
    dark: { primary: '#FF9F0A', primaryLight: '#FFB84D', primaryDark: '#CC7F08', statusBar: '#FF9F0A' },
  },
  purple: {
    light: { primary: '#AF52DE', primaryLight: '#C77DFF', primaryDark: '#8E35B8', statusBar: '#AF52DE' },
    dark: { primary: '#BF5AF2', primaryLight: '#D08CFF', primaryDark: '#9B3EC9', statusBar: '#BF5AF2' },
  },
  pink: {
    light: { primary: '#FF2D55', primaryLight: '#FF6B8A', primaryDark: '#CC2444', statusBar: '#FF2D55' },
    dark: { primary: '#FF375F', primaryLight: '#FF6B8A', primaryDark: '#CC2C4C', statusBar: '#FF375F' },
  },
};

interface ThemeContextValue {
  themeMode: ThemeMode;
  themeAccent: ThemeAccent;
  setThemeMode: (mode: ThemeMode) => void;
  setThemeAccent: (accent: ThemeAccent) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeMode: 'system',
  themeAccent: 'blue',
  setThemeMode: () => {},
  setThemeAccent: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [themeAccent, setThemeAccentState] = useState<ThemeAccent>('blue');

  useEffect(() => {
    getSetting('theme_mode').then(val => {
      if (val === 'light' || val === 'dark' || val === 'system') setThemeModeState(val);
    });
    getSetting('theme_accent').then(val => {
      if (val && ['blue', 'green', 'red', 'orange', 'purple', 'pink'].includes(val)) setThemeAccentState(val as ThemeAccent);
    });
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    setSetting('theme_mode', mode);
  }, []);

  const setThemeAccent = useCallback((accent: ThemeAccent) => {
    setThemeAccentState(accent);
    setSetting('theme_accent', accent);
  }, []);

  const value = useMemo(
    () => ({ themeMode, themeAccent, setThemeMode, setThemeAccent }),
    [themeMode, themeAccent],
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
}

/** 动态获取当前配色（自动应用主题模式和强调色） */
export function useColors(): { colors: ColorScheme; isDark: boolean } {
  const { themeMode, themeAccent } = useContext(ThemeContext);
  const systemScheme = useColorScheme();
  const effectiveMode = themeMode === 'system' ? systemScheme || 'light' : themeMode;
  const isDark = effectiveMode === 'dark';
  const baseColors = isDark ? darkColors : lightColors;
  const accent = accentPalettes[themeAccent][isDark ? 'dark' : 'light'];

  const colors: ColorScheme = {
    ...baseColors,
    primary: accent.primary,
    primaryLight: accent.primaryLight,
    primaryDark: accent.primaryDark,
    statusBar: accent.statusBar,
  };

  return { colors, isDark };
}

/** 设置页用的主题配置读写 */
export function useThemeSettings() {
  return useContext(ThemeContext);
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const FontSize = {
  caption: 11,      // 小标注
  caption1: 12,     // 副标注
  footnote: 13,     // 脚注
  subhead: 15,      // 副标题
  body: 17,         // 正文（iOS 标准 body）
  headline: 17,     // 标题（加粗版 body）
  title3: 20,       // 次级标题
  title2: 22,       // 标题
  title1: 28,       // 大标题
  pickupCode: 34,   // 取件码专用
  largeTitle: 34,   // 超大标题
};

const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const Shadow = {
  // iOS 轻阴影 — 卡片
  card: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
    android: {
      elevation: 2,
    },
  }),
  // iOS 中阴影 — 弹窗/浮层
  medium: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
    },
    android: {
      elevation: 6,
    },
  }),
};

export const PackageStatusLabels: Record<string, string> = {
  pending: '待发货',
  shipped: '已发货',
  in_transit: '运输中',
  arrived: '已到达',
  stored: '待取件',
  picked_up: '已取件',
  error: '异常',
};

// iOS 系统色对应的状态颜色
export const PackageStatusColors: Record<string, string> = {
  pending: '#8E8E93',
  shipped: '#007AFF',
  in_transit: '#FF9500',
  arrived: '#34C759',
  stored: '#FF3B30',
  picked_up: '#8E8E93',
  error: '#FF3B30',
};

// 快递公司品牌色
export const CourierColors: Record<string, string> = {
  shunfeng:   '#1A1A1A',
  sf:         '#1A1A1A',
  yuantong:   '#8B2FC9',
  yt:         '#8B2FC9',
  zhongtong:  '#0066CC',
  zt:         '#0066CC',
  shentong:   '#E60012',
  sto:        '#E60012',
  yunda:      '#FFCC00',
  yd:         '#FFCC00',
  jitu:       '#E42313',
  jt:         '#E42313',
  baishi:     '#FF6600',
  best:       '#FF6600',
  jingdong:   '#E2231A',
  jd:         '#E2231A',
  ems:        '#0066B3',
  youzhengguonei: '#0066B3',
  deppon:     '#005BAC',
  cainiao:    '#FF6A00',
  fengchao:   '#00A0E9',
  duoduomaicai: '#E42313',
  meituanyouxuan: '#FFCC00',
  unknown:    '#999999',
};

// 快递公司图标（emoji）
export const CourierIcons: Record<string, string> = {
  shunfeng:   '⚫',
  sf:         '⚫',
  yuantong:   '🟣',
  yt:         '🟣',
  zhongtong:  '🔷',
  zt:         '🔷',
  shentong:   '⚪',
  sto:        '⚪',
  yunda:      '🟡',
  yd:         '🟡',
  jitu:       '🔴',
  jt:         '🔴',
  baishi:     '🟠',
  best:       '🟠',
  jingdong:   '🐕',
  jd:         '🐕',
  ems:        '✉️',
  youzhengguonei: '✉️',
  deppon:     '🚛',
  cainiao:    '🟢',
  fengchao:   '🔵',
  duoduomaicai: '🥬',
  meituanyouxuan: '🛒',
  unknown:    '📦',
};

// 取件点图标 — 根据名称关键词匹配
/** 取件点标识（贴近品牌实际logo） */
export function getPickupPointIcon(name: string): string {
  if (!name) return '📍';
  if (name.includes('兔喜')) return '🐰';
  if (name.includes('菜鸟')) return '🐦';
  if (name.includes('丰巢') || name.includes('蜂巢')) return '🐝';
  if (name.includes('妈妈')) return '🏠';
  if (name.includes('邮政') || name.includes('邮局')) return '📮';
  if (name.includes('京东')) return '🐶';
  if (name.includes('顺丰')) return '🚀';
  if (name.includes('圆通')) return '🟣';
  if (name.includes('中通')) return '🔵';
  if (name.includes('韵达')) return '🟡';
  if (name.includes('申通')) return '⚪';
  if (name.includes('极兔')) return '🐇';
  if (name.includes('百世')) return '🟠';
  if (name.includes('德邦')) return '🚛';
  if (name.includes('多多买菜')) return '🥬';
  if (name.includes('美团')) return '🛵';
  if (name.includes('淘菜菜')) return '🧡';
  if (name.includes('叮咚')) return '🥦';
  if (name.includes('盒马')) return '🦛';
  if (name.includes('朴朴')) return '🛒';
  if (name.includes('山姆')) return '🏪';
  if (name.includes('邻里驿站')) return '🏘️';
  if (name.includes('快递超市')) return '📦';
  if (name.includes('韵达超市')) return '🟡';
  if (name.includes('自提柜')) return '🗄️';
  if (name.includes('代收点')) return '📍';
  if (name.includes('驿站')) return '🏠';
  return '📍';
}

/** 取件点品牌色（用于分组背景） */
export function getPickupPointColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('兔喜')) return '#FF6B35';
  if (n.includes('菜鸟') || n.includes('驿站')) return '#00A6FF';
  if (n.includes('丰巢') || n.includes('蜂巢')) return '#FFCC00';
  if (n.includes('妈妈')) return '#FF6B9D';
  if (n.includes('邮政') || n.includes('邮局')) return '#2E8B57';
  if (n.includes('京东')) return '#E2231A';
  if (n.includes('顺丰')) return '#E60012';
  if (n.includes('圆通')) return '#8B2FC9';
  if (n.includes('中通')) return '#0066FF';
  if (n.includes('韵达')) return '#FFCC00';
  if (n.includes('申通')) return '#FF6600';
  if (n.includes('极兔')) return '#FF2D55';
  if (n.includes('百世')) return '#FF8800';
  if (n.includes('德邦')) return '#0066CC';
  if (n.includes('多多买菜')) return '#FF4400';
  if (n.includes('美团')) return '#FFD100';
  if (n.includes('淘菜菜')) return '#FF5000';
  if (n.includes('叮咚')) return '#00C853';
  if (n.includes('盒马')) return '#0077FF';
  if (n.includes('朴朴')) return '#2ECC71';
  if (n.includes('山姆')) return '#005BAC';
  if (n.includes('快递超市')) return '#FF9500';
  if (n.includes('邻里驿站')) return '#34C759';
  if (n.includes('自提柜')) return '#8E8E93';
  if (n.includes('代收点')) return '#8E8E93';
  return '#A0A0A0';
}

// 购买平台图标
export const PlatformIcons: Record<string, string> = {
  '淘宝': '🧡',
  '京东': '❤️',
  '拼多多': '🔴',
  '抖音': '🎵',
  '美团': '🟡',
  '闲鱼': '🟡',
  '1688': '🔴',
  '小米商城': '🟠',
  '菜鸟': '🟢',
};

// 全局样式（动态配色）
export function createGlobalStyles(colors: ColorScheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginHorizontal: Spacing.lg,
      marginVertical: Spacing.sm,
    },
    input: {
      backgroundColor: colors.secondarySurface,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      fontSize: FontSize.body,
      color: colors.textPrimary,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.md,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      minHeight: 44,
    },
    buttonDanger: {
      backgroundColor: colors.error,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.md,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      minHeight: 44,
    },
    buttonOutline: {
      backgroundColor: 'transparent',
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.separator,
      paddingVertical: Spacing.md,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      minHeight: 44,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: FontSize.body,
      fontWeight: FontWeight.semibold,
    },
    buttonTextOutline: {
      color: colors.primary,
      fontSize: FontSize.body,
      fontWeight: FontWeight.medium,
    },
  });
}

export const globalStyles = createGlobalStyles(lightColors);
