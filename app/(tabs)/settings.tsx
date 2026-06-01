// ============================================================
// 设置页 — 折叠面板 + 蓝底白字标题 + 彩色左框
// ============================================================
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, Alert, Switch, Linking, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Paths, File } from 'expo-file-system';
import { usePermissions } from '../../src/hooks/usePermissions';
import { PermissionGuide } from '../../src/components/PermissionGuide';
import { getAllPackages, getTrackingEvents, deleteAllPackages, insertPackage, replaceTrackingEvents } from '../../src/database/dao';
import type { Package, TrackingEvent } from '../../src/models';
import {
  FontSize, Spacing, BorderRadius, Shadow, useColors, createGlobalStyles, useThemeSettings,
} from '../../src/constants/theme';
import type { ColorScheme } from '../../src/constants/theme';
import { rescanInboxSms } from '../../src/services/sms-listener';
import { getSelfInstallTime } from '../../modules/expo-app-scanner';
import { getAllMonitoredStatus, setAppMonitored, setAllMonitored } from '../../modules/expo-notification-reader';
import { getHistoryDays, setHistoryDays, setHasScannedSms, isBackgroundMonitoringEnabled, setBackgroundMonitoringEnabled, getReminderDays, setReminderDays, getAutoPickupDays, setAutoPickupDays, isSchedulerEnabled, setSchedulerEnabled, getIsPro, getTotalPackageCount, FREE_PACKAGE_LIMIT, PRICING } from '../../src/services/settings-store';
import { startScheduler, stopScheduler } from '../../src/services/tracker-scheduler';

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
// 工具组件
// ============================================================
const TITLE_BLUE: any = {
  fontSize: FontSize.subhead, fontWeight: '700', color: '#FFFFFF',
  backgroundColor: '#007AFF', paddingVertical: Spacing.sm,
  borderRadius: BorderRadius.sm, overflow: 'hidden', textAlign: 'center',
  flex: 1,
};
const TITLE_GRAY: any = {
  ...TITLE_BLUE, backgroundColor: '#8E8E93',
};

function FixedTitle({ label, gray }: { label: string; gray?: boolean }) {
  return (
    <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm }}>
      <Text style={gray ? TITLE_GRAY : TITLE_BLUE}>{label}</Text>
    </View>
  );
}

function FoldTitle({ label, open, onPress, gray }: { label: string; open: boolean; onPress: () => void; gray?: boolean }) {
  return (
    <Pressable style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm }} onPress={onPress}>
      <Text style={gray ? TITLE_GRAY : TITLE_BLUE}>{label}</Text>
      <Text style={{ fontSize: 20, color: '#8E8E93', fontWeight: '300', transform: [{ rotate: open ? '90deg' : '0deg' }] }}>›</Text>
    </Pressable>
  );
}

