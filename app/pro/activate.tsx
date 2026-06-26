// ============================================================
// Pro 激活页 — 支付转账 + 激活码 双通道
// 支持：月度VIP / 年度VIP / 永久VIP
// ============================================================
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  FontSize, Spacing, BorderRadius, Shadow, useColors, createGlobalStyles,
} from '../../src/constants/theme';
import type { ColorScheme } from '../../src/constants/theme';
import type { MembershipTier } from '../../src/models';
import {
  activateMembership, forceActivateMembership, getMembership, getExpiryText, getTierName, getTierNameFor,
} from '../../src/services/settings-store';
import { startPaymentMonitor, stopPaymentMonitor } from '../../src/services/payment-monitor';
import { verifyActivationCode, getRemainingAttempts } from '../../src/services/pro-activation';
import { clearHealthCache } from '../../src/services/remote-activation';
import { VipBadge } from '../../src/components/VipBadge';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

// 收款账户
const ALIPAY_ACCOUNT = '18352111943';
const WECHAT_ACCOUNT = '18352111943';
const CUSTOMER_WECHAT = 'skyreey';

const TIERS: Array<{
  key: MembershipTier; name: string; price: string; amount: number;
  desc: string; periodLabel: string;
}> = [
  { key: 'yearly', name: '年度VIP', price: '¥29.90', amount: 29.90, desc: '最划算 · 每天不到1毛钱', periodLabel: '年' },
  { key: 'monthly', name: '月度VIP', price: '¥3.99', amount: 3.99, desc: '灵活续费', periodLabel: '月' },
  { key: 'lifetime', name: '永久VIP', price: '¥68.00', amount: 68.00, desc: '一次付费永久使用', periodLabel: '永久' },
];

