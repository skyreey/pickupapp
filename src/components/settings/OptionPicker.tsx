// ============================================================
// 选项选择器（如「1天 2天 3天 5天」）
// ============================================================
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { FontSize, Spacing, BorderRadius } from '../../constants/theme';
import type { ColorScheme } from '../../constants/theme';

interface Option<T> {
  value: T;
  label: string;
}

interface Props<T> {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  colors: ColorScheme;
}

export function OptionPicker<T extends string | number>({ label, options, value, onChange, colors }: Props<T>) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
      <View style={styles.opts}>
        {options.map(opt => {
          const active = value === opt.value;
          return (
            <Pressable
              key={String(opt.value)}
              style={[styles.opt, { backgroundColor: active ? colors.primary : colors.secondarySurface }]}
              onPress={() => onChange(opt.value)}
            >
              <Text style={[styles.optText, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: Spacing.lg },
  label: { fontSize: FontSize.subhead, fontWeight: '600', marginBottom: Spacing.sm },
  opts: { flexDirection: 'row', gap: 8 },
  opt: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, alignItems: 'center' },
  optText: { fontSize: FontSize.footnote, fontWeight: '600' },
});
