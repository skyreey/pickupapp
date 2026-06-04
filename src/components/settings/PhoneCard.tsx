// ============================================================
// 设置 · 账号设置（手机号）
// ============================================================
import React from 'react';
import { View, Text, Pressable, StyleSheet, Modal, TextInput, Alert } from 'react-native';
import { FontSize, Spacing, BorderRadius, Shadow } from '../../constants/theme';
import type { ColorScheme } from '../../constants/theme';
import { SettingsCard } from './Card';
import { SettingsRow } from './Row';

interface Props {
  colors: ColorScheme;
  myPhone: string;
  showPhoneModal: boolean;
  editPhone: string;
  onChangeEditPhone: (v: string) => void;
  onOpenModal: () => void;
  onCloseModal: () => void;
  onSavePhone: (phone: string) => void;
}

export function SettingsPhoneCard({ colors, myPhone, showPhoneModal, editPhone, onChangeEditPhone, onOpenModal, onCloseModal, onSavePhone }: Props) {
  return (
    <SettingsCard color={colors.primary} colors={colors}>
      <SettingsRow
        icon="📱"
        title="我的手机号"
        desc={myPhone ? `已设置：${myPhone}` : '设置后用于成员识别'}
        colors={colors}
        right={null}
      />
      <View style={[styles.sep, { backgroundColor: colors.separator }]} />
      <Pressable style={styles.row} onPress={onOpenModal}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.icon}>✏️</Text>
          <View>
            <Text style={[styles.title, { color: colors.primary }]}>
              {myPhone ? '修改手机号' : '点击设置手机号'}
            </Text>
            {myPhone ? <Text style={[styles.desc, { color: colors.textSecondary }]}>{myPhone}</Text> : null}
          </View>
        </View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>

      <Modal visible={showPhoneModal} transparent animationType="fade" onRequestClose={onCloseModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>设置手机号</Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>用于成员识别，不会上传</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.secondarySurface, color: colors.textPrimary }]}
              value={editPhone}
              onChangeText={onChangeEditPhone}
              placeholder="输入手机号"
              placeholderTextColor={colors.textPlaceholder}
              keyboardType="phone-pad"
              maxLength={11}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable onPress={onCloseModal} style={[styles.modalBtn, { backgroundColor: colors.secondarySurface }]}>
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>取消</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (editPhone.trim().length >= 11) {
                    onSavePhone(editPhone.trim());
                    onCloseModal();
                    Alert.alert('已保存', `手机号 ${editPhone.trim()} 已设为你的账号`);
                  }
                }}
                disabled={editPhone.trim().length < 11}
                style={[styles.modalBtn, { backgroundColor: editPhone.trim().length >= 11 ? colors.primary : colors.secondarySurface }]}
              >
                <Text style={[styles.modalBtnText, { color: editPhone.trim().length >= 11 ? '#FFF' : colors.textTertiary }]}>保存</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SettingsCard>
  );
}

const styles = StyleSheet.create({
  sep: { height: 0.5, marginLeft: 56 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
  },
  icon: { fontSize: 22, marginRight: Spacing.md },
  title: { fontSize: FontSize.body },
  desc: { fontSize: FontSize.footnote, marginTop: 1 },
  arrow: { fontSize: 22, color: '#8E8E93', fontWeight: '300' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: { borderRadius: 16, padding: 24, width: '85%', maxWidth: 360 },
  modalTitle: { fontSize: FontSize.headline, fontWeight: '700', marginBottom: 8 },
  modalDesc: { fontSize: FontSize.footnote, marginBottom: 20 },
  modalInput: { borderRadius: 12, padding: 16, fontSize: FontSize.title2, textAlign: 'center', letterSpacing: 2 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { fontSize: FontSize.subhead, fontWeight: '600' },
});
