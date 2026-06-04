// ============================================================
// 折叠面板标题
// ============================================================
import React from 'react';
import { Text, Pressable } from 'react-native';
import { FontSize, Spacing, BorderRadius } from '../../constants/theme';

interface Props {
  label: string;
  open: boolean;
  onPress: () => void;
  gray?: boolean;
}

const TITLE_BLUE = {
  fontSize: FontSize.subhead, fontWeight: '700', color: '#FFFFFF',
  backgroundColor: '#007AFF', paddingVertical: Spacing.sm,
  borderRadius: BorderRadius.sm, overflow: 'hidden', textAlign: 'center',
  flex: 1,
} as const;

const TITLE_GRAY = {
  ...TITLE_BLUE, backgroundColor: '#8E8E93',
} as const;

export function FoldTitle({ label, open, onPress, gray }: Props) {
  return (
    <Pressable
      style={{
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm,
      }}
      onPress={onPress}
    >
      <Text style={gray ? TITLE_GRAY : TITLE_BLUE}>{label}</Text>
      <Text style={{
        fontSize: 20, color: '#8E8E93', fontWeight: '300',
        transform: [{ rotate: open ? '90deg' : '0deg' }],
      }}>
        ›
      </Text>
    </Pressable>
  );
}
