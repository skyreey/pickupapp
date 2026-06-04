// ============================================================
// 设置 · 历史数据区
// ============================================================
import React from 'react';
import { Text, Pressable, StyleSheet, Alert } from 'react-native';
import { FontSize, Spacing, BorderRadius } from '../../constants/theme';
import type { ColorScheme } from '../../constants/theme';
import { SettingsCard } from './Card';
import { OptionPicker } from './OptionPicker';
import { rescanInboxSms } from '../../services/sms-listener';

interface Props {
  colors: ColorScheme;
  historyDays: number;
  installTime: number;
  onSetHistoryDays: (days: number) => void;
}

export function SettingsHistoryCard({ colors, historyDays, installTime, onSetHistoryDays }: Props) {
  return (
    <SettingsCard color="#007AFF" colors={colors}>
      <OptionPicker
        label="获取最近"
        options={[
          { value: 7, label: '7 天' },
          { value: 30, label: '30 天' },
          { value: 90, label: '90 天' },
          { value: 0, label: '从安装起' },
        ]}
        value={historyDays}
        onChange={onSetHistoryDays}
        colors={colors}
      />

      <Text style={[styles.hint, { color: colors.textTertiary }]}>
        扫描 SMS 收件箱时获取指定范围快递短信{'\n'}
        {installTime > 0 ? `App 安装时间：${new Date(installTime).toLocaleDateString('zh-CN')}` : ''}
      </Text>

      <Pressable
        style={[styles.rescanBtn, { backgroundColor: colors.secondarySurface }]}
        onPress={() => Alert.alert(
          '重新扫描短信',
          `重新扫描最近 ${historyDays || '全部'} 天历史短信`,
          [
            { text: '取消', style: 'cancel' },
            {
              text: '开始扫描',
              onPress: async () => {
                try { await rescanInboxSms(); Alert.alert('扫描完成'); }
                catch { Alert.alert('扫描失败'); }
              },
            },
          ],
        )}
      >
        <Text style={[styles.rescanBtnText, { color: colors.primary }]}>🔄 重新扫描历史短信</Text>
      </Pressable>
    </SettingsCard>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: FontSize.caption1, lineHeight: 18, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  rescanBtn: { borderRadius: BorderRadius.md, paddingVertical: Spacing.sm, alignItems: 'center', margin: Spacing.lg, marginTop: 0 },
  rescanBtnText: { fontSize: FontSize.subhead, fontWeight: '600' },
});