export default function ActivateScreen() {
  const { colors } = useColors();
  const styles = createStyles(colors);
  const gStyles = createGlobalStyles(colors);
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState<MembershipTier>('yearly');
  const [payWaiting, setPayWaiting] = useState(false);
  const [activated, setActivated] = useState(false);
  const [activatedTier, setActivatedTier] = useState<MembershipTier | null>(null);
  // 激活码模式
  const [codeMode, setCodeMode] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeVerifying, setCodeVerifying] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState(5);

  useEffect(() => { getRemainingAttempts().then(setRemainingAttempts); return () => stopPaymentMonitor(); }, []);

  // ========== 通用激活处理 ==========
  const handleActivateResult = useCallback(async (
    tier: MembershipTier,
    method: 'alipay' | 'wechat' | 'code',
    code: string | null = null,
  ) => {
    const result = await activateMembership(tier, method, code);

    if (result.success) {
      setPayWaiting(false);
      setActivatedTier(tier);
      setActivated(true);
      return;
    }

    if (result.reason === 'downgrade') {
      const curName = getTierNameFor(result.currentTier!);
      const targetName = getTierNameFor(result.targetTier!);
      Alert.alert(
        '无法降级',
        `您当前已是【${curName}】，不能降级为【${targetName}】。`,
        [{ text: '知道了', style: 'default' }],
      );
      setPayWaiting(false);
      stopPaymentMonitor();
      return;
    }

    if (result.reason === 'same_tier') {
      const curName = getTierNameFor(result.currentTier!);
      Alert.alert(
        '续费确认',
        `您当前已是【${curName}】，是否续费叠加时长？\n\n续费后到期时间将延长。`,
        [
          { text: '取消', style: 'cancel', onPress: () => { setPayWaiting(false); stopPaymentMonitor(); } },
          {
            text: '确认续费',
            onPress: async () => {
              const forceResult = await forceActivateMembership(tier, method, code);
              if (forceResult.success) {
                setPayWaiting(false);
                setActivatedTier(tier);
                setActivated(true);
              }
            },
          },
        ],
      );
      return;
    }
  }, []);

  // ========== 支付通道 ==========
  const handlePay = useCallback((tierKey: MembershipTier) => {
    const tier = TIERS.find(t => t.key === tierKey);
    if (!tier) return;
    setPayWaiting(true);
    startPaymentMonitor(tier.amount, () => {
      handleActivateResult(tierKey, 'alipay');
    });
  }, [handleActivateResult]);

  const handlePayAlipay = useCallback(() => {
    const tier = TIERS.find(t => t.key === selectedTier);
    handlePay(selectedTier);
    const url = `alipays://platformapi/startapp?appId=20000123&actionType=toAccount&account=${ALIPAY_ACCOUNT}&amount=${tier?.amount || 0}`;
    Linking.openURL(url).catch(() => Alert.alert('请安装支付宝', '将跳转支付宝转账页面'));
  }, [selectedTier, handlePay]);

  const handlePayWechat = useCallback(() => {
    handlePay(selectedTier);
    Linking.openURL('weixin://').catch(() => Alert.alert('请安装微信', '打开微信后向下方账户转账'));
  }, [selectedTier, handlePay]);

  const handleCancel = useCallback(() => {
    stopPaymentMonitor();
    setPayWaiting(false);
  }, []);

  // ========== 激活码通道 ==========
  const handleCodeVerify = useCallback(async () => {
    if (!codeInput.trim()) {
      setCodeError('请输入激活码');
      return;
    }
    setCodeVerifying(true);
    setCodeError('');
    try {
      const code = codeInput.trim().toUpperCase();

      // 本地验证（云服务未部署，跳过远程验证）
      const tier = await verifyActivationCode(code);
      if (tier) {
        await handleActivateResult(tier, 'code', code);
      } else {
        setCodeError('激活码无效，请检查后重试');
      }
    } catch {
      setCodeError('验证失败，请稍后重试');
    }
    setCodeVerifying(false);
    getRemainingAttempts().then(setRemainingAttempts);
  }, [codeInput, handleActivateResult]);

  // ========== 已经激活 → 显示当前状态 ==========
  const currentMembership = getMembership();
  if (currentMembership.active && !activated) {
    return (
      <ErrorBoundary>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.pageTitle}>取件通 Pro</Text>
        <Text style={styles.pageSubtitle}>您已是会员，享受所有 Pro 权益</Text>
        {currentMembership.tier && (
          <View style={{ marginTop: Spacing.lg }}>
            <VipBadge tier={currentMembership.tier} compact={false} />
          </View>
        )}
        <Pressable style={[gStyles.button, { marginTop: Spacing.xl }]} onPress={() => router.back()}>
          <Text style={gStyles.buttonText}>返回</Text>
        </Pressable>
      </ScrollView>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.pageTitle}>升级取件通 Pro</Text>
      <Text style={styles.pageSubtitle}>无限包裹</Text>

      {/* ======== 激活成功 ======== */}
      {activated && activatedTier ? (
        <View style={styles.successCard}>
          <Text style={styles.successEmoji}>🎉</Text>
          <Text style={styles.successTitle}>激活成功！</Text>
          <View style={{ marginVertical: Spacing.md, alignSelf: 'stretch' }}>
            <VipBadge tier={activatedTier} compact={false} />
          </View>
          <Text style={styles.successDesc}>
            您已成为取件通 {getTierName()} 会员{'\n'}
            {getExpiryText()}
          </Text>
          <Pressable style={[gStyles.button, { marginTop: Spacing.xl, width: '100%' }]} onPress={() => router.back()}>
            <Text style={gStyles.buttonText}>返回</Text>
          </Pressable>
        </View>
      ) : payWaiting ? (
        /* ======== 等待支付 ======== */
        <View style={styles.payCard}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.waitingTitle}>等待支付到账...</Text>
          <Text style={styles.waitingDesc}>
            请在支付App完成转账{'\n'}
            支付金额：{TIERS.find(t => t.key === selectedTier)?.price}{'\n\n'}
            支付完成后，截图发送给客服微信{'\n'}
            {CUSTOMER_WECHAT}，即可获得激活码
          </Text>
          <Pressable style={[gStyles.button, { marginTop: Spacing.lg, width: '100%', backgroundColor: colors.secondarySurface }]} onPress={handleCancel}>
            <Text style={[gStyles.buttonText, { color: colors.textSecondary }]}>取消</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* ======== 通道切换 ======== */}
          <View style={styles.modeSwitch}>
            <Pressable
              style={[styles.modeTab, !codeMode && styles.modeTabActive]}
              onPress={() => { setCodeMode(false); setCodeError(''); }}
            >
              <Text style={[styles.modeTabText, !codeMode && styles.modeTabTextActive]}>💰 在线支付</Text>
            </Pressable>
            <Pressable
              style={[styles.modeTab, codeMode && styles.modeTabActive]}
              onPress={() => { setCodeMode(true); setCodeError(''); }}
            >
              <Text style={[styles.modeTabText, codeMode && styles.modeTabTextActive]}>🔑 激活码</Text>
            </Pressable>
          </View>

          {codeMode ? (
            /* ======== 激活码模式 ======== */
            <View style={styles.codeSection}>
              <Text style={styles.sectionLabel}>输入激活码</Text>
              <TextInput
                style={styles.codeInput}
                value={codeInput}
                onChangeText={(t) => { setCodeInput(t.toUpperCase()); setCodeError(''); }}
                placeholder="PICKUP-PY-XXXX-XXXX-XXXX"
                placeholderTextColor={colors.textPlaceholder}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={32}
              />
              {codeError ? (
                <Text style={styles.codeError}>{codeError}</Text>
              ) : null}
              <Pressable
                style={[gStyles.button, { marginTop: Spacing.md, opacity: codeVerifying ? 0.5 : 1 }]}
                onPress={handleCodeVerify}
                disabled={codeVerifying}
              >
                <Text style={gStyles.buttonText}>
                  {codeVerifying ? '验证中...' : '验证激活码'}
                </Text>
              </Pressable>
              <Text style={[styles.codeHint, { marginTop: Spacing.sm, color: colors.textTertiary }]}>
                今日剩余尝试：{remainingAttempts} 次
              </Text>
              <Text style={styles.codeHint}>
                激活码可通过以下方式获取：{'\n'}
{`· 联系客服购买（微信：${CUSTOMER_WECHAT}）{'\n'}`}
                · 参与内测活动免费领取{'\n'}
                · 支付后截图发送客服获取
              </Text>
            </View>
          ) : (
            <>
              {/* ======== 方案选择 ======== */}
              <Text style={styles.sectionLabel}>选择方案</Text>
              {TIERS.map(tier => {
                const active = selectedTier === tier.key;
                return (
                  <Pressable
                    key={tier.key}
                    style={[styles.tierRow, active && styles.tierRowActive]}
                    onPress={() => setSelectedTier(tier.key)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.radio, active && styles.radioOn]}>
                        {active && <View style={styles.radioInner} />}
                      </View>
                      <View>
                        <Text style={styles.tierName}>{tier.name}</Text>
                        <Text style={styles.tierDesc}>{tier.desc}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.tierPrice}>{tier.price}</Text>
                      <Text style={styles.tierPeriod}>/{tier.periodLabel}</Text>
                    </View>
                  </Pressable>
                );
              })}

              {/* ======== 支付按钮 ======== */}
              <Text style={styles.paySectionTitle}>
                支付 {TIERS.find(t => t.key === selectedTier)?.price}
              </Text>

              <Pressable style={[styles.payBtn, { backgroundColor: '#1677FF' }]} onPress={handlePayAlipay}>
                <Text style={styles.payBtnIcon}>💙</Text>
                <View><Text style={styles.payBtnTitle}>支付宝支付</Text><Text style={styles.payBtnSub}>跳转支付宝转账</Text></View>
                <Text style={styles.payBtnArrow}>›</Text>
              </Pressable>

              <Pressable style={[styles.payBtn, styles.payBtnWx]} onPress={handlePayWechat}>
                <Text style={styles.payBtnIcon}>💚</Text>
                <View><Text style={styles.payBtnTitle}>微信支付</Text><Text style={styles.payBtnSub}>打开微信转账</Text></View>
                <Text style={styles.payBtnArrow}>›</Text>
              </Pressable>

              <Text style={styles.hint}>
                转账后截图发送客服微信 {CUSTOMER_WECHAT}{'\n'}客服发送激活码 → 在App输入激活码完成开通
              </Text>
            </>
          )}
        </>
      )}
    </ScrollView>
    </ErrorBoundary>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
    pageTitle: { fontSize: FontSize.title1, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginTop: Spacing.xl },
    pageSubtitle: { fontSize: FontSize.subhead, color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.xs, marginBottom: Spacing.xl },
    // 通道切换
    modeSwitch: { flexDirection: 'row', backgroundColor: colors.secondarySurface, borderRadius: BorderRadius.md, padding: 3, marginBottom: Spacing.lg },
    modeTab: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, alignItems: 'center' },
    modeTabActive: { backgroundColor: colors.surface, ...Shadow.card },
    modeTabText: { fontSize: FontSize.subhead, fontWeight: '600', color: colors.textSecondary },
    modeTabTextActive: { color: colors.textPrimary },
    // 方案选择
    sectionLabel: { fontSize: FontSize.subhead, fontWeight: '600', color: colors.textSecondary, marginBottom: Spacing.sm },
    tierRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 2, borderColor: colors.separator, marginBottom: Spacing.sm },
    tierRowActive: { borderColor: colors.primary, backgroundColor: colors.primary + '06' },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.separator, justifyContent: 'center', alignItems: 'center' },
    radioOn: { borderColor: colors.primary },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    tierName: { fontSize: FontSize.subhead, fontWeight: '700', color: colors.textPrimary },
    tierPrice: { fontSize: FontSize.title2, fontWeight: '800', color: colors.textPrimary },
    tierPeriod: { fontSize: FontSize.caption1, color: colors.textTertiary },
    tierDesc: { fontSize: FontSize.caption1, color: colors.textTertiary, marginTop: 1 },
    // 支付按钮
    paySectionTitle: { fontSize: FontSize.footnote, fontWeight: '600', color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.xl, marginBottom: Spacing.lg },
    payBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.lg, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm },
    payBtnWx: { backgroundColor: '#07C160' },
    payBtnIcon: { fontSize: 28, marginRight: Spacing.md },
    payBtnTitle: { fontSize: FontSize.body, fontWeight: '700', color: '#FFFFFF' },
    payBtnSub: { fontSize: FontSize.caption1, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
    payBtnArrow: { fontSize: 22, color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' },
    hint: { fontSize: FontSize.caption1, color: colors.textTertiary, textAlign: 'center', lineHeight: 20, marginTop: Spacing.lg },
    // 等待
    payCard: { backgroundColor: colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center', marginTop: Spacing.lg, ...Shadow.card },
    waitingTitle: { fontSize: FontSize.body, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginTop: Spacing.xl },
    waitingDesc: { fontSize: FontSize.footnote, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: Spacing.md },
    // 激活成功
    successCard: { backgroundColor: colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center', marginTop: Spacing.lg, ...Shadow.card },
    successEmoji: { fontSize: 64, marginBottom: Spacing.sm },
    successTitle: { fontSize: FontSize.title2, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
    successDesc: { fontSize: FontSize.footnote, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: Spacing.sm },
    // 激活码
    codeSection: { backgroundColor: colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.xl, ...Shadow.card, marginTop: Spacing.sm },
    codeInput: { backgroundColor: colors.secondarySurface, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, fontSize: FontSize.title3, color: colors.textPrimary, textAlign: 'center', letterSpacing: 2, fontFamily: 'monospace' },
    codeError: { fontSize: FontSize.footnote, color: colors.error, textAlign: 'center', marginTop: Spacing.sm },
    codeHint: { fontSize: FontSize.caption1, color: colors.textTertiary, textAlign: 'center', lineHeight: 18, marginTop: Spacing.lg },
  });
}
