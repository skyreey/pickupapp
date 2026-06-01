// ============================================================
// 响应式缩放工具
// 基准宽度 390（iPhone 14），所有尺寸按屏幕宽度等比缩放
// ============================================================
import { Dimensions, PixelRatio } from 'react-native';

const BASE_WIDTH = 390;

const { width: screenWidth } = Dimensions.get('window');

// 缩放系数（竖屏锁定，只按宽度）
const scale = screenWidth / BASE_WIDTH;

// 字体缩放系数（上限 1.3x，防止平板端字体过大）
const fontScale = Math.min(scale, 1.3);

/**
 * 基础等比缩放 —— 间距、圆角、图标等
 */
export function scaleSize(size: number): number {
  const newSize = size * scale;
  // 确保整数像素
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

/**
 * 字体缩放 —— 带上限，防止平板端字体过大
 */
export function scaleFont(size: number): number {
  const newSize = size * fontScale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

/**
 * 温和缩放 —— 大屏增幅递减（factor 越大越温和）
 * 用于不需要完全等比缩放的场景
 */
export function scaleModerate(size: number, factor: number = 0.5): number {
  const newSize = size + (scaleSize(size) - size) * factor;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}
