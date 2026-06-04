// ============================================================
// 设置 · 地理围栏区
// ============================================================
import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { FontSize, Spacing } from '../../constants/theme';
import type { ColorScheme } from '../../constants/theme';
import type { GeofenceSettings } from '../../services/geofence-service';
import { SettingsCard } from './Card';
import { OptionPicker } from './OptionPicker';

interface Props {
  colors: ColorScheme;
  isDark: boolean;
  geoSettings: GeofenceSettings;
  onToggle: (enabled: boolean) => void;
  onSetRadius: (radius: number) => void;
  onSetCooldown: (mins: number) => void;
}

export function SettingsGeofenceCard({ colors, isDark, geoSettings, onToggle, onSetRadius, onSetCooldown }: Props) {
  return (
    <SettingsCard color="#34C759" colors={colors}>
      <View style={styles.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Text style={{ fontSize: 22, marginRight: Spacing.md }}>📍</Text>
          <View>
            <Text style={{ fontSize: FontSize.body, color: colors.textPrimary }}>靠近快递点提醒</Text>
            <Text style={{ fontSize: FontSize.footnote, color: colors.textSecondary }}>
              {geoSettings.enabled ? '已开启 — 靠近驿站自动汇总通知' : '已关闭'}
            </Text>
          </View>
        </View>
        <Switch
          value={geoSettings.enabled}
          onValueChange={onToggle}
          trackColor={{ false: isDark ? '#39393D' : '#E5E5EA', true: '#34C759' }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={isDark ? '#39393D' : '#E5E5EA'}
        />
      </View>

      <View style={[styles.sep, { backgroundColor: colors.separator }]} />
      <OptionPicker
        label="触发距离"
        options={[200, 500, 1000, 2000].map(d => ({ value: d, label: d >= 1000 ? `${d / 1000}km` : `${d}m` }))}
        value={geoSettings.radiusMeters}
        onChange={onSetRadius}
        colors={colors}
      />

      <View style={[styles.sep, { backgroundColor: colors.separator }]} />
      <OptionPicker
        label="通知冷却"
        options={[30, 60, 120, 240].map(d => ({ value: d, label: `${d}分钟` }))}
        value={geoSettings.cooldownMinutes}
        onChange={onSetCooldown}
        colors={colors}
      />

      <Text style={[styles.note, { color: colors.textTertiary }]}>
        需要授权位置权限。开启后每当进入快递点范围，{'\n'}自动汇总该点所有待取包裹并推送通知。
      </Text>
    </SettingsCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
  },
  sep: { height: 0.5, marginLeft: 56 },
  note: {
    fontSize: FontSize.caption1, textAlign: 'center',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, lineHeight: 18,
  },
});
