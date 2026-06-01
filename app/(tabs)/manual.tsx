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
import { getMembers, addMember, removeMember } from '../../src/services/family-service';
import type { FamilyMember } from '../../src/models';
import { parseSms, guessCarrierByTrackingNumber } from '../../src/services/sms-parser';
import { parseOcrText, type OcrPackageInfo } from '../../src/services/ocr-parser';
import {
  insertPackage, getPackageByTrackingNumber, markAsPickedUp, updatePickupCode,
} from '../../src/database/dao';
import type { Package } from '../../src/models';
import { generateId, normalizeText } from '../../src/utils/formatters';
import { refreshWidget } from '../../src/services/widget-refresh';
import { canAddPackage, FREE_PACKAGE_LIMIT } from '../../src/services/settings-store';
import {
  FontSize, Spacing, BorderRadius, Shadow, useColors, createGlobalStyles,
} from '../../src/constants/theme';
import type { ColorScheme } from '../../src/constants/theme';

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
  // 家庭管理
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [famName, setFamName] = useState('');
  const [showFamInput, setShowFamInput] = useState(false);
  const loadFamily = useCallback(async () => { setFamily(await getMembers()); }, []);
  useEffect(() => { loadFamily(); }, [loadFamily]);

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
        // 解析短信
        const result = parseSms(text);
        if (!result) {
          Alert.alert('未识别', '未检测到取件码信息，请检查短信内容');
          return;
        }
        setPreview({
          type: 'sms',
          title: `取件码: ${result.code}`,
          detail: [
            `快递公司: ${result.companyName}`,
            result.address ? `取件地址: ${result.address}` : '',
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

  const processImages = useCallback(async (uris: string[]) => {
    const items: OcrResultItem[] = [];
    const batch = uris.slice(0, 9);
    for (let i = 0; i < batch.length; i++) {
      setOcrProgress(`正在识别 ${i + 1}/${batch.length}...`);
      let text = '';
      if (recognizeImage) {
        try { text = (await recognizeImage(batch[i])) || ''; } catch {}
      }
      const info = text ? parseOcrText(text) : null;
      items.push({ uri: batch[i], info, text: text || '(无文字)', selected: !!info });
    }
    setOcrProgress('');
    setOcrResults(items);
    if (items.every(i => !i.info)) {
      Alert.alert('未识别', '所选图片均未提取到快递单号');
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
      await processImages(uris);
    } catch (e: any) {
      Alert.alert('操作失败', e.message || '请授予相册权限后重试');
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
        await processImages(uris);
      }
    } catch (e: any) {
      Alert.alert('拍照失败', e.message || '请授予相机权限后重试');
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
    for (const { info } of selected) {
      if (!info) continue;
      const existing = getPackageByTrackingNumber(info.trackingNumber);
      if (existing) {
        // 已有记录：更新取件状态 + 取件码
        if (info.isPickedUp && existing.currentStatus !== 'picked_up') {
          markAsPickedUp(existing.id);
        }
        if (info.pickupCode && !existing.pickupCode) {
          updatePickupCode(existing.id, info.pickupCode, info.pickupAddress);
        }
        continue;
      }
      const now = Date.now();
      const pkgId = generateId();
      insertPackage({
        id: pkgId,
        trackingNumber: info.trackingNumber,
        carrier: info.carrier,
        carrierName: info.carrierName,
        orderSource: info.orderSource,
        productName: info.productName,
        pickupCode: info.pickupCode || null,
        pickupAddress: info.pickupAddress || null,
        pickupPointName: null,
        pickupPointPhone: null,
        businessHours: null,
        notes: null,
        currentStatus: info.isPickedUp ? 'picked_up' : 'shipped',
        statusUpdatedAt: now,
        source: 'manual',
        createdAt: now,
        pickedUpAt: info.isPickedUp ? now : 0,
        expiresAt: 0,
        pinned: false,
        smsRawText: null,
        screenshotPaths: JSON.stringify(selected.map(s => s.uri)),
        assignedTo: null,
        assignedToName: null,
        pushedBy: null,
        pushStatus: null,
      });
      count++;
    }
    Alert.alert('导入完成',
      `成功添加 ${count} 个包裹\n已存在则自动标记取件`
    );
    setLoading(false);
    setOcrResults([]);
    refreshWidget();
    router.navigate('/(tabs)');
  }, [ocrResults, router]);

  const handleSave = useCallback(() => {
    if (!pendingPkg) return;
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
        {/* ======== 家庭共享 ======== */}
        <View style={[styles.famSection, { marginTop: Spacing.xl }]}>
          <Text style={styles.famTitle}>👥 成员共享</Text>
          <Text style={styles.famDesc}>添加成员后，在包裹详情可分配取件</Text>
          <View style={styles.famRow}>
            {family.map(m => (
              <View key={m.id} style={[styles.famTag, { backgroundColor: m.color + '22', borderColor: m.color }]}>
                <Text style={[styles.famTagText, { color: m.color }]}>{m.name}</Text>
                <Pressable onPress={async () => { await removeMember(m.id); loadFamily(); }} hitSlop={8}>
                  <Text style={styles.famTagDel}>✕</Text>
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.famAddTag} onPress={() => setShowFamInput(!showFamInput)}>
              <Text style={styles.famAddText}>+ 添加</Text>
            </Pressable>
          </View>
          {showFamInput && (
            <View style={styles.famInputRow}>
              <TextInput style={styles.famInput} value={famName} onChangeText={setFamName} placeholder="姓名（如：小明）" placeholderTextColor={colors.textPlaceholder} onSubmitEditing={async () => { if (famName.trim()) { await addMember(famName.trim()); setFamName(''); setShowFamInput(false); loadFamily(); } }} />
              <Pressable style={[styles.famConfirmBtn, !famName.trim() && { opacity: 0.4 }]} onPress={async () => { if (famName.trim()) { await addMember(famName.trim()); setFamName(''); setShowFamInput(false); loadFamily(); } }} disabled={!famName.trim()}>
                <Text style={styles.famConfirmText}>确定</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  famSection: { padding: Spacing.lg, backgroundColor: colors.surface, borderRadius: BorderRadius.lg, marginHorizontal: Spacing.lg, ...Shadow.card },
  famTitle: { fontSize: FontSize.subhead, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  famDesc: { fontSize: FontSize.caption1, color: colors.textSecondary, marginBottom: Spacing.md },
  famRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  famTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.pill, borderWidth: 1 },
  famTagText: { fontSize: FontSize.footnote, fontWeight: '600', marginRight: 6 },
  famTagDel: { fontSize: FontSize.caption1, color: '#999' },
  famAddTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.pill, borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed' },
  famAddText: { fontSize: FontSize.footnote, color: colors.primary, fontWeight: '600' },
  famInputRow: { flexDirection: 'row', gap: 8, marginTop: Spacing.md },
  famInput: { flex: 1, backgroundColor: colors.secondarySurface, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.subhead, color: colors.textPrimary },
  famConfirmBtn: { backgroundColor: colors.primary, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.lg, justifyContent: 'center' },
  famConfirmText: { color: '#FFFFFF', fontSize: FontSize.subhead, fontWeight: '600' },
});
