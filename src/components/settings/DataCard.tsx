// ============================================================
// 设置 · 数据管理区（导出/导入/清空）
// ============================================================
import React from 'react';
import { Text, Pressable, View, TextInput, Alert, StyleSheet } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Paths, File } from 'expo-file-system';
import { FontSize, Spacing, BorderRadius, Shadow } from '../../constants/theme';
import type { ColorScheme } from '../../constants/theme';
import type { Package, TrackingEvent } from '../../models';
import { getAllPackages, getTrackingEvents, insertPackage, replaceTrackingEvents } from '../../database/dao';
import { SettingsCard } from './Card';

// ===== 数据导出版本号 =====
const EXPORT_VERSION = 1;

interface ExportData {
  version: number;
  exportedAt: number;
  appVersion: string;
  packages: Array<Package & { trackingEvents?: TrackingEvent[] }>;
}

interface Props {
  colors: ColorScheme;
  onClearAll: () => void;
}

export function SettingsDataCard({ colors, onClearAll }: Props) {
  const handleExport = async () => {
    try {
      const pkgs = getAllPackages();
      const exportData: ExportData = {
        version: EXPORT_VERSION,
        exportedAt: Date.now(),
        appVersion: '1.0.0',
        packages: pkgs.map(p => ({ ...p, trackingEvents: getTrackingEvents(p.id) })),
      };
      const json = JSON.stringify(exportData, null, 2);
      const f = new File(Paths.document, `pickup-export-${Date.now()}.json`);
      f.write(json);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: '导出包裹数据' });
      } else {
        Alert.alert('导出成功', `文件已保存到: ${f.uri}`);
      }
    } catch { Alert.alert('导出失败', '请稍后重试'); }
  };

  return (
    <SettingsCard color="#8E8E93" colors={colors}>
      <Pressable style={styles.row} onPress={handleExport}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.icon}>📤</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>导出数据</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>

      <View style={[styles.sep, { backgroundColor: colors.separator }]} />
      <ImportRow colors={colors} />

      <View style={[styles.sep, { backgroundColor: colors.separator }]} />
      <Pressable style={styles.row} onPress={onClearAll}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.icon}>🗑️</Text>
          <Text style={[styles.title, { color: colors.error }]}>清空全部数据</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>
    </SettingsCard>
  );
}

// ===== 导入行 =====
function ImportRow({ colors }: { colors: ColorScheme }) {
  const [importing, setImporting] = React.useState(false);
  const [importText, setImportText] = React.useState('');

  const handleImport = async () => {
    try {
      const { getStringAsync } = require('expo-clipboard');
      const t = await getStringAsync();
      if (t) setImportText(t);
      setImporting(true);
    } catch { setImporting(true); }
  };

  const doImport = () => {
    try {
      const parsed = JSON.parse(importText);
      let pkgArray: Array<Package & { trackingEvents?: TrackingEvent[] }>;
      if (parsed.version && parsed.packages && Array.isArray(parsed.packages)) {
        if (parsed.version > EXPORT_VERSION) {
          Alert.alert('版本不兼容', `导出的数据格式版本(v${parsed.version})高于当前支持版本(v${EXPORT_VERSION})，请更新App后再导入。`);
          setImporting(false); setImportText(''); return;
        }
        pkgArray = parsed.packages;
      } else if (Array.isArray(parsed)) {
        pkgArray = parsed;
      } else {
        throw new Error('e');
      }
      let c = 0;
      for (const p of pkgArray) {
        if (!p.id || !p.carrier) continue;
        insertPackage(p);
        if (p.trackingEvents?.length) replaceTrackingEvents(p.id, p.trackingEvents);
        c++;
      }
      Alert.alert('导入完成', `成功导入 ${c} 个包裹`);
    } catch { Alert.alert('导入失败', 'JSON 格式不正确'); }
    setImporting(false); setImportText('');
  };

  return (
    <>
      <Pressable style={styles.row} onPress={handleImport}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.icon}>📥</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>导入数据</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>

      {importing && (
        <View style={styles.importOverlay}>
          <View style={[styles.importCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.importTitle, { color: colors.textPrimary }]}>导入包裹数据</Text>
            <Text style={[styles.importDesc, { color: colors.textSecondary }]}>粘贴之前导出的 JSON 内容：</Text>
            <TextInput
              style={[styles.importInput, { backgroundColor: colors.secondarySurface, color: colors.textPrimary }]}
              value={importText}
              onChangeText={setImportText}
              placeholder='[{ "id": "...", "carrier": "...", ... }]'
              placeholderTextColor={colors.textPlaceholder}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.importActions}>
              <Pressable style={[styles.importCancelBtn]} onPress={() => { setImporting(false); setImportText(''); }}>
                <Text style={[styles.importCancelText, { color: colors.textSecondary }]}>取消</Text>
              </Pressable>
              <Pressable
                style={[styles.importConfirmBtn, { backgroundColor: colors.primary }, !importText.trim() && { opacity: 0.4 }]}
                onPress={doImport}
                disabled={!importText.trim()}
              >
                <Text style={styles.importConfirmText}>导入</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
  },
  icon: { fontSize: 22, marginRight: Spacing.md },
  title: { fontSize: FontSize.body },
  arrow: { fontSize: 22, color: '#8E8E93', fontWeight: '300' },
  sep: { height: 0.5, marginLeft: 56 },
  importOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 100,
  },
  importCard: {
    marginHorizontal: Spacing.lg, borderRadius: BorderRadius.xl,
    padding: Spacing.xl, width: '90%', maxHeight: '70%', ...Shadow.card,
  },
  importTitle: { fontSize: FontSize.headline, fontWeight: '700', marginBottom: Spacing.sm },
  importDesc: { fontSize: FontSize.footnote, marginBottom: Spacing.md },
  importInput: {
    borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.caption1,
    fontFamily: 'monospace', minHeight: 150, marginBottom: Spacing.md,
  },
  importActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
  importCancelBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.md },
  importCancelText: { fontSize: FontSize.subhead, fontWeight: '500' },
  importConfirmBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.md },
  importConfirmText: { color: '#FFFFFF', fontSize: FontSize.subhead, fontWeight: '600' },
});
