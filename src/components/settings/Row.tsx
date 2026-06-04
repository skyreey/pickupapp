// ============================================================
// 设置列表行
// ============================================================
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontSize, Spacing } from '../../constants/theme';
import type { ColorScheme } from '../../constants/theme';

interface Props {
  icon: string;
  title: string;
  desc?: string;
  colors: ColorScheme;
  right?: React.ReactNode;
  titleColor?: string;
}

export function SettingsRow({ icon, title, desc, colors, right, titleColor }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.icon}>{icon}</Text>
        <View>
          <Text style={[styles.title, { color: titleColor || colors.textPrimary }]}>{title}</Text>
          {desc ? <Text style={[styles.desc, { color: colors.textSecondary }]}>{desc}</Text> : null}
        </View>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 22, marginRight: Spacing.md },
  title: { fontSize: FontSize.body },
  desc: { fontSize: FontSize.footnote, marginTop: 1 },
});
