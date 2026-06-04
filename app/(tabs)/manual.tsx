// ============================================================
// 手动录入页 — 粘贴短信 / 输入单号 / 截图识别 / 家庭管理
// ============================================================
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, KeyboardAvoidingView, Alert, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { parseSms, guessCarrierByTrackingNumber, parseFreeformText } from '../../src/services/sms-parser';
import { parseOcrText, type OcrPackageInfo } from '../../src/services/ocr-parser';
import { preprocessForOcr } from '../../src/services/ocr-preprocessor';
import {
  insertPackage, getPackageByTrackingNumber, getPackageByPickupCode,
  findMatchingPackage, findPackageByTailNumber, markAsPickedUp, updatePickupCode,
} from '../../src/database/dao';
import type { Package } from '../../src/models';
import { generateId, normalizeText } from '../../src/utils/formatters';
import { createPackage } from '../../src/utils/package-factory';
import { refreshWidget } from '../../src/services/widget-refresh';
import { canAddPackage, FREE_PACKAGE_LIMIT } from '../../src/services/settings-store';
import {
  FontSize, Spacing, BorderRadius, Shadow, useColors, createGlobalStyles,
} from '../../src/constants/theme';
import type { ColorScheme } from '../../src/constants/theme';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

// OCR — static imports with fallback
let launchGallery: any = null;
let recognizeImage: any = null;
try { ({ launchGallery } = require('../../modules/expo-gallery-launcher')); } catch {}
try { ({ recognizeImage } = require('../../modules/expo-ocr-reader')); } catch {}

/** 校验取件码格式：合法返回 null，不合法返回错误提示 */
function validatePickupCode(code: string | null | undefined): string | null {
  if (!code || !code.trim()) return null;
  const cleaned = code.trim();
  // 纯数字（4-10位）
  if (/^\d{4,10}$/.test(cleaned)) return null;
  // 数字-数字-数字（如 8-3-5021）
  if (/^\d{1,3}-\d{1,3}-\d{2,6}$/.test(cleaned)) return null;
  // 字母+数字组合（如 SF8012）
  if (/^[A-Za-z]{1,4}\d{4,12}$/.test(cleaned)) return null;
  // 货架号格式（如 A-12-3）
  if (/^[A-Za-z]\d?-\d{1,3}-\d{1,3}$/.test(cleaned)) return null;
  return '格式异常';
}

type Mode = 'sms' | 'tracking' | 'ocr';

interface OcrResultItem {
  uri: string;
  info: OcrPackageInfo | null;
  text: string;
  selected: boolean;
}

