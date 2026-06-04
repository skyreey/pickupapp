// ============================================================
// 设置 · Pro/会员卡区
// ============================================================
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { FontSize, Spacing, BorderRadius } from '../../constants/theme';
import type { ColorScheme } from '../../constants/theme';
import type { Membership, MembershipTier } from '../../models';
import { VipBadge } from '../VipBadge';
import { SettingsCard } from './Card';
import { SettingsRow } from './Row';
import { PRICING, FREE_PACKAGE_LIMIT, getExpiryText } from '../../services/settings-store';

interface Props {
  colors: ColorScheme;
  isDark: boolean;
  pro: boolean;
  pkgCount: number;
  membership: Membership;
  openPricing: boolean;
  onTogglePricing: () => void;
}

export function SettingsProCard({ colors, isDark, pro, pkgCount, membership, openPricing, onTogglePricing }: Props) {
  const router = useRouter();

  if (pro && membership.tier) {
    return (
      <SettingsCard color="#FF6B35" colors={colors}>
        <View style={{ padding: Spacing.lg }}>
          <VipBadge tier={membership.tier} compact={false} />
          <Text style={[styles.memberText, { color: colors.textSecondary }]}>
            无限包裹
          </Text>
        </View>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard color="#FF6B35" colors={colors}>
      <Pressable style={styles.row} onPress={onTogglePricing}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.rowIcon}>📦</Text>
          <View>
            <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>免费版</Text>
            <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>
              已用 {pkgCount}/{FREE_PACKAGE_LIMIT} 个包裹 · 点击查看升级方案
            </Text>
          </View>
        </View>
        <Text style={[styles.chevron, openPricing && styles.chevronOpen]}>›</Text>
      </Pressable>

      {openPricing && (
        <>
          <View style={[styles.sep, { backgroundColor: colors.separator }]} />
          <View style={styles.pricingRow}>
            {([
              { label: '年付', key: 'yearly' as MembershipTier },
              { label: '月付', key: 'monthly' as MembershipTier },
              { label: '买断', key: 'lifetime' as MembershipTier },
            ]).map(({ label, key }) => {
              const p = PRICING[key];
              return (
                <Pressable
                  key={key}
                  style={[styles.pCard, { backgroundColor: colors.secondarySurface }, key === 'yearly' && styles.pCardActive]}
                  onPress={() => router.push('/pro/activate')}
                >
                  <Text style={[styles.pLabel, { color: colors.textSecondary }]}>{label}</Text>
                  <Text style={[styles.pPrice, { color: colors.textPrimary }]}>{p.price}</Text>
                  <Text style={[styles.pPeriod, { color: colors.textTertiary }]}>/{p.period}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.sep, { backgroundColor: colors.separator }]} />
          <Pressable
            style={[styles.upgradeBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/pro/activate')}
          >
            <Text style={styles.upgradeBtnText}>升级 Pro</Text>
          </Pressable>
          <Text style={[styles.note, { color: colors.textTertiary }]}>
            Pro 会员权益：无限包裹
          </Text>
        </>
      )}
    </SettingsCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
  },
  rowIcon: { fontSize: 22, marginRight: Spacing.md },
  rowTitle: { fontSize: FontSize.body },
  rowDesc: { fontSize: FontSize.footnote, marginTop: 1 },
  chevron: { fontSize: 20, color: '#8E8E93', fontWeight: '300' },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  sep: { height: 0.5, marginLeft: 56 },
  pricingRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
  pCard: {
    flex: 1, borderRadius: BorderRadius.md, paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs, alignItems: 'center', borderWidth: 2, borderColor: 'transparent',
  },
  pCardActive: { borderColor: '#007AFF', backgroundColor: '#007AFF12' },
  pLabel: { fontSize: FontSize.caption1, marginBottom: 2 },
  pPrice: { fontSize: FontSize.title3, fontWeight: '700' },
  pPeriod: { fontSize: FontSize.caption1 },
  upgradeBtn: { borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: 'center', marginHorizontal: Spacing.lg, marginBottom: Spacing.xs },
  upgradeBtnText: { fontSize: FontSize.subhead, fontWeight: '700', color: '#FFFFFF' },
  note: { fontSize: FontSize.caption1, textAlign: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, lineHeight: 18 },
  memberText: { fontSize: FontSize.footnote, textAlign: 'center', marginTop: Spacing.sm },
});
