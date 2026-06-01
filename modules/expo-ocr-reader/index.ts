import { requireNativeModule } from 'expo-modules-core';

const OcrModule = requireNativeModule('ExpoOcrReader');

/** 识别图片中的文字，返回纯文本 */
export async function recognizeImage(uri: string): Promise<string> {
  return await OcrModule.recognizeImage(uri);
}
