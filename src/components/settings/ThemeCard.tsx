// ============================================================
// 设置 · 主题设置区
// ============================================================
import React from 'react';
import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import { FontSize, Spacing, BorderRadius } from '../../constants/theme';
import type { ColorScheme } from '../../constants/theme';
import { SettingsCard } from './Card';

type ThemeMode = 'light' | 'dark' | 'system';

interface Props {
  colors: ColorScheme;
  themeMode: ThemeMode;
  themeAccent: string;
  onSetThemeMode: (mode: ThemeMode) => void;
  onSetThemeAccent: (accent: any) => void;
  largeFontMode?: boolean;
  onToggleLargeFont?: (enabled: boolean) => void;
}

const ACCENTS = [
  { v: 'blue', c: '#007AFF' },
  { v: 'green', c: '#34C759' },
  { v: 'red', c: '#FF3B30' },
  { v: 'orange', c: '#FF9500' },
  { v: 'purple', c: '#AF52DE' },
  { v: 'pink', c: '#FF2D55' },
];

export function SettingsThemeCard({ colors, themeMode, themeAccent, onSetThemeMode, onSetThemeAccent, largeFontMode, onToggleLargeFont }: Props) {
  return (
    <SettingsCard color="#AF52DE" colors={colors}>
      {/* 主题模式 */}
      <View style={styles.pickWrap}>
        <Text style={[styles.pickLabel, { color: colors.textPrimary }]}>主题模式</Text>
        <View style={styles.pickOpts}>
          {([
            { v: 'light', l: '浅色' },
            { v: 'dark', l: '深色' },
            { v: 'system', l: '跟随系统' },
          ] as Array<{ v: ThemeMode; l: string }>).map(o => (
            <Pressable
              key={o.v}
              style={[styles.pickOpt, { backgroundColor: themeMode === o.v ? colors.primary : colors.secondarySurface }]}
              onPress={() => onSetThemeMode(o.v)}
            >
              <Text style={[styles.pickText, { color: themeMode === o.v ? '#FFFFFF' : colors.textSecondary }]}>{o.l}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[styles.sep, { backgroundColor: colors.separator }]} />

      {/* 大字模式 */}
      <View style={styles.pickWrap}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.pickLabel, { color: colors.textPrimary }]}>大字模式</Text>
          <Switch
            value={largeFontMode || false}
            onValueChange={(v) => onToggleLargeFont?.(v)}
            trackColor={{ false: '#E5E5EA', true: '#34C759' }}
            thumbColor="#FFFFFF"
          />
        </View>
        <Text style={[styles.pickDesc, { color: colors.textTertiary }]}>
          放大所有文字，方便老年人使用
        </Text>
      </View>

      <View style={[styles.sep, { backgroundColor: colors.separator }]} />

      {/* 强调色 */}
      <View style={styles.pickWrap}>
        <Text style={[styles.pickLabel, { color: colors.textPrimary }]}>强调色</Text>
        <View style={styles.accentRow}>
          {ACCENTS.map(a => (
            <Pressable
              key={a.v}
              style={[styles.accentDot, { backgroundColor: a.c }, themeAccent === a.v && styles.accentDotOn]}
              onPress={() => onSetThemeAccent(a.v)}
            />
          ))}
        </View>
      </View>
    </SettingsCard>
  );
}

const styles = StyleSheet.create({
  pickWrap: { padding: Spacing.lg },
  pickLabel: { fontSize: FontSize.subhead, fontWeight: '600', marginBottom: Spacing.sm },
  pickDesc: { fontSize: FontSize.caption1, marginTop: Spacing.xs },
  pickOpts: { flexDirection: 'row', gap: 8 },
  pickOpt: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, alignItems: 'center' },
  pickText: { fontSize: FontSize.footnote, fontWeight: '600' },
  sep: { height: 0.5, marginLeft: 56 },
  accentRow: { flexDirection: 'row', gap: 12, marginTop: Spacing.sm },
  accentDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  accentDotOn: { borderColor: '#000', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
});