export default function ManualScreen() {
  const { colors } = useColors();
  const styles = createStyles(colors);
  const gStyles = createGlobalStyles(colors);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('sms');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{
    type: 'sms' | 'tracking';
    title: string;
    detail: string;
    packageId?: string;
  } | null>(null);
  // 暂存解析结果，点保存时写入数据库
  const [pendingPkg, setPendingPkg] = useState<Package | null>(null);
  // 检查是否有转发导入的短信文本
  useEffect(() => {
    try {
      const { getPendingSharedText } = require('../../app/(tabs)/_layout');
      const sharedText = getPendingSharedText?.();
      if (sharedText) {
        setMode('sms');
        setText(sharedText);
      }
    } catch {}
  }, []);

  const handleParse = useCallback(async () => {
    if (!text.trim()) return;

    setLoading(true);
    setPendingPkg(null);
    try {
      if (mode === 'sms') {
        // 解析短信 → 标准正则 → 口语化兜底
        let result = parseSms(text);
        if (!result) {
          result = parseFreeformText(text);
        }

        if (!result) {
          Alert.alert('未识别', '未检测到取件码信息，请检查短信内容\n\n提示：也可尝试用「截图识别」功能');
          return;
        }

        const sourceLabel = parseSms(text) ? 'sms' : 'freeform';
        setPreview({
          type: 'sms',
          title: `取件码: ${result.code}`,
          detail: [
            `快递公司: ${result.companyName}`,
            result.address ? `取件地址: ${result.address}` : '',
            result.stationName ? `站点: ${result.stationName}` : '',
          ].filter(Boolean).join('\n'),
        });
        // 暂存包裹数据
        setPendingPkg({
          id: generateId(),
          trackingNumber: '',
          carrier: result.company,
          carrierName: result.companyName,
          orderSource: '',
          productName: '',
          pickupCode: result.code,
          pickupAddress: result.address,
          pickupPointName: result.stationName || null,
          pickupPointPhone: result.stationPhone || null,
          businessHours: result.businessHours || null,
          notes: null,
          currentStatus: 'stored',
          statusUpdatedAt: Date.now(),
          source: 'manual',
          createdAt: Date.now(),
          pickedUpAt: 0,
          expiresAt: result.expiresAt ?? 0,
          pinned: false,
          smsRawText: text,
          screenshotPaths: null,
          assignedTo: null,
          assignedToName: null,
          pushedBy: null,
          pushStatus: null,
        });
      } else {
        // 输入单号 → 直接创建包裹
        const tn = text.trim().toUpperCase();
        const guess = guessCarrierByTrackingNumber(tn);
        const now = Date.now();

        setPreview({
          type: 'tracking',
          title: `${guess.name} ${tn}`,
          detail: '保存后将添加到包裹列表，收货短信到来时自动匹配取件码',
        });

        setPendingPkg({
          id: generateId(),
          trackingNumber: tn,
          carrier: guess.code,
          carrierName: guess.name,
          orderSource: '',
          productName: '',
          pickupCode: null,
          pickupAddress: null,
          pickupPointName: null,
          pickupPointPhone: null,
          businessHours: null,
          notes: null,
          currentStatus: 'shipped',
          statusUpdatedAt: now,
          source: 'manual',
          createdAt: now,
          pickedUpAt: 0,
          expiresAt: 0,
          pinned: false,
          smsRawText: null,
          screenshotPaths: null,
          assignedTo: null,
          assignedToName: null,
          pushedBy: null,
          pushStatus: null,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [text, mode]);

  // ===== OCR 截图识别 =====
  const [ocrResults, setOcrResults] = useState<OcrResultItem[]>([]);
  const [ocrProgress, setOcrProgress] = useState('');
  const [viewingRawIdx, setViewingRawIdx] = useState<number | null>(null);

  const processImages = useCallback(async (uris: string[], source: 'screenshot' | 'camera' | 'gallery' = 'gallery') => {
    const items: OcrResultItem[] = [];
    const batch = uris.slice(0, 9);
    for (let i = 0; i < batch.length; i++) {
      setOcrProgress(`正在预处理 ${i + 1}/${batch.length}...`);
      // 预处理：自动裁剪 + 尺寸优化
      const optimizedUri = await preprocessForOcr(batch[i], source);

      setOcrProgress(`正在识别 ${i + 1}/${batch.length}...`);
      let text = '';
      if (recognizeImage) {
        try { text = (await recognizeImage(optimizedUri)) || ''; } catch {}
      }
      // 如果优化后的图识别为空，用原图重试
      if (!text && optimizedUri !== batch[i]) {
        try { text = (await recognizeImage(batch[i])) || ''; } catch {}
      }
      const info = text ? parseOcrText(text) : null;
      items.push({ uri: batch[i], info, text: text || '(无文字)', selected: !!info });
    }
    setOcrProgress('');
    setOcrResults(items);
    if (items.every(i => !i.info)) {
      Alert.alert('未识别', '所选图片均未提取到取件信息，请确认图片包含快递通知截图');
    }
  }, []);

  const handlePickImages = useCallback(async () => {
    if (!launchGallery) {
      Alert.alert('功能不可用', '相册模块未加载');
      return;
    }
    setLoading(true);
    try {
      const uris: string[] = await launchGallery();
      if (!uris || uris.length === 0) { setLoading(false); return; }
      await processImages(uris, 'gallery');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知错误';
      Alert.alert('操作失败', msg || '请授予相册权限后重试');
    }
    setLoading(false);
  }, [processImages]);

  const handleTakePhoto = useCallback(async () => {
    setLoading(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('需要相机权限', '请在系统设置中授权相机访问');
        setLoading(false);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const uris = result.assets.map(a => a.uri);
        await processImages(uris, 'camera');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知错误';
      Alert.alert('拍照失败', msg || '请授予相机权限后重试');
    }
    setLoading(false);
  }, [processImages]);

  const toggleOcrItem = useCallback((index: number) => {
    setOcrResults(prev => prev.map((item, i) =>
      i === index ? { ...item, selected: !item.selected } : item,
    ));
  }, []);

  const handleSaveOcrResults = useCallback(async () => {
    const selected = ocrResults.filter(r => r.selected && r.info);
    if (selected.length === 0) {
      Alert.alert('请至少选择一个识别结果');
      return;
    }
    if (!canAddPackage(selected.length)) {
      Alert.alert(
        '已达免费上限',
        `免费版最多可添加 ${FREE_PACKAGE_LIMIT} 个包裹。\n已选 ${selected.length} 个，超出限制。\n升级 Pro 即可无限添加（¥29.9/年）。`
      );
      return;
    }
    setLoading(true);
    let count = 0;
    let skipped = 0;
    const skippedCodes: string[] = [];
    for (const { info } of selected) {
      if (!info) continue;

      // === 去重：按取件码 ===
      if (info.pickupCode) {
        const dupByCode = getPackageByPickupCode(info.pickupCode);
        if (dupByCode) {
          // 已有相同取件码 → 确保状态是 stored（可能在运输中/已签收标签下找不到）
          if (dupByCode.currentStatus !== 'stored' && dupByCode.currentStatus !== 'picked_up') {
            updatePickupCode(dupByCode.id, info.pickupCode, info.pickupAddress);
          }
          skipped++;
          skippedCodes.push(`${info.pickupCode}（${info.carrierName}）`);
          continue;
        }
      }
      // === 去重：按快递单号 ===
      let existing: Package | null = null;
      if (info.trackingNumber) {
        existing = getPackageByTrackingNumber(info.trackingNumber);
      }
      // === 去重：尾号匹配（只识别到尾号时匹配已有包裹） ===
      if (!existing && info.tailNumber) {
        existing = findPackageByTailNumber(info.tailNumber, info.carrier !== 'unknown' ? info.carrier : undefined);
      }
      // === 去重：模糊匹配 ===
      if (!existing && info.carrier !== 'unknown' && info.pickupAddress) {
        existing = findMatchingPackage(info.carrier, info.pickupAddress, info.trackingNumber || null);
      }

      if (existing) {
        // 已有记录：更新状态 + 取件码
        if (info.pickupCode && !existing.pickupCode) {
          updatePickupCode(existing.id, info.pickupCode, info.pickupAddress);
        } else if (existing.currentStatus !== 'stored' && existing.currentStatus !== 'picked_up') {
          // 状态修正：OCR确认有取件码 → 改为待取件
          if (info.pickupCode || info.pickupAddress) {
            updatePickupCode(existing.id, existing.pickupCode || info.pickupCode || '',
              existing.pickupAddress || info.pickupAddress);
          }
        }
        if (info.isPickedUp && existing.currentStatus !== 'picked_up') {
          markAsPickedUp(existing.id);
        }
        // 补充缺失的营业时间
        if (info.businessHours && !existing.businessHours) {
          updatePickupCode(existing.id, existing.pickupCode || '',
            existing.pickupAddress || '', existing.pickupPointName || '',
            existing.pickupPointPhone || '', info.businessHours);
        }
        skipped++;
        skippedCodes.push(`${existing.pickupCode || existing.trackingNumber}（${existing.carrierName}）`);
        continue;
      }
      // 追踪号：优先用完整单号，否则用尾号
      const trackingNumber = info.trackingNumber || (info.tailNumber ? `尾号${info.tailNumber}` : '');
      insertPackage(createPackage({
        trackingNumber,
        carrier: info.carrier,
        carrierName: info.carrierName,
        orderSource: info.orderSource,
        productName: info.productName,
        pickupCode: info.pickupCode,
        pickupAddress: info.pickupAddress,
        pickupPointName: info.stationName || undefined,
        pickupPointPhone: info.stationPhone || undefined,
        businessHours: info.businessHours || undefined,
        currentStatus: info.isPickedUp ? 'picked_up' : (info.pickupCode ? 'stored' : 'shipped'),
        source: 'manual',
        pickedUpAt: info.isPickedUp ? Date.now() : 0,
        screenshotPaths: JSON.stringify(selected.map(s => s.uri)),
      }));
      count++;
    }
    const msgParts = [`成功添加 ${count} 个包裹`];
    if (skipped > 0) {
      msgParts.push(`${skipped} 个已存在：`);
      msgParts.push(skippedCodes.join('、'));
      msgParts.push('可在「待取件」或搜索找到');
    }
    Alert.alert('导入完成', msgParts.join('\n'));
    setLoading(false);
    setOcrResults([]);
    refreshWidget();
    router.navigate('/(tabs)');
  }, [ocrResults, router]);

  const handleSave = useCallback(() => {
    if (!pendingPkg) return;

    // === 去重：按取件码 + 快递单号 ===
    if (pendingPkg.pickupCode) {
      const dupByCode = getPackageByPickupCode(pendingPkg.pickupCode);
      if (dupByCode) {
        Alert.alert('已存在', `取件码 ${pendingPkg.pickupCode} 已存在，无需重复添加`);
        return;
      }
    }
    if (pendingPkg.trackingNumber) {
      const dupByTn = getPackageByTrackingNumber(pendingPkg.trackingNumber);
      if (dupByTn) {
        // 已有记录但缺取件码 → 补充取件码
        if (pendingPkg.pickupCode && !dupByTn.pickupCode) {
          updatePickupCode(dupByTn.id, pendingPkg.pickupCode, pendingPkg.pickupAddress,
            pendingPkg.pickupPointName, pendingPkg.pickupPointPhone, pendingPkg.businessHours);
          Alert.alert('已更新', `已为快递单号 ${pendingPkg.trackingNumber} 补充取件码`);
          refreshWidget();
          router.navigate('/(tabs)');
          return;
        }
        Alert.alert('已存在', `快递单号 ${pendingPkg.trackingNumber} 已存在`);
        return;
      }
    }
    // 模糊匹配：同快递公司 + 同地址
    if (pendingPkg.carrier && pendingPkg.pickupAddress) {
      const matched = findMatchingPackage(pendingPkg.carrier, pendingPkg.pickupAddress, pendingPkg.trackingNumber);
      if (matched) {
        if (pendingPkg.pickupCode && !matched.pickupCode) {
          updatePickupCode(matched.id, pendingPkg.pickupCode, pendingPkg.pickupAddress,
            pendingPkg.pickupPointName, pendingPkg.pickupPointPhone, pendingPkg.businessHours);
          Alert.alert('已更新', '已为已有包裹补充取件码');
        } else {
          Alert.alert('已存在', '该地址已有相似包裹，请勿重复添加');
        }
        refreshWidget();
        router.navigate('/(tabs)');
        return;
      }
    }

    if (!canAddPackage(1)) {
      Alert.alert(
        '已达免费上限',
        `免费版最多可添加 ${FREE_PACKAGE_LIMIT} 个包裹。\n升级 Pro 即可无限添加（¥29.9/年）。`
      );
      return;
    }
    insertPackage(pendingPkg);
    refreshWidget();
    router.navigate('/(tabs)');
    setPreview(null);
    setPendingPkg(null);
    setText('');
  }, [pendingPkg, router]);

  return (
    <ErrorBoundary>
    <KeyboardAvoidingView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* 顶部导航栏 */}
        <View style={styles.navBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← 返回</Text>
          </Pressable>
          <Text style={styles.navTitle}>手动添加</Text>
          <View style={styles.backBtn} />
        </View>

        {/* 模式切换 */}
        <View style={styles.segmentControl}>
          <Pressable
            style={[styles.segmentBtn, mode === 'sms' && styles.segmentBtnActive]}
            onPress={() => { setMode('sms'); setPreview(null); setPendingPkg(null); }}
          >
            <Text style={[styles.segmentBtnText, mode === 'sms' && styles.segmentBtnTextActive]}>
              粘贴短信
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, mode === 'ocr' && styles.segmentBtnActive]}
            onPress={() => { setMode('ocr'); setPreview(null); setPendingPkg(null); }}
          >
            <Text style={[styles.segmentBtnText, mode === 'ocr' && styles.segmentBtnTextActive]}>
              截图识别
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, mode === 'tracking' && styles.segmentBtnActive]}
            onPress={() => { setMode('tracking'); setPreview(null); setPendingPkg(null); }}
          >
            <Text style={[styles.segmentBtnText, mode === 'tracking' && styles.segmentBtnTextActive]}>
              输入单号
            </Text>
          </Pressable>
        </View>

        {/* OCR 截图识别内容 */}
        {mode === 'ocr' ? (
          <View>
            {ocrResults.length === 0 ? (
              <View>
                <Pressable
                  style={[gStyles.button, loading && { opacity: 0.5 }]}
                  onPress={handlePickImages}
                  disabled={loading}
                >
                  <Text style={gStyles.buttonText}>
                    {ocrProgress || (loading ? '识别中...' : '🖼️ 从相册选择（可多选9张）')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[gStyles.button, { marginTop: Spacing.md, backgroundColor: colors.secondarySurface }, loading && { opacity: 0.5 }]}
                  onPress={handleTakePhoto}
                  disabled={loading}
                >
                  <Text style={[gStyles.buttonText, { color: colors.textPrimary }]}>
                    📷 拍照识别
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.ocrResults}>
                <View style={styles.ocrHeader}>
                  <Text style={styles.ocrCount}>
                    识别到 {ocrResults.filter(r => r.info).length}/{ocrResults.length} 个包裹
                  </Text>
                  <Pressable onPress={handleSaveOcrResults}>
                    <Text style={styles.ocrSaveBtn}>保存选中</Text>
                  </Pressable>
                </View>
                <Pressable style={{ marginBottom: Spacing.md }} onPress={() => setOcrResults([])}>
                  <Text style={{ color: colors.primary, fontSize: FontSize.subhead, textAlign: 'center' }}>← 重新选择截图</Text>
                </Pressable>

                {ocrResults.map((item, index) => (
                  <View key={index}>
                    <Pressable
                      style={[styles.ocrItem, item.selected && styles.ocrItemSelected]}
                      onPress={() => toggleOcrItem(index)}
                    >
                      <Image source={{ uri: item.uri }} style={styles.ocrThumb} />
                      <View style={styles.ocrInfo}>
                        {item.info ? (
                          <>
                            <View style={styles.ocrTitleRow}>
                              <Text style={styles.ocrCarrier}>
                                {item.info.carrierName} {item.info.trackingNumber}
                              </Text>
                              <View style={[styles.ocrConfBadge, item.info.confidence === 'high' ? styles.ocrConfHigh : styles.ocrConfLow]}>
                                <Text style={[styles.ocrConfText, { color: item.info.confidence === 'high' ? '#34C759' : '#FF9500' }]}>
                                  {item.info.confidence === 'high' ? '高置信' : '低置信'}
                                </Text>
                              </View>
                            </View>
                            {item.info.productName ? (
                              <Text style={styles.ocrProduct}>{item.info.productName}</Text>
                            ) : null}
                            <Text style={styles.ocrStatus}>
                              {item.info.orderSource ? `${item.info.orderSource} · ` : ''}
                              {item.info.isPickedUp ? '✅ 已签收' : '📦 运输中'}
                            </Text>
                            <View style={styles.ocrExtraRow}>
                              {item.info.pickupCode ? (
                                <Text style={styles.ocrExtraBadge}>取件码 {item.info.pickupCode}</Text>
                              ) : null}
                              {item.info.pickupCode && validatePickupCode(item.info.pickupCode) ? (
                                <Text style={styles.ocrFormatWarn}>⚠ {validatePickupCode(item.info.pickupCode)}</Text>
                              ) : null}
                              {item.info.deliveryDate ? (
                                <Text style={styles.ocrExtraDate}>{item.info.deliveryDate}</Text>
                              ) : null}
                            </View>
                          </>
                        ) : (
                          <Text style={styles.ocrNoMatch}>
                            未识别到快递信息
                          </Text>
                        )}
                      </View>
                      <Text style={styles.ocrCheckbox}>
                        {item.selected ? '☑' : '☐'}
                      </Text>
                    </Pressable>
                    <Pressable style={styles.ocrRawBtn} onPress={() => setViewingRawIdx(viewingRawIdx === index ? null : index)}>
                      <Text style={styles.ocrRawBtnText}>
                        {viewingRawIdx === index ? '收起原文' : '查看原文'}
                      </Text>
                    </Pressable>
                    {viewingRawIdx === index ? (
                      <View style={styles.ocrRawBox}>
                        <Text style={styles.ocrRawText}>{item.text}</Text>
                      </View>
                    ) : null}
                  </View>
                ))}

                {/* 底部操作栏：全选/反选 + 保存 */}
                {ocrResults.length > 0 ? (
                  <View style={styles.ocrBottomBar}>
                    <Pressable
                      style={styles.ocrSelectAllBtn}
                      onPress={() => {
                        const hasUnselected = ocrResults.some(r => !r.selected);
                        setOcrResults(prev => prev.map(r => ({ ...r, selected: hasUnselected })));
                      }}
                    >
                      <Text style={styles.ocrSelectAllText}>
                        {ocrResults.every(r => r.selected) ? '☐ 取消全选' : '☑ 全选'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.ocrBottomSaveBtn, loading && { opacity: 0.5 }]}
                      onPress={handleSaveOcrResults}
                      disabled={loading}
                    >
                      <Text style={styles.ocrBottomSaveText}>
                        {loading ? '保存中...' : `保存选中 (${ocrResults.filter(r => r.selected && r.info).length})`}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        ) : (
          <>
        {/* 输入区 */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder={
              mode === 'sms'
                ? '粘贴快递取件码短信内容...\n\n例：\n【菜鸟驿站】您的包裹已到XX小区南门，取件码：8-3-5021'
                : '输入快递单号...\n\n例：SF1234567890'
            }
            placeholderTextColor={colors.textPlaceholder}
            value={text}
            onChangeText={setText}
            multiline={mode === 'sms'}
            numberOfLines={mode === 'sms' ? 8 : 2}
            textAlignVertical={mode === 'sms' ? 'top' : 'center'}
            autoCapitalize="characters"
          />
        </View>

        {/* 测试用：加载预设短信（调试用） */}
        {__DEV__ && mode === 'sms' ? (
          <Pressable
            onPress={() => setText('【菜鸟驿站】您的包裹已到菜鸟驿站，取件码：6-8-1234，请凭取件码至XX小区南门菜鸟驿站取件，联系电话：13812345678，营业时间：08:00-22:00')}
            style={styles.testBtn}
          >
            <Text style={styles.testBtnText}>加载测试短信</Text>
          </Pressable>
        ) : null}

        {/* 操作按钮 */}
        <Pressable
          style={[gStyles.button, loading && styles.btnDisabled]}
          onPress={handleParse}
          disabled={loading || !text.trim()}
        >
          <Text style={gStyles.buttonText}>
            {loading ? '解析中...' : mode === 'sms' ? '解析取件码' : '查询物流'}
          </Text>
        </Pressable>

        {/* 预览结果 */}
        {preview ? (
          <View style={styles.preview}>
            <Text style={styles.previewTitle}>{preview.title}</Text>
            <Text style={styles.previewDetail}>{preview.detail}</Text>
            <Pressable style={gStyles.button} onPress={handleSave}>
              <Text style={gStyles.buttonText}>
                {preview.type === 'sms' ? '确认保存' : '确认保存'}
              </Text>
            </Pressable>
          </View>
        ) : null}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
    </ErrorBoundary>
  );
}

const createStyles = (colors: ColorScheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  backBtn: {
    width: 64,
    paddingVertical: Spacing.xs,
  },
  backBtnText: {
    fontSize: FontSize.subhead,
    color: colors.primary,
    fontWeight: '500',
  },
  navTitle: {
    fontSize: FontSize.headline,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  segmentControl: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  segmentBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.separator,
  },
  segmentBtnActive: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  segmentBtnText: {
    fontSize: FontSize.subhead,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  segmentBtnTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  inputContainer: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadow.card,
  },
  textInput: {
    fontSize: FontSize.body,
    color: colors.textPrimary,
    lineHeight: 22,
    minHeight: 80,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  preview: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    ...Shadow.card,
  },
  previewTitle: {
    fontSize: FontSize.headline,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  previewDetail: {
    fontSize: FontSize.subhead,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  // ---- OCR 截图识别 ----
  ocrResults: {
    marginTop: Spacing.lg,
  },
  ocrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  ocrCount: {
    fontSize: FontSize.subhead,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  ocrSaveBtn: {
    fontSize: FontSize.subhead,
    color: colors.primary,
    fontWeight: '700',
  },
  ocrItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadow.card,
  },
  ocrItemSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  ocrThumb: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.sm,
    backgroundColor: colors.secondarySurface,
  },
  ocrInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  ocrTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ocrCarrier: {
    fontSize: FontSize.subhead,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  ocrConfBadge: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  ocrConfHigh: {
    backgroundColor: '#34C75922',
  },
  ocrConfLow: {
    backgroundColor: '#FF950022',
  },
  ocrConfText: {
    fontSize: FontSize.caption1,
    fontWeight: '600',
  },
  ocrProduct: {
    fontSize: FontSize.footnote,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ocrStatus: {
    fontSize: FontSize.caption1,
    color: colors.textTertiary,
    marginTop: 2,
  },
  ocrNoMatch: {
    fontSize: FontSize.caption1,
    color: colors.error,
    lineHeight: 16,
  },
  ocrExtraRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  ocrExtraBadge: {
    fontSize: FontSize.caption1,
    color: colors.primary,
    backgroundColor: colors.secondarySurface,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
    fontWeight: '600',
  },
  ocrFormatWarn: {
    fontSize: FontSize.caption1,
    color: '#FF3B30',
    backgroundColor: '#FFF2F2',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
    fontWeight: '600',
  },
  ocrExtraDate: {
    fontSize: FontSize.caption1,
    color: colors.textTertiary,
  },
  ocrRawBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 4,
  },
  ocrRawBtnText: {
    fontSize: FontSize.caption1,
    color: colors.textTertiary,
  },
  ocrRawBox: {
    backgroundColor: colors.secondarySurface,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  ocrRawText: {
    fontSize: FontSize.caption1,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  ocrCheckbox: {
    fontSize: 24,
    paddingLeft: Spacing.sm,
  },
  // ---- OCR 底部操作栏 ----
  ocrBottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: colors.separator,
    gap: Spacing.sm,
  },
  ocrSelectAllBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.secondarySurface,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  ocrSelectAllText: {
    fontSize: FontSize.subhead,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  ocrBottomSaveBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ocrBottomSaveText: {
    fontSize: FontSize.subhead,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  // ---- 调试测试按钮 ----
  testBtn: {
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: Spacing.md,
  },
  testBtnText: {
    fontSize: FontSize.caption1,
    color: colors.primary,
  },
});
