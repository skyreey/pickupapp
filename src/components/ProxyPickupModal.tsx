import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { FontSize, Spacing, BorderRadius, Shadow, useColors, type ColorScheme } from '../constants/theme';

export interface PendingProxyPickup {
  sender: string;
  code: string;
  carrier: string;
  address: string;
  phone: string;
  deadline: string;
}

interface Props {
  visible: boolean;
  items: PendingProxyPickup[];
  onAccept: (item: PendingProxyPickup) => void;
  onReject: (item: PendingProxyPickup) => void;
  onClose: () => void;
}

export function ProxyPickupModal({ visible, items, onAccept, onReject, onClose }: Props) {
  const { colors } = useColors();
  const styles = createStyles(colors);

  if (!visible || items.length === 0) return null;
  const item = items[0];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.marker}>{`📦 取件通代取`}</Text>

          {item.sender ? (
            <View style={styles.row}>
              <Text style={styles.label}>{`来自`}</Text>
              <Text style={styles.value}>{item.sender}</Text>
            </View>
          ) : null}

          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>{`取件码`}</Text>
            <Text style={styles.codeValue}>{item.code}</Text>
          </View>

          {item.carrier ? (
            <View style={styles.row}>
              <Text style={styles.label}>{`快递`}</Text>
              <Text style={styles.value}>{item.carrier}</Text>
            </View>
          ) : null}

          {item.address ? (
            <View style={styles.row}>
              <Text style={styles.label}>{`地址`}</Text>
              <Text style={styles.value}>{item.address}</Text>
            </View>
          ) : null}

          {item.phone ? (
            <View style={styles.row}>
              <Text style={styles.label}>{`电话`}</Text>
              <Text style={styles.value}>{item.phone}</Text>
            </View>
          ) : null}

          {item.deadline ? (
            <View style={styles.row}>
              <Text style={styles.label}>{`截止`}</Text>
              <Text style={styles.value}>{item.deadline}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnReject]} onPress={() => onReject(item)}>
              <Text style={styles.btnRejectText}>{`拒绝`}</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnAccept]} onPress={() => onAccept(item)}>
              <Text style={styles.btnAcceptText}>{`接受并导入`}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: Spacing.xl },
    card: { backgroundColor: colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, width: '100%', maxWidth: 380, ...Shadow.medium },
    marker: { fontSize: FontSize.subhead, fontWeight: '700', color: '#FF6B35', textAlign: 'center', marginBottom: Spacing.lg },
    row: { flexDirection: 'row', marginBottom: Spacing.sm },
    label: { fontSize: FontSize.footnote, color: colors.textSecondary, width: 56, fontWeight: '500' },
    value: { fontSize: FontSize.footnote, color: colors.textPrimary, flex: 1 },
    codeBox: { backgroundColor: colors.secondarySurface, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md, alignItems: 'center' },
    codeLabel: { fontSize: FontSize.caption1, color: colors.textSecondary, marginBottom: 4 },
    codeValue: { fontSize: FontSize.title1, fontWeight: '700', color: colors.primary, letterSpacing: 2 },
    actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
    btn: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center' },
    btnReject: { backgroundColor: colors.secondarySurface },
    btnAccept: { backgroundColor: colors.primary },
    btnRejectText: { fontSize: FontSize.subhead, fontWeight: '600', color: colors.textSecondary },
    btnAcceptText: { fontSize: FontSize.subhead, fontWeight: '700', color: '#FFFFFF' },
  });
}
