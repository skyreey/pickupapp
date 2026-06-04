// ============================================================
// 设置 · 关于区
// ============================================================
import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { FontSize, Spacing } from '../../constants/theme';
import type { ColorScheme } from '../../constants/theme';
import { SettingsCard } from './Card';

interface Props {
  colors: ColorScheme;
}

export function SettingsAboutCard({ colors }: Props) {
  const router = useRouter();

  const checkUpdate = async () => {
    try {
      const res = await fetch('https://api.github.com/repos/skyreey/PickupApp/releases/latest');
      const data = await res.json();
      const latest = (data.tag_name || '').replace('v', '');
      const current = '1.0.0';
      if (latest && latest !== current) {
        Alert.alert('发现新版本', `最新版：v${latest}\n当前版：v${current}\n\n前往下载页面？`, [
          { text: '取消', style: 'cancel' },
          { text: '前往', onPress: () => Linking.openURL(data.html_url || 'https://github.com/skyreey/PickupApp/releases') },
        ]);
      } else {
        Alert.alert('已是最新版', `当前版本 v${current} 已是最新。`);
      }
    } catch { Alert.alert('检查失败', '无法连接更新服务器，请稍后重试。'); }
  };

  const rows = [
    { icon: '📋', title: '取件通 v1.0.0', desc: '数据完全本地存储 · 不上传服务器', action: null },
    { icon: '🔄', title: '检查更新', desc: undefined, action: checkUpdate },
    { icon: '🔒', title: '隐私政策', desc: undefined, action: () => router.push('/legal/privacy-policy') },
    { icon: '📄', title: '用户协议', desc: undefined, action: () => router.push('/legal/user-agreement') },
    {
      icon: '💬', title: '反馈与建议', desc: undefined,
      action: () => Linking.openURL('mailto:skyreey@163.com?subject=取件通反馈').catch(() => Alert.alert('无法打开邮件')),
    },
    {
      icon: '⭐', title: '给个好评', desc: '在应用市场给我们一个好评吧',
      action: () => Linking.openURL('market://details?id=com.carl.pickupapp').catch(() => Linking.openURL('https://play.google.com/store/apps/details?id=com.carl.pickupapp').catch(() => null)),
    },
  ];

  return (
    <SettingsCard color="#FF3B30" colors={colors}>
      {rows.map((row, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={[styles.sep, { backgroundColor: colors.separator }]} />}
          {row.action ? (
            <Pressable style={styles.row} onPress={row.action}>
              <View style={styles.rowLeft}>
                <Text style={styles.icon}>{row.icon}</Text>
                <View>
                  <Text style={[styles.title, { color: colors.textPrimary }]}>{row.title}</Text>
                  {row.desc ? <Text style={[styles.desc, { color: colors.textSecondary }]}>{row.desc}</Text> : null}
                </View>
              </View>
              <Text style={styles.arrow}>›</Text>
            </Pressable>
          ) : (
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.icon}>{row.icon}</Text>
                <View>
                  <Text style={[styles.title, { color: colors.textPrimary }]}>{row.title}</Text>
                  {row.desc ? <Text style={[styles.desc, { color: colors.textSecondary }]}>{row.desc}</Text> : null}
                </View>
              </View>
            </View>
          )}
        </React.Fragment>
      ))}
    </SettingsCard>
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
  arrow: { fontSize: 22, color: '#8E8E93', fontWeight: '300' },
  sep: { height: 0.5, marginLeft: 56 },
});