// ============================================================
// 主组件
// ============================================================
export default function SettingsScreen() {
  const { colors, isDark } = useColors();
  const styles = createStyles(colors);
  const router = useRouter();
  const { perms, requestSmsPermission } = usePermissions();
  const [guideType, setGuideType] = useState<'sms' | 'widget' | 'background' | null>(null);
  const [historyDays, setHistoryDaysState] = useState(getHistoryDays());
  const [installTime, setInstallTime] = useState<number>(0);
  const [backgroundMonitoring, setBackgroundMonitoringState] = useState(isBackgroundMonitoringEnabled());
  const [schedulerEnabled, setSchedulerEnabledState] = useState(isSchedulerEnabled());
  const [reminderDays, setReminderDaysState] = useState(getReminderDays());
  const [autoPickupDays, setAutoPickupDaysState] = useState(getAutoPickupDays());
  const [monitoredStatus, setMonitoredStatus] = useState<Record<string, boolean>>({});
  const [pro] = useState(getIsPro());
  const [pkgCount] = useState(getTotalPackageCount());
  const themeSettings = useThemeSettings();
  // 折叠状态
  const [openMonitor, setOpenMonitor] = useState(false);
  const [openPricing, setOpenPricing] = useState(false);
  const [openHistory, setOpenHistory] = useState(true);
  const [openData, setOpenData] = useState(true);
  const [openTheme, setOpenTheme] = useState(false);
  const [openAbout, setOpenAbout] = useState(false);
  const [openPhone, setOpenPhone] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [myPhone, setMyPhone] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState('');

  const savePhone = async (phone: string) => {
    setMyPhone(phone);
    try { const { setSetting } = require('../../modules/expo-notification-reader'); await setSetting('my_phone', phone); } catch {}
  };
  useEffect(() => {
    (async () => { try { const { getSetting } = require('../../modules/expo-notification-reader'); const p = await getSetting('my_phone') || ''; setMyPhone(p); setEditPhone(p); } catch {} })();
  }, []);

  const handleToggleBg = useCallback(async (enabled: boolean) => {
    setBackgroundMonitoringState(enabled);
    await setBackgroundMonitoringEnabled(enabled);
    if (enabled) { const { initSmsListener } = require('../../src/services/sms-listener'); initSmsListener(); }
  }, []);

  useEffect(() => { getSelfInstallTime().then(setInstallTime); }, []);
  useEffect(() => { getAllMonitoredStatus().then(setMonitoredStatus); }, []);

  const handleExport = useCallback(async () => {
    try {
      const pkgs = getAllPackages();
      const data = pkgs.map(p => ({ ...p, trackingEvents: getTrackingEvents(p.id) }));
      const json = JSON.stringify(data, null, 2);
      const f = new File(Paths.document, `pickup-export-${Date.now()}.json`);
      f.write(json);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: '导出包裹数据' });
      else Alert.alert('导出成功', `文件已保存到: ${f.uri}`);
    } catch { Alert.alert('导出失败', '请稍后重试'); }
  }, []);

  const handleImport = useCallback(async () => {
    try { const { getStringAsync } = require('expo-clipboard'); const t = await getStringAsync(); if (t) setImportText(t); setImporting(true); } catch { setImporting(true); }
  }, []);

  const doImport = useCallback(() => {
    try {
      const data = JSON.parse(importText) as Array<Package & { trackingEvents?: TrackingEvent[] }>;
      if (!Array.isArray(data)) throw new Error('e');
      let c = 0;
      for (const p of data) { if (!p.id || !p.carrier) continue; insertPackage(p); if (p.trackingEvents?.length) replaceTrackingEvents(p.id, p.trackingEvents); c++; }
      Alert.alert('导入完成', `成功导入 ${c} 个包裹`);
    } catch { Alert.alert('导入失败', 'JSON 格式不正确'); }
    setImporting(false); setImportText('');
  }, [importText]);

  const toggleApp = useCallback(async (pkg: string, on: boolean) => { setMonitoredStatus(prev => ({ ...prev, [pkg]: on })); await setAppMonitored(pkg, on); }, []);
  const toggleAllApps = useCallback(async (on: boolean) => { const u: Record<string, boolean> = {}; MONITORED_APPS.forEach(a => u[a.packageName] = on); setMonitoredStatus(u); await setAllMonitored(on); }, []);
  const allOn = MONITORED_APPS.every(a => monitoredStatus[a.packageName] !== false);

  const toggleSched = useCallback(async (on: boolean) => { setSchedulerEnabledState(on); await setSchedulerEnabled(on); on ? startScheduler() : stopScheduler(); }, []);
  const setRemDay = useCallback(async (d: number) => { setReminderDaysState(d); await setReminderDays(d); }, []);
  const setAutoDay = useCallback(async (d: number) => { setAutoPickupDaysState(d); await setAutoPickupDays(d); }, []);
  const setHDay = useCallback(async (d: number) => { setHistoryDaysState(d); await setHistoryDays(d); }, []);

  const clearAll = useCallback(() => Alert.alert('清空数据', '确定要删除所有包裹记录吗？此操作不可恢复。', [
    { text: '取消', style: 'cancel' },
    { text: '清空', style: 'destructive', onPress: () => { try { deleteAllPackages(); setHasScannedSms(false); Alert.alert('已清空', '所有包裹记录已删除。'); } catch { Alert.alert('清空失败'); } } },
  ]), []);

  if (guideType) {
    return (
      <View style={styles.container}>
        <View style={styles.guideHeader}><Pressable onPress={() => setGuideType(null)}><Text style={styles.backText}>← 返回</Text></Pressable></View>
        <PermissionGuide type={guideType} granted={guideType === 'sms' ? perms.sms === 'granted' : undefined} onRequest={guideType === 'sms' ? requestSmsPermission : undefined} />
      </View>
    );
  }

  // ============================================================
  // Card 组件
  // ============================================================
  const Card = ({ color, children }: { color: string; children: React.ReactNode }) => (
    <View style={[styles.card, { borderLeftColor: color }]}>{children}</View>
  );

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="always">

      {/* ======== 1. 取件通 Pro — 始终展开 ======== */}
      <FixedTitle label="取件通 Pro" />
      <Card color="#FF6B35">
        {pro ? (
          <View style={styles.row}><View style={styles.rowLeft}><Text style={styles.rowIcon}>👑</Text><View><Text style={styles.rowTitle}>Pro 会员已激活</Text><Text style={styles.rowDesc}>无限包裹 · 全家共享 · 优先支持</Text></View></View><Text style={[styles.badge, { backgroundColor: colors.primary }]}>PRO</Text></View>
        ) : (
          <>
            <Pressable style={styles.row} onPress={() => setOpenPricing(!openPricing)}>
              <View style={styles.rowLeft}><Text style={styles.rowIcon}>📦</Text><View><Text style={styles.rowTitle}>免费版</Text><Text style={styles.rowDesc}>已用 {pkgCount}/{FREE_PACKAGE_LIMIT} 个包裹 · 点击查看升级方案</Text></View></View>
              <Text style={{ fontSize: 20, color: '#8E8E93', fontWeight: '300', transform: [{ rotate: openPricing ? '90deg' : '0deg' }] }}>›</Text>
            </Pressable>
            {openPricing && (
              <>
                <View style={styles.sep} />
                <View style={styles.pricingRow}>
                  <Pressable style={[styles.pCard, styles.pCardActive]} onPress={() => router.push('/pro/activate')}><Text style={styles.pTitle}>年付</Text><Text style={styles.pPrice}>{PRICING.yearly.price}</Text><Text style={styles.pPeriod}>/{PRICING.yearly.period}</Text></Pressable>
                  <Pressable style={styles.pCard} onPress={() => router.push('/pro/activate')}><Text style={styles.pTitle}>月付</Text><Text style={styles.pPrice}>{PRICING.monthly.price}</Text><Text style={styles.pPeriod}>/{PRICING.monthly.period}</Text></Pressable>
                  <Pressable style={styles.pCard} onPress={() => router.push('/pro/activate')}><Text style={styles.pTitle}>买断</Text><Text style={styles.pPrice}>{PRICING.lifetime.price}</Text><Text style={styles.pPeriod}>/{PRICING.lifetime.period}</Text></Pressable>
                </View>
                <View style={styles.sep} />
                <Pressable style={styles.upgradeBtn} onPress={() => router.push('/pro/activate')}><Text style={styles.upgradeBtnText}>升级 Pro</Text></Pressable>
                <Text style={styles.proNote}>Pro 会员权益：无限包裹 · 全家共享 · 数据导出 · 优先支持</Text>
              </>
            )}
          </>
        )}
      </Card>

      {/* ======== 账号设置 ======== */}
      <FoldTitle label="账号设置" open={openPhone} onPress={() => setOpenPhone(!openPhone)} />
      <View style={{ display: openPhone ? 'flex' : 'none' }}>
      <Card color={colors.primary}>
        <View style={[styles.row, { paddingRight: Spacing.lg }]}>
          <View style={styles.rowLeft}><Text style={styles.rowIcon}>📱</Text>
            <View style={{ flex: 1 }}><Text style={styles.rowTitle}>我的手机号</Text><Text style={styles.rowDesc}>{myPhone ? `已设置：${myPhone}` : '设置后用于成员识别'}</Text></View>
          </View>
        </View>
        <View style={styles.sep} />
        <Pressable style={styles.row} onPress={() => setShowPhoneModal(true)}>
          <View style={styles.rowLeft}><Text style={styles.rowIcon}>✏️</Text><View><Text style={[styles.rowTitle, { color: colors.primary }]}>{myPhone ? '修改手机号' : '点击设置手机号'}</Text>{myPhone ? <Text style={styles.rowDesc}>{myPhone}</Text> : null}</View></View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      </Card>
      </View>

      {/* ======== 2. 核心权限 — 始终展开 ======== */}
      <FixedTitle label="核心权限" />
      <Card color={colors.primary}>
        <Pressable style={styles.row} onPress={() => setGuideType('sms')}>
          <View style={styles.rowLeft}><Text style={styles.rowIcon}>💬</Text><View><Text style={styles.rowTitle}>短信读取</Text><Text style={styles.rowDesc}>{perms.sms === 'granted' ? '已授权 — 自动识别取件码' : '未授权 — 需手动粘贴短信'}</Text></View></View>
          <View style={[styles.dot, perms.sms === 'granted' ? styles.dotGreen : styles.dotRed]} />
        </Pressable>
        <View style={styles.sep} />
        <Pressable style={styles.row} onPress={() => setOpenMonitor(!openMonitor)}>
          <View style={styles.rowLeft}><Text style={styles.rowIcon}>🛒</Text><View><Text style={styles.rowTitle}>购物 App 监控</Text><Text style={styles.rowDesc}>{Object.values(monitoredStatus).filter(Boolean).length}/{MONITORED_APPS.length} 个已开启</Text></View></View>
          <Text style={{ fontSize: 20, color: '#8E8E93', fontWeight: '300', transform: [{ rotate: openMonitor ? '90deg' : '0deg' }] }}>›</Text>
        </Pressable>
        {openMonitor && (
          <>
            <View style={styles.appMonHdr}><Text style={styles.appMonDesc}>监控以下 App 推送通知</Text><Pressable onPress={() => toggleAllApps(!allOn)}><Text style={styles.appMonToggle}>{allOn ? '取消全选' : '全选'}</Text></Pressable></View>
            {MONITORED_APPS.map((app, i) => (
              <View key={app.packageName}>{i > 0 && <View style={styles.sep} />}<View style={styles.row}><View style={styles.rowLeft}><Text style={styles.rowTitle}>{app.name}</Text></View><Switch value={monitoredStatus[app.packageName] !== false} onValueChange={v => toggleApp(app.packageName, v)} trackColor={{ false: isDark ? '#39393D' : '#E5E5EA', true: '#34C759' }} thumbColor="#FFFFFF" ios_backgroundColor={isDark ? '#39393D' : '#E5E5EA'} /></View></View>
            ))}
          </>
        )}
        <View style={styles.sep} />
        <View style={styles.row}>
          <View style={styles.rowLeft}><Text style={styles.rowIcon}>📡</Text><View><Text style={styles.rowTitle}>后台监听</Text><Text style={styles.rowDesc}>{backgroundMonitoring ? '已开启 — 自动扫描短信，防止杀后台' : '已关闭 — 需手动刷新'}</Text></View></View>
          <Switch value={backgroundMonitoring} onValueChange={handleToggleBg} trackColor={{ false: isDark ? '#39393D' : '#E5E5EA', true: '#34C759' }} thumbColor="#FFFFFF" ios_backgroundColor={isDark ? '#39393D' : '#E5E5EA'} />
        </View>
        <View style={styles.sep} />
        <Pressable style={styles.row} onPress={() => setGuideType('widget')}>
          <View style={styles.rowLeft}><Text style={styles.rowIcon}>🧩</Text><View><Text style={styles.rowTitle}>桌面挂件</Text><Text style={styles.rowDesc}>添加包裹挂件到桌面</Text></View></View><Text style={styles.arrow}>›</Text>
        </Pressable>
      </Card>

      {/* ======== 3. 取件提醒 — 始终展开 ======== */}
      <FixedTitle label="取件提醒" />
      <Card color="#FF9500">
        <View style={styles.row}>
          <View style={styles.rowLeft}><Text style={styles.rowIcon}>⏰</Text><View><Text style={styles.rowTitle}>提醒调度</Text><Text style={styles.rowDesc}>{schedulerEnabled ? '已开启' : '已关闭'}</Text></View></View>
          <Switch value={schedulerEnabled} onValueChange={toggleSched} trackColor={{ false: isDark ? '#39393D' : '#E5E5EA', true: '#34C759' }} thumbColor="#FFFFFF" ios_backgroundColor={isDark ? '#39393D' : '#E5E5EA'} />
        </View>
        <View style={styles.sep} />
        <View style={styles.pickWrap}><Text style={styles.pickLabel}>到站后提醒取件</Text><View style={styles.pickOpts}>{[1, 2, 3, 5].map(d => <Pressable key={d} style={[styles.pickOpt, reminderDays === d && styles.pickOptOn]} onPress={() => setRemDay(d)}><Text style={[styles.pickOptTxt, reminderDays === d && styles.pickOptTxtOn]}>{d} 天</Text></Pressable>)}</View></View>
        <View style={styles.sep} />
        <View style={styles.pickWrap}><Text style={styles.pickLabel}>超时自动标记已取件</Text><View style={styles.pickOpts}>{[3, 7, 14].map(d => <Pressable key={d} style={[styles.pickOpt, autoPickupDays === d && styles.pickOptOn]} onPress={() => setAutoDay(d)}><Text style={[styles.pickOptTxt, autoPickupDays === d && styles.pickOptTxtOn]}>{d} 天</Text></Pressable>)}<Pressable style={[styles.pickOpt, autoPickupDays === 0 && styles.pickOptOn]} onPress={() => setAutoDay(0)}><Text style={[styles.pickOptTxt, autoPickupDays === 0 && styles.pickOptTxtOn]}>从不</Text></Pressable></View></View>
      </Card>

      {/* ======== 4. 历史数据 — 可折叠 ======== */}
      <FoldTitle label="历史数据" open={openHistory} onPress={() => setOpenHistory(!openHistory)} />
      {openHistory && (
      <Card color="#007AFF">
        <View style={styles.historySection}>
          <Text style={styles.hLabel}>获取最近</Text>
          <View style={styles.hOpts}>{[7, 30, 90].map(d => <Pressable key={d} style={[styles.hOpt, historyDays === d && styles.hOptOn]} onPress={() => setHDay(d)}><Text style={[styles.hOptTxt, historyDays === d && styles.hOptTxtOn]}>{d} 天</Text></Pressable>)}<Pressable style={[styles.hOpt, historyDays === 0 && styles.hOptOn]} onPress={() => setHDay(0)}><Text style={[styles.hOptTxt, historyDays === 0 && styles.hOptTxtOn]}>从安装起</Text></Pressable></View>
          <Text style={styles.hHint}>扫描 SMS 收件箱时获取指定范围快递短信{'\n'}{installTime > 0 ? `App 安装时间：${new Date(installTime).toLocaleDateString('zh-CN')}` : ''}</Text>
          <Pressable style={styles.rescanBtn} onPress={() => Alert.alert('重新扫描短信', `重新扫描最近 ${historyDays || '全部'} 天历史短信`, [{ text: '取消', style: 'cancel' }, { text: '开始扫描', onPress: async () => { try { await rescanInboxSms(); Alert.alert('扫描完成'); } catch { Alert.alert('扫描失败'); } } }])}><Text style={styles.rescanBtnText}>🔄 重新扫描历史短信</Text></Pressable>
        </View>
      </Card>
      )}

      {/* ======== 5. 数据管理 — 可折叠 ======== */}
      <FoldTitle label="数据管理" open={openData} onPress={() => setOpenData(!openData)} />
      {openData && (
      <Card color="#8E8E93">
        <Pressable style={styles.row} onPress={handleExport}><View style={styles.rowLeft}><Text style={styles.rowIcon}>📤</Text><Text style={styles.rowTitle}>导出数据</Text></View><Text style={styles.arrow}>›</Text></Pressable>
        <View style={styles.sep} />
        <Pressable style={styles.row} onPress={handleImport}><View style={styles.rowLeft}><Text style={styles.rowIcon}>📥</Text><Text style={styles.rowTitle}>导入数据</Text></View><Text style={styles.arrow}>›</Text></Pressable>
        <View style={styles.sep} />
        <Pressable style={styles.row} onPress={clearAll}><View style={styles.rowLeft}><Text style={styles.rowIcon}>🗑️</Text><Text style={[styles.rowTitle, { color: colors.error }]}>清空全部数据</Text></View><Text style={styles.arrow}>›</Text></Pressable>
      </Card>
      )}

      {/* ======== 6. 主题设置 — 可折叠 ======== */}
      <FoldTitle label="主题设置" open={openTheme} onPress={() => setOpenTheme(!openTheme)} gray />
      {openTheme && (
      <Card color="#AF52DE">
        <View style={styles.pickWrap}><Text style={styles.pickLabel}>主题模式</Text><View style={styles.pickOpts}>{[{ v: 'light', l: '浅色' }, { v: 'dark', l: '深色' }, { v: 'system', l: '跟随系统' }].map(o => <Pressable key={o.v} style={[styles.pickOpt, themeSettings.themeMode === o.v && styles.pickOptOn]} onPress={() => themeSettings.setThemeMode(o.v as any)}><Text style={[styles.pickOptTxt, themeSettings.themeMode === o.v && styles.pickOptTxtOn]}>{o.l}</Text></Pressable>)}</View></View>
        <View style={styles.sep} />
        <View style={styles.accentWrap}><Text style={styles.pickLabel}>强调色</Text><View style={styles.accentRow}>{[{ v: 'blue', c: '#007AFF' }, { v: 'green', c: '#34C759' }, { v: 'red', c: '#FF3B30' }, { v: 'orange', c: '#FF9500' }, { v: 'purple', c: '#AF52DE' }, { v: 'pink', c: '#FF2D55' }].map(a => <Pressable key={a.v} style={[styles.accentDot, { backgroundColor: a.c }, themeSettings.themeAccent === a.v && styles.accentDotOn]} onPress={() => themeSettings.setThemeAccent(a.v as any)} />)}</View></View>
      </Card>
      )}

      {/* ======== 7. 关于 — 可折叠 ======== */}
      <FoldTitle label="关于" open={openAbout} onPress={() => setOpenAbout(!openAbout)} gray />
      {openAbout && (
      <Card color="#FF3B30">
        <View style={styles.row}><View style={styles.rowLeft}><Text style={styles.rowIcon}>📋</Text><View><Text style={styles.rowTitle}>取件通 v1.0.0</Text><Text style={styles.rowDesc}>数据完全本地存储 · 不上传服务器</Text></View></View></View>
        <View style={styles.sep} />
        <Pressable style={styles.row} onPress={async () => {
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
          } catch {
            Alert.alert('检查失败', '无法连接更新服务器，请稍后重试。');
          }
        }}><View style={styles.rowLeft}><Text style={styles.rowIcon}>🔄</Text><Text style={styles.rowTitle}>检查更新</Text></View><Text style={styles.arrow}>›</Text></Pressable>
        <View style={styles.sep} />
        <Pressable style={styles.row} onPress={() => router.push('/legal/privacy-policy')}><View style={styles.rowLeft}><Text style={styles.rowIcon}>🔒</Text><Text style={styles.rowTitle}>隐私政策</Text></View><Text style={styles.arrow}>›</Text></Pressable>
        <View style={styles.sep} />
        <Pressable style={styles.row} onPress={() => router.push('/legal/user-agreement')}><View style={styles.rowLeft}><Text style={styles.rowIcon}>📄</Text><Text style={styles.rowTitle}>用户协议</Text></View><Text style={styles.arrow}>›</Text></Pressable>
        <View style={styles.sep} />
        <Pressable style={styles.row} onPress={() => Linking.openURL('mailto:skyreey@163.com?subject=取件通反馈').catch(() => Alert.alert('无法打开邮件'))}><View style={styles.rowLeft}><Text style={styles.rowIcon}>💬</Text><Text style={styles.rowTitle}>反馈与建议</Text></View><Text style={styles.arrow}>›</Text></Pressable>
        <View style={styles.sep} />
        <Pressable style={styles.row} onPress={() => Linking.openURL('market://details?id=com.carl.pickupapp').catch(() => Linking.openURL('https://play.google.com/store/apps/details?id=com.carl.pickupapp').catch(() => null))}><View style={styles.rowLeft}><Text style={styles.rowIcon}>⭐</Text><View><Text style={styles.rowTitle}>给个好评</Text><Text style={styles.rowDesc}>在应用市场给我们一个好评吧</Text></View></View><Text style={styles.arrow}>›</Text></Pressable>
      </Card>
      )}

      {/* ======== 导入弹窗 ======== */}
      {importing && (
        <View style={styles.importOverlay}>
          <View style={styles.importCard}>
            <Text style={styles.importTitle}>导入包裹数据</Text><Text style={styles.importDesc}>粘贴之前导出的 JSON 内容：</Text>
            <TextInput style={styles.importInput} value={importText} onChangeText={setImportText} placeholder='[{ "id": "...", "carrier": "...", ... }]' placeholderTextColor={colors.textPlaceholder} multiline numberOfLines={8} textAlignVertical="top" autoFocus />
            <View style={styles.importActions}>
              <Pressable style={styles.importCancelBtn} onPress={() => { setImporting(false); setImportText(''); }}><Text style={styles.importCancelText}>取消</Text></Pressable>
              <Pressable style={[styles.importConfirmBtn, !importText.trim() && { opacity: 0.4 }]} onPress={doImport} disabled={!importText.trim()}><Text style={styles.importConfirmText}>导入</Text></Pressable>
            </View>
          </View>
        </View>
      )}
      <View style={{ height: 80 }} />
    </ScrollView>

    {/* 手机号输入弹窗 */}
    <Modal visible={showPhoneModal} transparent animationType="fade" onRequestClose={() => setShowPhoneModal(false)}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 24, width: '85%', maxWidth: 360 }}>
          <Text style={{ fontSize: FontSize.headline, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 }}>设置手机号</Text>
          <Text style={{ fontSize: FontSize.footnote, color: colors.textSecondary, marginBottom: 20 }}>用于成员识别，不会上传</Text>
          <TextInput
            style={{ backgroundColor: colors.secondarySurface, borderRadius: 12, padding: 16, fontSize: FontSize.title2, color: colors.textPrimary, textAlign: 'center', letterSpacing: 2 }}
            value={editPhone}
            onChangeText={setEditPhone}
            placeholder="输入手机号"
            placeholderTextColor={colors.textPlaceholder}
            keyboardType="phone-pad"
            maxLength={11}
            autoFocus
          />
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
            <Pressable onPress={() => setShowPhoneModal(false)} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.secondarySurface, alignItems: 'center' }}>
              <Text style={{ fontSize: FontSize.subhead, color: colors.textSecondary, fontWeight: '600' }}>取消</Text>
            </Pressable>
            <Pressable
              onPress={() => { if (editPhone.trim().length >= 11) { savePhone(editPhone.trim()); setShowPhoneModal(false); Alert.alert('已保存', `手机号 ${editPhone.trim()} 已设为你的账号`); } }}
              disabled={editPhone.trim().length < 11}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: editPhone.trim().length >= 11 ? colors.primary : colors.secondarySurface, alignItems: 'center' }}
            >
              <Text style={{ fontSize: FontSize.subhead, fontWeight: '700', color: editPhone.trim().length >= 11 ? '#FFF' : colors.textTertiary }}>保存</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

