// ============================================================
// BatchCodeSheet — 取件码大字一览面板
//
// 场景：用户站在驿站前，多个包裹在同一站点。
// 打开面板 → 所有取件码大字显示 → 直接给工作人员看。
// ============================================================
import React, { useState, useCallback } from 'react';
import {
  View, Text, Modal, Pressable, ScrollView, StyleSheet, Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { FontSize, Spacing, BorderRadius, Shadow, useColors } from '../constants/theme';
import type { ColorScheme } from '../constants/theme';
import type { Package } from '../models';
import { batchMarkAsPickedUp } from '../database/dao';

interface GroupInfo {
  name: string;
  address: string;
  packages: Package[];
}

interface Props {
  visible: boolean;
  group: GroupInfo | null;
  onClose: () => void;
  onMarkedAll: () => void;
}

export function BatchCodeSheet({ visible, group, onClose, onMarkedAll }: Props) {
  const { colors } = useColors();
  const styles = createStyles(colors);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = useCallback(async (code: string, index: number) => {
    if (!code) return;
    try {
      await Clipboard.setStringAsync(code);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {}
  }, []);

  const handleMarkAll = useCallback(() => {
    if (!group) return;
    Alert.alert(
      '全部已取件',
      `确定将「${group.name}」的 ${group.packages.length} 个包裹全部标记为已取件？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: () => {
            batchMarkAsPickedUp(group.packages.map(p => p.id));
            onMarkedAll();
            onClose();
          },
        },
      ],
    );
  }, [group, onMarkedAll, onClose]);

  if (!group) return null;

  const codesWithIndex = group.packages.map((p, i) => ({
    index: i,
    code: p.pickupCode || null,
    trackingNumber: p.trackingNumber || '',
    carrierName: p.carrierName || '',
    productName: p.productName || '',
  }));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          {/* 顶部手柄 */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.separator }]} />
          </View>

          {/* 标题区 */}
          <Text style={[styles.title, { color: colors.textPrimary }]}>{group.name}</Text>
          {group.address ? (
            <Text style={[styles.address, { color: colors.textSecondary }]}>{group.address}</Text>
          ) : null}
          <Text style={[styles.count, { color: colors.textTertiary }]}>
            共 {group.packages.length} 个包裹
          </Text>

          {/* 取件码大字区 */}
          <ScrollView style={styles.codeList} showsVerticalScrollIndicator={false}>
            {codesWithIndex.map(({ index, code, trackingNumber, carrierName, productName }) => (
              <Pressable
                key={index}
                style={[styles.codeCard, { backgroundColor: colors.secondarySurface }]}
                onPress={() => handleCopy((code || trackingNumber), index)}
                accessibilityLabel={`${code ? '取件码' : '单号'} ${code || trackingNumber}，${carrierName}，双击复制`}
                accessibilityRole="button"
              >
                <View style={styles.codeHeader}>
                  <Text style={[styles.carrierTag, { color: colors.primary }]}>
                    {carrierName || '快递'}
                  </Text>
                  {copiedIndex === index && (
                    <Text style={[styles.copiedTag, { color: '#34C759' }]}>✓ 已复制</Text>
                  )}
                </View>
                <Text style={styles.codeText}>
                  {code || `单号: ${trackingNumber}` || '暂无信息'}
                </Text>
                {productName ? (
                  <Text style={[styles.productText, { color: colors.textSecondary }]} numberOfLines={1}>
                    {productName}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>

          {/* 底部按钮 */}
          <View style={styles.bottomRow}>
            <Pressable
              style={[styles.markAllBtn, { backgroundColor: colors.success }]}
              onPress={handleMarkAll}
            >
              <Text style={styles.markAllBtnText}>✓ 全部已取件</Text>
            </Pressable>
            <Pressable
              style={[styles.closeBtn, { backgroundColor: colors.secondarySurface }]}
              onPress={onClose}
            >
              <Text style={[styles.closeBtnText, { color: colors.textPrimary }]}>关闭</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    sheet: {
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      paddingBottom: Spacing.xxl,
      maxHeight: '80%',
      ...Shadow.medium,
    },
    handleRow: { alignItems: 'center', paddingVertical: Spacing.sm },
    handle: { width: 36, height: 5, borderRadius: 3 },
    title: {
      fontSize: FontSize.title2, fontWeight: '700',
      textAlign: 'center', marginTop: Spacing.sm, paddingHorizontal: Spacing.xl,
    },
    address: {
      fontSize: FontSize.footnote, textAlign: 'center',
      marginTop: Spacing.xs, paddingHorizontal: Spacing.xl,
    },
    count: {
      fontSize: FontSize.caption1, textAlign: 'center',
      marginTop: Spacing.xs, marginBottom: Spacing.lg,
    },
    codeList: { flexGrow: 0, paddingHorizontal: Spacing.lg },
    codeCard: {
      borderRadius: BorderRadius.lg, padding: Spacing.lg,
      marginBottom: Spacing.md,
    },
    codeHeader: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: Spacing.sm,
    },
    carrierTag: { fontSize: FontSize.caption1, fontWeight: '600' },
    copiedTag: { fontSize: FontSize.caption1, fontWeight: '700' },
    codeText: {
      fontSize: 36, fontWeight: '800', color: '#1C1C1E',
      fontFamily: 'monospace', letterSpacing: 3, textAlign: 'center',
      paddingVertical: Spacing.sm,
    },
    productText: { fontSize: FontSize.footnote, marginTop: Spacing.xs },
    bottomRow: {
      flexDirection: 'row', gap: Spacing.md,
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg,
    },
    markAllBtn: {
      flex: 1, borderRadius: BorderRadius.md,
      paddingVertical: Spacing.md, alignItems: 'center',
    },
    markAllBtnText: { fontSize: FontSize.subhead, fontWeight: '700', color: '#FFFFFF' },
    closeBtn: {
      flex: 1, borderRadius: BorderRadius.md,
      paddingVertical: Spacing.md, alignItems: 'center',
    },
    closeBtnText: { fontSize: FontSize.subhead, fontWeight: '600' },
  });
}
