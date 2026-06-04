// ============================================================
// OCR 图片预处理 — 自动裁剪聚焦 + 尺寸优化
// 目标：提高取件码/快递点/地址/电话的识别率
// 策略：去 UI 边框 · 限制最大尺寸 · 保持文字清晰度
// ============================================================
import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { createLogger } from '../utils/logger';
import { createFingerprint, getOcrCache, setOcrCache } from './ocr-cache';
import { startPerf } from './perf-tracker';

const log = createLogger('OcrPreprocessor');

export type ImageSource = 'screenshot' | 'camera' | 'gallery';

const MAX_EDGE = 2048; // 最大边长（超过等比缩放）

/** 获取图片实际尺寸 */
function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve({ width: 1080, height: 1920 }), // 失败用默认值
    );
  });
}

/**
 * 预处理图片，返回优化后的 URI
 *
 * 截图模式（screenshot）：裁掉顶部状态栏和底部导航栏
 * 拍照模式（camera）：轻微裁剪边缘模糊区
 * 相册模式（gallery）：保守裁剪
 */
export async function preprocessForOcr(
  uri: string,
  source: ImageSource = 'gallery',
): Promise<string> {
  // 检查缓存（轻量级指纹，避免重复预处理）
  const fingerprint = createFingerprint(uri);
  const cached = getOcrCache(fingerprint);
  if (cached) {
    log.debug('图片预处理命中缓存');
    return cached;
  }

  const done = startPerf('ocr-preprocess');
  try {
    const dims = await getImageDimensions(uri);

    // 计算裁剪区域
    let cropX = 0, cropY = 0, cropW = dims.width, cropH = dims.height;

    switch (source) {
      case 'screenshot':
        // 裁掉顶部状态栏(6%) + 底部导航/输入区(10%) + 左右边距(2%)
        cropX = Math.round(dims.width * 0.02);
        cropY = Math.round(dims.height * 0.06);
        cropW = Math.round(dims.width * 0.96);
        cropH = Math.round(dims.height * 0.84);
        break;
      case 'camera':
        // 裁掉四周模糊边缘(4%)
        cropX = Math.round(dims.width * 0.04);
        cropY = Math.round(dims.height * 0.04);
        cropW = Math.round(dims.width * 0.92);
        cropH = Math.round(dims.height * 0.92);
        break;
      case 'gallery':
      default:
        // 轻微裁剪边缘(2%)
        cropX = Math.round(dims.width * 0.02);
        cropY = Math.round(dims.height * 0.02);
        cropW = Math.round(dims.width * 0.96);
        cropH = Math.round(dims.height * 0.96);
        break;
    }

    const actions: ImageManipulator.Action[] = [];

    // 只在裁剪有意义时执行（裁剪超过5%才值得）
    const cropRatio = (cropW * cropH) / (dims.width * dims.height);
    if (cropRatio < 0.92) {
      actions.push({ crop: { originX: cropX, originY: cropY, width: cropW, height: cropH } });
    }

    // 限制最大尺寸：超过 MAX_EDGE 等比缩放
    const targetW = Math.min(cropW, MAX_EDGE);
    const targetH = Math.min(cropH, MAX_EDGE);
    if (cropW > MAX_EDGE || cropH > MAX_EDGE) {
      const ratio = Math.min(targetW / cropW, targetH / cropH);
      actions.push({
        resize: { width: Math.round(cropW * ratio), height: Math.round(cropH * ratio) },
      });
    }

    if (actions.length === 0) {
      done();
      setOcrCache(fingerprint, uri);
      return uri; // 无需处理
    }

    const result = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.95,
      format: ImageManipulator.SaveFormat.PNG,
    });
    done();
    // 缓存处理结果
    setOcrCache(fingerprint, result.uri);
    return result.uri;
  } catch (e) {
    done();
    log.warn('图片预处理失败，返回原图', { error: String(e) });
    return uri;
  }
}

/**
 * 根据宽高比推断图片来源类型
 */
export function detectImageSource(width: number, height: number): ImageSource {
  const ratio = width / height;
  if (ratio < 0.45 || ratio > 2.2) return 'screenshot'; // 极窄/极宽 → 截图
  if (ratio > 0.7 && ratio < 1.4) return 'camera';       // 接近正方形 → 拍照
  return 'gallery';
}
