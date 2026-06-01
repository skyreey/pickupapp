import { requireNativeModule } from 'expo-modules-core';

const GalleryModule = requireNativeModule('ExpoGalleryLauncher');

/** 打开系统相册，返回选中图片的 URI 列表 */
export async function launchGallery(): Promise<string[]> {
  return await GalleryModule.launchGallery();
}
