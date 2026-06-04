// ============================================================
// 设置页 — 编排层（子组件在 src/components/settings/）
// ============================================================
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable,
  StyleSheet, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { usePermissions } from '../../src/hooks/usePermissions';
import { PermissionGuide } from '../../src/components/PermissionGuide';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import {
  FontSize, Spacing, Shadow, useColors, useThemeSettings,
} from '../../src/constants/theme';
import type { ColorScheme } from '../../src/constants/theme';
import { getSelfInstallTime } from '../../modules/expo-app-scanner';
import { getAllMonitoredStatus, setAppMonitored, setAllMonitored } from '../../modules/expo-notification-reader';
import {
  deleteAllPackages,
} from '../../src/database/dao';
import {
  getHistoryDays, setHistoryDays, setHasScannedSms,
  isBackgroundMonitoringEnabled, setBackgroundMonitoringEnabled,
  getReminderDays, setReminderDays,
  getAutoPickupDays, setAutoPickupDays,
  isSchedulerEnabled, setSchedulerEnabled,
  getMembership, isMembershipActive, getTotalPackageCount,
  getLargeFontMode, setLargeFontMode,
} from '../../src/services/settings-store';
import { startScheduler, stopScheduler } from '../../src/services/tracker-scheduler';
import { getGeofenceSettings, setGeofenceSettings } from '../../src/services/geofence-service';
import type { GeofenceSettings } from '../../src/services/geofence-service';

// ===== 子组件 =====
import { FoldTitle } from '../../src/components/settings/FoldTitle';
import { SettingsProCard } from '../../src/components/settings/ProCard';
import { SettingsPhoneCard } from '../../src/components/settings/PhoneCard';
import { SettingsPermissionsCard } from '../../src/components/settings/PermissionsCard';
import { SettingsReminderCard } from '../../src/components/settings/ReminderCard';
import { SettingsGeofenceCard } from '../../src/components/settings/GeofenceCard';
import { SettingsHistoryCard } from '../../src/components/settings/HistoryCard';
import { SettingsDataCard } from '../../src/components/settings/DataCard';
import { SettingsThemeCard } from '../../src/components/settings/ThemeCard';
import { SettingsAboutCard } from '../../src/components/settings/AboutCard';

// ===== 常量 =====
const MONITORED_APPS: Array<{ packageName: string; name: string }> = [
  { packageName: 'com.taobao.taobao', name: '淘宝' },
  { packageName: 'com.jingdong.app.mall', name: '京东' },
  { packageName: 'com.xunmeng.pinduoduo', name: '拼多多' },
  { packageName: 'com.ss.android.ugc.aweme', name: '抖音' },
  { packageName: 'com.alibaba.android.rimet', name: '钉钉（淘宝物流）' },
  { packageName: 'com.cainiao.wireless', name: '菜鸟' },
  { packageName: 'com.sankuai.meituan', name: '美团' },
  { packageName: 'com.taobao.idlefish', name: '闲鱼' },
  { packageName: 'com.alibaba.wireless', name: '1688' },
  { packageName: 'com.xiaomi.shop', name: '小米商城' },
  { packageName: 'com.xingin.xhs', name: '小红书' },
  { packageName: 'com.kuaishou.nebula', name: '快手' },
  { packageName: 'com.vipshop', name: '唯品会' },
  { packageName: 'com.suning.mobile.ebuy', name: '苏宁' },
];

