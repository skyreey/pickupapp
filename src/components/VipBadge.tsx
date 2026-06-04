// ============================================================
// VipBadge — 龙纹金色会员徽章
// 三种样式：月度VIP（银龙） / 年度VIP（金龙） / 永久VIP（暗金龙）
// ============================================================
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { MembershipTier } from '../models';
import { getRemainingDays, getExpiryText } from '../services/settings-store';
import { FontSize, BorderRadius } from '../constants/theme';

interface VipBadgeProps {
  tier: MembershipTier;
  compact?: boolean;    // 紧凑模式（用于列表项）
  showExpiry?: boolean;  // 是否显示到期时间
}

// 等级金色配置
const TIER_STYLES: Record<MembershipTier, {
  bg: string;           // 背景渐变主色
  bgLight: string;      // 背景浅色
  border: string;       // 边框色
  text: string;         // 文字色
  glow: string;         // 光晕色
  icon: string;         // 龙纹emoji
  label: string;        // 标签
}> = {
  monthly: {
    bg: '#C9A84C',
    bgLight: '#FBF3D5',
    border: '#B8942E',
    text: '#8B6914',
    glow: '#E8D27C',
    icon: '🐉',
    label: '月度VIP',
  },
  yearly: {
    bg: '#D4AF37',
    bgLight: '#FFF8E7',
    border: '#B8860B',
    text: '#7B5800',
    glow: '#FFD700',
    icon: '🐲',
    label: '年度VIP',
  },
  lifetime: {
    bg: '#1A1A1A',
    bgLight: '#F5E6CC',
    border: '#D4AF37',
    text: '#D4AF37',
    glow: '#B8860B',
    icon: '👑',
    label: '永久VIP',
  },
};

export function VipBadge({ tier, compact = false, showExpiry = true }: VipBadgeProps) {
  const s = TIER_STYLES[tier];
  const remaining = getRemainingDays();
  const expiryText = getExpiryText();

  if (compact) {
    return (
      <View style={[
        compactStyles.wrapper,
        { backgroundColor: s.bgLight, borderColor: s.border },
      ]}>
        <Text style={[compactStyles.icon]}>{s.icon}</Text>
        <Text style={[compactStyles.label, { color: s.text }]}>{s.label}</Text>
        {showExpiry && remaining > 0 && remaining <= 30 && (
          <Text style={[compactStyles.remaining, { color: s.text }]}>
            {remaining}天
          </Text>
        )}
        {showExpiry && tier === 'lifetime' && (
          <Text style={[compactStyles.remaining, { color: s.text }]}>∞</Text>
        )}
      </View>
    );
  }

  return (
    <View style={[
      styles.wrapper,
      {
        backgroundColor: s.bgLight,
        borderColor: s.border,
        shadowColor: s.glow,
      },
    ]}>
      {/* 顶部龙纹装饰 */}
      <View style={[styles.topBar, { backgroundColor: s.bg }]}>
        <Text style={styles.topBarIcon}>{s.icon}{s.icon}{s.icon}</Text>
      </View>

      {/* 主体 */}
      <View style={styles.body}>
        {/* 大龙纹 */}
        <View style={[styles.dragonSeal, { borderColor: s.border }]}>
          <Text style={styles.dragonEmoji}>{s.icon}</Text>
        </View>

        {/* 文字 */}
        <Text style={[styles.tierName, { color: s.text }]}>{s.label}</Text>

        {showExpiry && (
          <View style={[styles.expiryRow, { backgroundColor: s.bg + '20' }]}>
            <Text style={[styles.expiryDot, { color: s.border }]}>⏱</Text>
            <Text style={[styles.expiryText, { color: s.text }]}>
              {expiryText}
            </Text>
          </View>
        )}

        {/* 底部装饰线 */}
        <View style={[styles.bottomLine, { backgroundColor: s.border }]} />
        <Text style={[styles.motto, { color: s.text + '80' }]}>VIP MEMBER</Text>
      </View>
    </View>
  );
}

// ========== 完整版样式 ==========
const styles = StyleSheet.create({
  wrapper: {
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  topBar: {
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarIcon: {
    fontSize: 12,
    letterSpacing: 4,
  },
  body: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  dragonSeal: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    backgroundColor: '#FFF',
  },
  dragonEmoji: {
    fontSize: 32,
  },
  tierName: {
    fontSize: FontSize.title3,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: BorderRadius.pill,
    gap: 6,
  },
  expiryDot: {
    fontSize: 14,
  },
  expiryText: {
    fontSize: FontSize.footnote,
    fontWeight: '600',
  },
  bottomLine: {
    height: 1,
    width: 40,
    marginTop: 12,
    marginBottom: 6,
  },
  motto: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 4,
  },
});

// ========== 紧凑版样式 ==========
const compactStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: 3,
  },
  icon: {
    fontSize: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  remaining: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
});
