// ============================================================
// iOS 风格权限引导组件
// ============================================================
import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking, ScrollView } from 'react-native';
import { FontSize, Spacing, BorderRadius, Shadow, useColors, createGlobalStyles } from '../constants/theme';
import type { ColorScheme } from '../constants/theme';

interface Props {
  type: 'sms' | 'notification' | 'widget' | 'background';
  granted?: boolean;
  onRequest?: () => void;
}

const GUIDES = {
  sms: {
    icon: '💬',
    title: '短信权限',
    desc: '自动读取快递取件码短信，无需手动输入',
    brands: [
      { name: '通用', steps: ['打开设置 → 应用 → 权限管理', '找到"取件通"', '开启"短信"权限'] },
      { name: '华为', steps: ['设置 → 应用 → 权限管理', '找到"取件通" → 权限', '打开"短信"开关'] },
      { name: '小米', steps: ['设置 → 应用设置 → 授权管理', '找到"取件通"', '允许"短信"权限'] },
    ],
  },
  notification: {
    icon: '🔔',
    title: '通知读取权限',
    desc: '自动获取淘宝/京东/拼多多等平台的发货通知，追踪包裹物流',
    brands: [
      { name: '通用', steps: ['设置 → 无障碍/特殊权限 → 通知使用权', '找到"取件通"', '打开开关'] },
      { name: '华为', steps: ['设置 → 应用 → 特殊访问权限 → 通知使用权', '找到"取件通"', '打开开关'] },
      { name: '小米', steps: ['手机管家 → 隐私保护 → 特殊权限 → 通知使用权', '找到"取件通"', '打开开关'] },
    ],
  },
  widget: {
    icon: '🧩',
    title: '桌面挂件',
    desc: '在桌面添加包裹追踪挂件，解锁手机就能看到最新取件码和物流状态',
    brands: [
      { name: '通用', steps: ['长按桌面空白处 → 添加挂件', '搜索"取件通"', '选择挂件尺寸并添加'] },
      { name: '华为', steps: ['双指捏合桌面 → 服务卡片 → 搜索"取件通"', '选择挂件 → 添加到桌面'] },
      { name: '小米', steps: ['长按桌面 → 添加工具 → 全部工具', '找到"取件通"挂件', '拖到桌面'] },
    ],
  },
  background: {
    icon: '🛡️',
    title: '后台保活设置',
    desc: '华为手机会自动清理后台应用。关闭电池优化并设为手动管理，确保包裹追踪不中断。',
    brands: [
      {
        name: '华为（必须操作）',
        steps: [
          '打开"手机管家"App',
          '点击"应用启动管理"',
          '找到"取件通"，关闭"自动管理"',
          '在弹出的选项中，全部打开（自启动 + 关联启动 + 后台活动）',
          '返回设置 → 应用 → 权限管理 → 特殊访问权限 → 电池优化',
          '找到"取件通" → 设为"不允许"',
        ],
      },
      {
        name: '荣耀',
        steps: [
          '手机管家 → 应用启动管理',
          '找到"取件通" → 关闭自动管理 → 手动管理全部开启',
          '设置 → 电池 → 电池优化 → 不允许',
        ],
      },
      {
        name: '通用',
        steps: [
          '系统设置 → 电池/电源 → 电池优化',
          '找到 App → 设为"不优化"',
          '如有关联网启动/自启动选项 → 全部开启',
        ],
      },
    ],
  },
};

export function PermissionGuide({ type, granted, onRequest }: Props) {
  const { colors } = useColors();
  const styles = createStyles(colors);
  const gStyles = createGlobalStyles(colors);
  const guide = GUIDES[type];
  const showPermStatus = type === 'sms' || type === 'notification';

  return (
    <View style={styles.container}>
      {/* 图标和标题 */}
      <View style={styles.header}>
        <Text style={styles.icon}>{guide.icon}</Text>
        <Text style={styles.title}>{guide.title}</Text>
        <Text style={styles.desc}>{guide.desc}</Text>

        {/* 权限状态 */}
        {showPermStatus && (
          <View style={[styles.statusBadge, granted ? styles.statusGranted : styles.statusDenied]}>
            <View style={[styles.statusDot, granted ? styles.dotGreen : styles.dotRed]} />
            <Text style={[styles.statusText, granted ? styles.statusTextGreen : styles.statusTextRed]}>
              {granted ? '已授权' : '未授权'}
            </Text>
          </View>
        )}
      </View>

      {/* 各品牌操作步骤 */}
      <ScrollView style={styles.stepsScroll} showsVerticalScrollIndicator={false}>
        {guide.brands.map((brand, i) => (
          <View key={i} style={styles.brandCard}>
            <Text style={styles.brandName}>{brand.name}</Text>
            {brand.steps.map((step, j) => (
              <View key={j} style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{j + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      {/* 操作按钮 */}
      {showPermStatus && !granted && onRequest ? (
        <View style={styles.actions}>
          <Pressable style={gStyles.button} onPress={onRequest}>
            <Text style={gStyles.buttonText}>
              {type === 'sms' ? '前往权限设置' : '前往开启通知使用权'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {!showPermStatus && (
        <View style={styles.actions}>
          <Pressable
            style={gStyles.button}
            onPress={() => Linking.openSettings()}
          >
            <Text style={gStyles.buttonText}>打开系统设置</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ColorScheme) => StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  icon: {
    fontSize: 56,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.title2,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  desc: {
    fontSize: FontSize.subhead,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.xl,
  },
  stepsScroll: {
    flex: 1,
  },
  brandCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Shadow.card,
  },
  brandName: {
    fontSize: FontSize.subhead,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: Spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    marginTop: 1,
  },
  stepNumText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepText: {
    flex: 1,
    fontSize: FontSize.subhead,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  actions: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.pill,
    marginTop: Spacing.md,
  },
  statusGranted: {
    backgroundColor: colors.statusGrantedBg,
  },
  statusDenied: {
    backgroundColor: colors.statusDeniedBg,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.xs,
  },
  dotGreen: { backgroundColor: colors.success },
  dotRed: { backgroundColor: colors.error },
  statusText: {
    fontSize: FontSize.footnote,
    fontWeight: '600',
  },
  statusTextGreen: { color: colors.success },
  statusTextRed: { color: colors.error },
});
