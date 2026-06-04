// ============================================================
// 设置 · 取件提醒区
// ============================================================
import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { FontSize, Spacing } from '../../constants/theme';
import type { ColorScheme } from '../../constants/theme';
import { SettingsCard } from './Card';
import { OptionPicker } from './OptionPicker';

interface Props {
  colors: ColorScheme;
  isDark: boolean;
  schedulerEnabled: boolean;
  reminderDays: number;
  autoPickupDays: number;
  onToggleScheduler: (on: boolean) => void;
  onSetReminderDays: (days: number) => void;
  onSetAutoPickupDays: (days: number) => void;
}

export function SettingsReminderCard({
  colors, isDark, schedulerEnabled,
  reminderDays, autoPickupDays,
  onToggleScheduler, onSetReminderDays, onSetAutoPickupDays,
}: Props) {
  return (
    <SettingsCard color="#FF9500" colors={colors}>
      <View style={styles.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Text style={{ fontSize: 22, marginRight: Spacing.md }}>⏰</Text>
          <View>
            <Text style={{ fontSize: FontSize.body, color: colors.textPrimary }}>提醒调度</Text>
            <Text style={{ fontSize: FontSize.footnote, color: colors.textSecondary }}>
              {schedulerEnabled ? '已开启' : '已关闭'}
            </Text>
          </View>
        </View>
        <Switch
          value={schedulerEnabled}
          onValueChange={onToggleScheduler}
          trackColor={{ false: isDark ? '#39393D' : '#E5E5EA', true: '#34C759' }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={isDark ? '#39393D' : '#E5E5EA'}
        />
      </View>

      <View style={[styles.sep, { backgroundColor: colors.separator }]} />
      <OptionPicker label="到站后提醒取件" options={mks(1, 2, 3, 5)} value={reminderDays} onChange={onSetReminderDays} colors={colors} />

      <View style={[styles.sep, { backgroundColor: colors.separator }]} />
      <OptionPicker label="超时自动标记已取件" options={mkOptions([3, 7, 14, 0])} value={autoPickupDays} onChange={onSetAutoPickupDays} colors={colors} />
    </SettingsCard>
  );
}

function mks(...vals: number[]) {
  return vals.map(v => ({ value: v, label: `${v} 天` }));
}
function mkOptions(vals: number[]) {
  return vals.map(v => ({ value: v, label: v === 0 ? '从不' : `${v} 天` }));
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
  },
  sep: { height: 0.5, marginLeft: 56 },
});
