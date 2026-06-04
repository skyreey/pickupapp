// ============================================================
// 设置 · 核心权限区
// ============================================================
import React from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { FontSize, Spacing } from '../../constants/theme';
import type { ColorScheme } from '../../constants/theme';
import { SettingsCard } from './Card';
import { SettingsRow } from './Row';

interface Props {
  colors: ColorScheme;
  isDark: boolean;
  smsGranted: boolean;
  monitoredStatus: Record<string, boolean>;
  monitoredApps: Array<{ packageName: string; name: string }>;
  backgroundMonitoring: boolean;
  openMonitor: boolean;
  onToggleMonitor: () => void;
  onToggleApp: (pkg: string, on: boolean) => void;
  onToggleAllApps: (on: boolean) => void;
  onToggleBg: (enabled: boolean) => void;
  onGuideSms: () => void;
  onGuideWidget: () => void;
}

export function SettingsPermissionsCard({
  colors, isDark, smsGranted,
  monitoredStatus, monitoredApps, backgroundMonitoring,
  openMonitor, onToggleMonitor, onToggleApp, onToggleAllApps,
  onToggleBg, onGuideSms, onGuideWidget,
}: Props) {
  const allOn = monitoredApps.every(a => monitoredStatus[a.packageName] !== false);
  const activeCount = Object.values(monitoredStatus).filter(Boolean).length;

  return (
    <SettingsCard color={colors.primary} colors={colors}>
      {/* SMS 权限 */}
      <Pressable style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg }} onPress={onGuideSms}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 22, marginRight: Spacing.md }}>💬</Text>
          <View>
            <Text style={{ fontSize: FontSize.body, color: colors.textPrimary }}>短信读取</Text>
            <Text style={{ fontSize: FontSize.footnote, color: colors.textSecondary }}>
              {smsGranted ? '已授权 — 自动识别取件码' : '未授权 — 需手动粘贴短信'}
            </Text>
          </View>
        </View>
        <View style={[styles.dot, smsGranted ? styles.dotGreen : styles.dotRed]} />
      </Pressable>

      <View style={[styles.sep, { backgroundColor: colors.separator }]} />

      {/* 购物 App 监控 */}
      <Pressable style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg }} onPress={onToggleMonitor}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 22, marginRight: Spacing.md }}>🛒</Text>
          <View>
            <Text style={{ fontSize: FontSize.body, color: colors.textPrimary }}>购物 App 监控</Text>
            <Text style={{ fontSize: FontSize.footnote, color: colors.textSecondary }}>
              {activeCount}/{monitoredApps.length} 个已开启
            </Text>
          </View>
        </View>
        <Text style={[styles.chevron, openMonitor && styles.chevronOpen]}>›</Text>
      </Pressable>

      {openMonitor && (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xs }}>
            <Text style={{ fontSize: FontSize.footnote, color: colors.textSecondary }}>监控以下 App 推送通知</Text>
            <Pressable onPress={() => onToggleAllApps(!allOn)}>
              <Text style={{ fontSize: FontSize.subhead, fontWeight: '600', color: colors.primary }}>{allOn ? '取消全选' : '全选'}</Text>
            </Pressable>
          </View>
          {monitoredApps.map((app, i) => (
            <View key={app.packageName}>
              {i > 0 && <View style={[styles.sep, { backgroundColor: colors.separator }]} />}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg }}>
                <Text style={{ fontSize: FontSize.body, color: colors.textPrimary }}>{app.name}</Text>
                <Switch
                  value={monitoredStatus[app.packageName] !== false}
                  onValueChange={v => onToggleApp(app.packageName, v)}
                  trackColor={{ false: isDark ? '#39393D' : '#E5E5EA', true: '#34C759' }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={isDark ? '#39393D' : '#E5E5EA'}
                />
              </View>
            </View>
          ))}
        </>
      )}

      <View style={[styles.sep, { backgroundColor: colors.separator }]} />

      {/* 后台监听 */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 22, marginRight: Spacing.md }}>📡</Text>
          <View>
            <Text style={{ fontSize: FontSize.body, color: colors.textPrimary }}>后台监听</Text>
            <Text style={{ fontSize: FontSize.footnote, color: colors.textSecondary }}>
              {backgroundMonitoring ? '已开启 — 自动扫描短信，防止杀后台' : '已关闭 — 需手动刷新'}
            </Text>
          </View>
        </View>
        <Switch
          value={backgroundMonitoring}
          onValueChange={onToggleBg}
          trackColor={{ false: isDark ? '#39393D' : '#E5E5EA', true: '#34C759' }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={isDark ? '#39393D' : '#E5E5EA'}
        />
      </View>

      <View style={[styles.sep, { backgroundColor: colors.separator }]} />

      {/* 桌面挂件引导 */}
      <Pressable style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg }} onPress={onGuideWidget}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 22, marginRight: Spacing.md }}>🧩</Text>
          <View>
            <Text style={{ fontSize: FontSize.body, color: colors.textPrimary }}>桌面挂件</Text>
            <Text style={{ fontSize: FontSize.footnote, color: colors.textSecondary }}>添加包裹挂件到桌面</Text>
          </View>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </SettingsCard>
  );
}

const styles: any = {
  sep: { height: 0.5, marginLeft: 56 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotGreen: { backgroundColor: '#34C759' },
  dotRed: { backgroundColor: '#FF3B30' },
  chevron: { fontSize: 20, color: '#8E8E93', fontWeight: '300' },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
};