// ============================================================
// 主组件
// ============================================================
export default function SettingsScreen() {
  const { colors, isDark } = useColors();
  const styles = createStyles(colors);
  const router = useRouter();
  const { perms, requestSmsPermission } = usePermissions();
  const themeSettings = useThemeSettings();

  // ===== 状态 =====
  const [guideType, setGuideType] = useState<'sms' | 'widget' | 'background' | null>(null);
  const [historyDays, setHistoryDaysState] = useState(getHistoryDays());
  const [installTime, setInstallTime] = useState<number>(0);
  const [backgroundMonitoring, setBackgroundMonitoringState] = useState(isBackgroundMonitoringEnabled());
  const [schedulerEnabled, setSchedulerEnabledState] = useState(isSchedulerEnabled());
  const [reminderDays, setReminderDaysState] = useState(getReminderDays());
  const [autoPickupDays, setAutoPickupDaysState] = useState(getAutoPickupDays());
  const [monitoredStatus, setMonitoredStatus] = useState<Record<string, boolean>>({});
  // DEBUG: 强制激活
  if (__DEV__) { isMembershipActive(); }
  const [pro] = useState(__DEV__ ? true : isMembershipActive());
  const membership = __DEV__ ? { active: true, tier: 'lifetime' as const, activatedAt: Date.now(), expiresAt: 0, method: 'code' as const, code: 'DEV' } : getMembership();
  const [pkgCount] = useState(getTotalPackageCount());
  const [largeFontMode, setLargeFontModeState] = useState(getLargeFontMode());

  // 折叠状态
  const [openPro, setOpenPro] = useState(true);
  const [openMonitor, setOpenMonitor] = useState(true);
  const [openPricing, setOpenPricing] = useState(true);
  const [openPerms, setOpenPerms] = useState(true);
  const [openReminder, setOpenReminder] = useState(true);
  const [openGeofence, setOpenGeofence] = useState(true);
  const [openHistory, setOpenHistory] = useState(true);
  const [openData, setOpenData] = useState(true);
  const [openTheme, setOpenTheme] = useState(true);
  const [openAbout, setOpenAbout] = useState(true);
  const [openPhone, setOpenPhone] = useState(true);

  // 手机号
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [myPhone, setMyPhone] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const savePhone = async (phone: string) => {
    setMyPhone(phone);
    try { const { setSetting } = require('../../modules/expo-notification-reader'); await setSetting('my_phone', phone); } catch {}
  };

  // 地理围栏
  const [geoSettings, setGeoSettings] = useState<GeofenceSettings>({ enabled: false, radiusMeters: 500, cooldownMinutes: 60 });

  // ===== 初始化 =====
  useEffect(() => {
    (async () => {
      try {
        const { getSetting } = require('../../modules/expo-notification-reader');
        const p = await getSetting('my_phone') || '';
        setMyPhone(p); setEditPhone(p);
      } catch {}
    })();
  }, []);

  useEffect(() => { getSelfInstallTime().then(setInstallTime); }, []);
  useEffect(() => { getAllMonitoredStatus().then(setMonitoredStatus); }, []);
  useEffect(() => { getGeofenceSettings().then(setGeoSettings); }, []);

  // ===== 回调 =====
  const handleToggleBg = useCallback(async (enabled: boolean) => {
    setBackgroundMonitoringState(enabled);
    await setBackgroundMonitoringEnabled(enabled);
    if (enabled) { const { initSmsListener } = require('../../src/services/sms-listener'); initSmsListener(); }
  }, []);

  const toggleApp = useCallback(async (pkg: string, on: boolean) => {
    setMonitoredStatus(prev => ({ ...prev, [pkg]: on }));
    await setAppMonitored(pkg, on);
  }, []);

  const toggleAllApps = useCallback(async (on: boolean) => {
    const u: Record<string, boolean> = {};
    MONITORED_APPS.forEach(a => u[a.packageName] = on);
    setMonitoredStatus(u);
    await setAllMonitored(on);
  }, []);

  const toggleSched = useCallback(async (on: boolean) => {
    setSchedulerEnabledState(on); await setSchedulerEnabled(on);
    on ? startScheduler() : stopScheduler();
  }, []);

  const setRemDay = useCallback(async (d: number) => { setReminderDaysState(d); await setReminderDays(d); }, []);
  const setAutoDay = useCallback(async (d: number) => { setAutoPickupDaysState(d); await setAutoPickupDays(d); }, []);
  const setHDay = useCallback(async (d: number) => { setHistoryDaysState(d); await setHistoryDays(d); }, []);

  const toggleGeofence = useCallback(async (enabled: boolean) => {
    const updated = { ...geoSettings, enabled };
    setGeoSettings(updated); await setGeofenceSettings(updated);
  }, [geoSettings]);
  const setGeoRadius = useCallback(async (radius: number) => {
    const updated = { ...geoSettings, radiusMeters: radius };
    setGeoSettings(updated); await setGeofenceSettings(updated);
  }, [geoSettings]);
  const setGeoCooldown = useCallback(async (mins: number) => {
    const updated = { ...geoSettings, cooldownMinutes: mins };
    setGeoSettings(updated); await setGeofenceSettings(updated);
  }, [geoSettings]);

  const clearAll = useCallback(() => Alert.alert('清空数据', '确定要删除所有包裹记录吗？此操作不可恢复。', [
    { text: '取消', style: 'cancel' },
    { text: '清空', style: 'destructive', onPress: () => {
      try { deleteAllPackages(); setHasScannedSms(false); Alert.alert('已清空', '所有包裹记录已删除。'); }
      catch { Alert.alert('清空失败'); }
    }},
  ]), []);

  // ===== 权限引导视图 =====
  if (guideType) {
    return (
      <ErrorBoundary>
      <View style={styles.container}>
        <View style={styles.guideHeader}>
          <Pressable onPress={() => setGuideType(null)}>
            <Text style={styles.backText}>← 返回</Text>
          </Pressable>
        </View>
        <PermissionGuide
          type={guideType}
          granted={guideType === 'sms' ? perms.sms === 'granted' : undefined}
          onRequest={guideType === 'sms' ? requestSmsPermission : undefined}
        />
      </View>
      </ErrorBoundary>
    );
  }

  // ===== 主设置页 =====
  return (
    <ErrorBoundary>
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="always">

      {/* DEV状态 */}
      {__DEV__ ? (
        <View style={{ marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, padding: Spacing.md, backgroundColor: pro ? '#D4AF37' : '#FF3B30', borderRadius: 12 }}>
          <Text style={{ color: '#FFF', fontWeight: '700', textAlign: 'center', fontSize: FontSize.subhead }}>
            {pro ? '🐲 永久VIP · 已激活' : '❌ 未激活 (pro=' + String(pro) + ' tier=' + String(membership.tier) + ')'}
          </Text>
        </View>
      ) : null}

      {/* ======== 1. 取件通 Pro ======== */}
      <FoldTitle label="取件通 Pro" open={openPro} onPress={() => setOpenPro(!openPro)} />
      {openPro && (
        <SettingsProCard
          colors={colors} isDark={isDark}
          pro={pro} pkgCount={pkgCount} membership={membership}
          openPricing={openPricing} onTogglePricing={() => setOpenPricing(!openPricing)}
        />
      )}

      {/* ======== 账号设置 ======== */}
      <FoldTitle label="账号设置" open={openPhone} onPress={() => setOpenPhone(!openPhone)} />
      {openPhone && (
        <SettingsPhoneCard
          colors={colors}
          myPhone={myPhone}
          showPhoneModal={showPhoneModal}
          editPhone={editPhone}
          onChangeEditPhone={setEditPhone}
          onOpenModal={() => setShowPhoneModal(true)}
          onCloseModal={() => setShowPhoneModal(false)}
          onSavePhone={savePhone}
        />
      )}

      {/* ======== 2. 核心权限 ======== */}
      <FoldTitle label="核心权限" open={openPerms} onPress={() => setOpenPerms(!openPerms)} />
      {openPerms && (
        <SettingsPermissionsCard
          colors={colors} isDark={isDark}
          smsGranted={perms.sms === 'granted'}
          monitoredStatus={monitoredStatus}
          monitoredApps={MONITORED_APPS}
          backgroundMonitoring={backgroundMonitoring}
          openMonitor={openMonitor}
          onToggleMonitor={() => setOpenMonitor(!openMonitor)}
          onToggleApp={toggleApp}
          onToggleAllApps={toggleAllApps}
          onToggleBg={handleToggleBg}
          onGuideSms={() => setGuideType('sms')}
          onGuideWidget={() => setGuideType('widget')}
        />
      )}

      {/* ======== 3. 取件提醒 ======== */}
      <FoldTitle label="取件提醒" open={openReminder} onPress={() => setOpenReminder(!openReminder)} />
      {openReminder && (
        <SettingsReminderCard
          colors={colors} isDark={isDark}
          schedulerEnabled={schedulerEnabled}
          reminderDays={reminderDays}
          autoPickupDays={autoPickupDays}
          onToggleScheduler={toggleSched}
          onSetReminderDays={setRemDay}
          onSetAutoPickupDays={setAutoDay}
        />
      )}

      {/* ======== 4. 地理围栏 ======== */}
      <FoldTitle label="地理围栏" open={openGeofence} onPress={() => setOpenGeofence(!openGeofence)} />
      {openGeofence && (
        <SettingsGeofenceCard
          colors={colors} isDark={isDark}
          geoSettings={geoSettings}
          onToggle={toggleGeofence}
          onSetRadius={setGeoRadius}
          onSetCooldown={setGeoCooldown}
        />
      )}

      {/* ======== 5. 历史数据 ======== */}
      <FoldTitle label="历史数据" open={openHistory} onPress={() => setOpenHistory(!openHistory)} />
      {openHistory && (
        <SettingsHistoryCard
          colors={colors}
          historyDays={historyDays}
          installTime={installTime}
          onSetHistoryDays={setHDay}
        />
      )}

      {/* ======== 6. 数据管理 ======== */}
      <FoldTitle label="数据管理" open={openData} onPress={() => setOpenData(!openData)} />
      {openData && <SettingsDataCard colors={colors} onClearAll={clearAll} />}

      {/* ======== 7. 主题设置 ======== */}
      <FoldTitle label="主题设置" open={openTheme} onPress={() => setOpenTheme(!openTheme)} gray />
      {openTheme && (
        <SettingsThemeCard
          colors={colors}
          themeMode={themeSettings.themeMode as 'light' | 'dark' | 'system'}
          themeAccent={themeSettings.themeAccent}
          onSetThemeMode={themeSettings.setThemeMode}
          onSetThemeAccent={themeSettings.setThemeAccent}
          largeFontMode={largeFontMode}
          onToggleLargeFont={async (v) => { setLargeFontModeState(v); await setLargeFontMode(v); }}
        />
      )}

      {/* ======== 8. 关于 ======== */}
      <FoldTitle label="关于" open={openAbout} onPress={() => setOpenAbout(!openAbout)} gray />
      {openAbout && <SettingsAboutCard colors={colors} />}

      <View style={{ height: 80 }} />
    </ScrollView>
    </ErrorBoundary>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingTop: Spacing.md },
    guideHeader: {
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator,
    },
    backText: { fontSize: FontSize.body, color: colors.primary, fontWeight: '500' },
  });
}