// ============================================================
// 样式
// ============================================================
function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingTop: Spacing.md },
    guideHeader: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.separator },
    backText: { fontSize: FontSize.body, color: colors.primary, fontWeight: '500' },
    // 卡片
    card: { backgroundColor: colors.surface, marginHorizontal: Spacing.lg, borderRadius: BorderRadius.lg, overflow: 'hidden', borderLeftWidth: 3, borderLeftColor: colors.primary, ...Shadow.card },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
    rowLeft: { flexDirection: 'row', alignItems: 'center' },
    rowIcon: { fontSize: 22, marginRight: Spacing.md },
    rowTitle: { fontSize: FontSize.body, color: colors.textPrimary },
    rowDesc: { fontSize: FontSize.footnote, color: colors.textSecondary, marginTop: 1 },
    arrow: { fontSize: 22, color: colors.textTertiary, fontWeight: '300' },
    dot: { width: 10, height: 10, borderRadius: 5 },
    dotGreen: { backgroundColor: colors.success },
    dotRed: { backgroundColor: colors.error },
    sep: { height: 0.5, backgroundColor: colors.separator, marginLeft: 56 },
    // 选择器
    pickWrap: { padding: Spacing.lg },
    pickLabel: { fontSize: FontSize.subhead, fontWeight: '600', color: colors.textPrimary, marginBottom: Spacing.sm },
    pickOpts: { flexDirection: 'row', gap: 8 },
    pickOpt: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: colors.secondarySurface, alignItems: 'center' },
    pickOptOn: { backgroundColor: colors.primary },
    pickOptTxt: { fontSize: FontSize.footnote, fontWeight: '600', color: colors.textSecondary },
    pickOptTxtOn: { color: '#FFFFFF' },
    // 历史数据
    historySection: { padding: Spacing.lg },
    hLabel: { fontSize: FontSize.subhead, fontWeight: '600', color: colors.textPrimary, marginBottom: Spacing.sm },
    hOpts: { flexDirection: 'row', gap: 8, marginBottom: Spacing.sm },
    hOpt: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: colors.secondarySurface, alignItems: 'center' },
    hOptOn: { backgroundColor: colors.primary },
    hOptTxt: { fontSize: FontSize.footnote, fontWeight: '600', color: colors.textSecondary },
    hOptTxtOn: { color: '#FFFFFF' },
    hHint: { fontSize: FontSize.caption1, color: colors.textTertiary, lineHeight: 18 },
    rescanBtn: { backgroundColor: colors.secondarySurface, borderRadius: BorderRadius.md, paddingVertical: Spacing.sm, alignItems: 'center', marginTop: Spacing.md },
    rescanBtnText: { fontSize: FontSize.subhead, fontWeight: '600', color: colors.primary },
    // 导入弹窗
    importOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
    importCard: { backgroundColor: colors.surface, marginHorizontal: Spacing.lg, borderRadius: BorderRadius.xl, padding: Spacing.xl, width: '90%', maxHeight: '70%', ...Shadow.card },
    importTitle: { fontSize: FontSize.headline, fontWeight: '700', color: colors.textPrimary, marginBottom: Spacing.sm },
    importDesc: { fontSize: FontSize.footnote, color: colors.textSecondary, marginBottom: Spacing.md },
    importInput: { backgroundColor: colors.secondarySurface, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.caption1, color: colors.textPrimary, fontFamily: 'monospace', minHeight: 150, marginBottom: Spacing.md },
    importActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
    importCancelBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.md },
    importCancelText: { color: colors.textSecondary, fontSize: FontSize.subhead, fontWeight: '500' },
    importConfirmBtn: { backgroundColor: colors.primary, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.md },
    importConfirmText: { color: '#FFFFFF', fontSize: FontSize.subhead, fontWeight: '600' },
    // 购物App监控
    appMonHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xs },
    appMonDesc: { fontSize: FontSize.footnote, color: colors.textSecondary },
    appMonToggle: { fontSize: FontSize.subhead, fontWeight: '600', color: colors.primary },
    // 强调色
    accentWrap: { padding: Spacing.lg },
    accentRow: { flexDirection: 'row', gap: 12, marginTop: Spacing.sm },
    accentDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
    accentDotOn: { borderColor: colors.textPrimary, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
    // Pro
    badge: { fontSize: FontSize.caption1, fontWeight: '700', color: '#FFFFFF', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm, overflow: 'hidden' },
    pricingRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
    pCard: { flex: 1, backgroundColor: colors.secondarySurface, borderRadius: BorderRadius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
    pCardActive: { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
    pTitle: { fontSize: FontSize.caption1, color: colors.textSecondary, marginBottom: 2 },
    pPrice: { fontSize: FontSize.title3, fontWeight: '700', color: colors.textPrimary },
    pPeriod: { fontSize: FontSize.caption1, color: colors.textTertiary },
    upgradeBtn: { backgroundColor: colors.primary, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: 'center', marginHorizontal: Spacing.lg, marginBottom: Spacing.xs },
    upgradeBtnText: { fontSize: FontSize.subhead, fontWeight: '700', color: '#FFFFFF' },
    proNote: { fontSize: FontSize.caption1, color: colors.textTertiary, textAlign: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, lineHeight: 18 },
  });
}
