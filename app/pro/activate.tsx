// ============================================================
// Pro 激活 — 微信/支付宝扫码支付 → 自动激活
// ============================================================
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable,
  StyleSheet, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  FontSize, Spacing, BorderRadius, Shadow, useColors, createGlobalStyles,
} from '../../src/constants/theme';
import type { ColorScheme } from '../../src/constants/theme';
import { setIsPro } from '../../src/services/settings-store';
import { startPaymentMonitor, stopPaymentMonitor } from '../../src/services/payment-monitor';

// 收款账户（替换为你的真实账号）
const ALIPAY_ACCOUNT = '18352111943';
const WECHAT_ACCOUNT = '18352111943';

const TIERS = [
  { key: 'yearly', name: '年付', price: '¥29.90', amount: 29.90, desc: '最划算 · 每天不到1毛钱' },
  { key: 'monthly', name: '月付', price: '¥3.99', amount: 3.99, desc: '灵活续费' },
  { key: 'lifetime', name: '买断', price: '¥68.00', amount: 68.00, desc: '一次付费永久使用' },
];

export default function ActivateScreen() {
  const { colors } = useColors();
  const styles = createStyles(colors);
  const gStyles = createGlobalStyles(colors);
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState('yearly');
  const [payWaiting, setPayWaiting] = useState(false);
  const [activated, setActivated] = useState(false);

  useEffect(() => () => stopPaymentMonitor(), []);

  const handlePay = useCallback(() => {
    const tier = TIERS.find(t => t.key === selectedTier);
    if (!tier) return;
    setPayWaiting(true);
    startPaymentMonitor(tier.amount, () => {
      setPayWaiting(false);
      setActivated(true);
      setIsPro(true);
    });
  }, [selectedTier]);

  const handleCancel = useCallback(() => {
    stopPaymentMonitor();
    setPayWaiting(false);
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.pageTitle}>升级取件通 Pro</Text>
      <Text style={styles.pageSubtitle}>无限包裹 · 全家共享 · 数据导出 · 优先支持</Text>

      {activated ? (
        <View style={styles.payCard}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.activatedTitle}>激活成功！</Text>
          <Text style={styles.activatedDesc}>您已成为取件通 Pro 会员{'\n'}享受所有 Pro 权益</Text>
          <Pressable style={[gStyles.button, { marginTop: Spacing.xl, width: '100%' }]} onPress={() => router.back()}>
            <Text style={gStyles.buttonText}>返回</Text>
          </Pressable>
        </View>
      ) : payWaiting ? (
        <View style={styles.payCard}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.waitingTitle}>等待支付到账...</Text>
          <Text style={styles.waitingDesc}>
            请在微信或支付宝完成支付{'\n'}
            支付金额：{TIERS.find(t => t.key === selectedTier)?.price}{'\n\n'}
            支付成功后自动激活，无需手动操作
          </Text>
          <Pressable style={[gStyles.button, { marginTop: Spacing.lg, width: '100%', backgroundColor: colors.secondarySurface }]} onPress={handleCancel}>
            <Text style={[gStyles.buttonText, { color: colors.textSecondary }]}>取消</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* 方案选择 */}
          <Text style={styles.sectionLabel}>选择方案</Text>
          {TIERS.map(tier => (
            <Pressable
              key={tier.key}
              style={[styles.tierRow, selectedTier === tier.key && styles.tierRowActive]}
              onPress={() => setSelectedTier(tier.key)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.radio, selectedTier === tier.key && styles.radioOn]}>
                  {selectedTier === tier.key && <View style={styles.radioInner} />}
                </View>
                <View>
                  <Text style={styles.tierName}>{tier.name}</Text>
                  <Text style={styles.tierDesc}>{tier.desc}</Text>
                </View>
              </View>
              <Text style={styles.tierPrice}>{tier.price}</Text>
            </Pressable>
          ))}

          {/* 支付按钮 */}
          <Text style={styles.paySectionTitle}>
            支付 {TIERS.find(t => t.key === selectedTier)?.price}
          </Text>

          <Pressable
            style={[styles.payBtn, { backgroundColor: '#1677FF' }]}
            onPress={() => {
              handlePay();
              const url = `alipays://platformapi/startapp?appId=20000123&actionType=toAccount&account=${ALIPAY_ACCOUNT}&amount=${TIERS.find(t => t.key === selectedTier)?.amount || 0}`;
              Linking.openURL(url).catch(() => {
                Alert.alert('请安装支付宝', '将跳转支付宝转账页面');
              });
            }}
          >
            <Text style={styles.payBtnIcon}>💙</Text>
            <View>
              <Text style={styles.payBtnTitle}>支付宝支付</Text>
              <Text style={styles.payBtnSub}>跳转支付宝转账</Text>
            </View>
            <Text style={styles.payBtnArrow}>›</Text>
          </Pressable>

          <Pressable
            style={[styles.payBtn, styles.payBtnWx]}
            onPress={() => {
              handlePay();
              Linking.openURL('weixin://').catch(() => {
                Alert.alert('请安装微信', '打开微信后向下方账户转账');
              });
            }}
          >
            <Text style={styles.payBtnIcon}>💚</Text>
            <View>
              <Text style={styles.payBtnTitle}>微信支付</Text>
              <Text style={styles.payBtnSub}>打开微信转账</Text>
            </View>
            <Text style={styles.payBtnArrow}>›</Text>
          </Pressable>

          <Text style={styles.hint}>
            点击上方按钮跳转支付 → 完成转账后{'\n'}系统自动检测付款 → 即时激活 Pro
          </Text>
        </>
      )}
    </ScrollView>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
    pageTitle: { fontSize: FontSize.title1, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginTop: Spacing.xl },
    pageSubtitle: { fontSize: FontSize.subhead, color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.xs, marginBottom: Spacing.xl },
    sectionLabel: { fontSize: FontSize.subhead, fontWeight: '600', color: colors.textSecondary, marginBottom: Spacing.sm },
    // 方案选择
    tierRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 2, borderColor: colors.separator, marginBottom: Spacing.sm },
    tierRowActive: { borderColor: colors.primary, backgroundColor: colors.primary + '06' },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.separator, justifyContent: 'center', alignItems: 'center' },
    radioOn: { borderColor: colors.primary },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    tierName: { fontSize: FontSize.subhead, fontWeight: '700', color: colors.textPrimary },
    tierPrice: { fontSize: FontSize.title2, fontWeight: '800', color: colors.textPrimary },
    tierDesc: { fontSize: FontSize.caption1, color: colors.textTertiary, marginTop: 1 },
    // 支付按钮
    paySectionTitle: { fontSize: FontSize.footnote, fontWeight: '600', color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.xl, marginBottom: Spacing.lg },
    payBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.lg, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm },
    payBtnWx: { backgroundColor: '#07C160' },
    payBtnIcon: { fontSize: 28, marginRight: Spacing.md },
    payBtnTitle: { fontSize: FontSize.body, fontWeight: '700', color: '#FFFFFF' },
    payBtnSub: { fontSize: FontSize.caption1, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
    payBtnArrow: { fontSize: 22, color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' },
    // 账户信息
    accountBox: { backgroundColor: colors.secondarySurface, borderRadius: BorderRadius.md, padding: Spacing.lg, marginTop: Spacing.lg },
    accountLabel: { fontSize: FontSize.caption1, fontWeight: '600', color: colors.textSecondary, marginBottom: Spacing.xs },
    accountText: { fontSize: FontSize.footnote, color: colors.textPrimary, lineHeight: 22, fontFamily: 'monospace' },
    // 提示
    hint: { fontSize: FontSize.caption1, color: colors.textTertiary, textAlign: 'center', lineHeight: 20, marginTop: Spacing.lg },
    // 等待
    payCard: { backgroundColor: colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center', marginTop: Spacing.lg, ...Shadow.card },
    waitingTitle: { fontSize: FontSize.body, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginTop: Spacing.xl },
    waitingDesc: { fontSize: FontSize.footnote, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: Spacing.md },
    // 激活成功
    emoji: { fontSize: 64, marginBottom: Spacing.sm },
    activatedTitle: { fontSize: FontSize.title2, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
    activatedDesc: { fontSize: FontSize.footnote, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: Spacing.sm },
  });
}
