// ============================================================
// Tab 导航布局 — iOS 风格底部标签栏
// ============================================================
import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Text, Pressable, Alert, AppState } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { FontSize, useColors } from '../../src/constants/theme';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { initSmsListener } from '../../src/services/sms-listener';
import { initNotificationListener } from '../../src/services/notification-listener';
import { loadSettings, getHasSeenOnboarding } from '../../src/services/settings-store';
import { refreshWidget } from '../../src/services/widget-refresh';
import { startScheduler } from '../../src/services/tracker-scheduler';
import { parseSms } from '../../src/services/sms-parser';

// 转发导入的暂存文本（其他App分享短信到取件通时暂存）
let pendingSharedText: string | null = null;
export function getPendingSharedText(): string | null {
  const t = pendingSharedText;
  pendingSharedText = null;
  return t;
}
export function setPendingSharedText(text: string): void {
  pendingSharedText = text;
}

export default function TabLayout() {
  const { colors } = useColors();
  const router = useRouter();

  function BackButton() {
    return (
      <Pressable onPress={() => router.navigate('/(tabs)')} style={{ paddingRight: 16 }}>
        <Text style={{ fontSize: 18, color: colors.primary }}>←</Text>
      </Pressable>
    );
  }

  useEffect(() => {
    let cleanupSms: (() => void) | undefined;
    let cleanupNotification: (() => void) | undefined;
    let cleanupAppState: (() => void) | undefined;
  let cleanupClipboard: (() => void) | undefined;

    (async () => {
      await loadSettings();
      if (!getHasSeenOnboarding()) {
        router.replace('/onboarding');
        return;
      }
      // 检查是否有转发导入的短信文本
      try {
        const { getSetting, setSetting } = require('../../modules/expo-notification-reader');
        const sharedText = await getSetting('pending_shared_sms');
        if (sharedText && typeof sharedText === 'string' && sharedText.trim()) {
          pendingSharedText = sharedText.trim();
          setSetting('pending_shared_sms', ''); // 清除已读
        }
      } catch {}
      cleanupSms = initSmsListener();
      cleanupNotification = initNotificationListener();
      refreshWidget();
      startScheduler();

      // 剪贴板检测（启动时 + 回到前台时）
      const checkClipboard = async () => {
        try {
          const clipText = await Clipboard.getStringAsync();
          if (!clipText || clipText.length < 6) return;

          const parsed = parseSms(clipText);
          if (parsed) {
            const isProxy = clipText.includes('📦 取件通代取');
            // 提取发送者信息
            const senderMatch = clipText.match(/来自[：:]\s*(\S+)/);
            const sender = senderMatch ? senderMatch[1] : '';
            Alert.alert(
              isProxy ? `📦 代取请求${sender ? ' · ' + sender : ''}` : '📦 检测到快递信息',
              `取件码：${parsed.code}\n${parsed.companyName} · ${parsed.address || parsed.stationName || ''}`,
              [
                { text: '忽略', style: 'cancel' },
                { text: '立即导入', onPress: () => { pendingSharedText = clipText; router.navigate('/(tabs)/manual'); } },
              ],
            );
          }
        } catch {}
      };

      await checkClipboard();

      // 每次回到前台也检查剪贴板
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') checkClipboard();
      });
      cleanupAppState = () => sub.remove();
    })();

    return () => {
      cleanupSms?.();
      cleanupNotification?.();
      cleanupAppState?.();
    };
  }, []);
  return (`r`n    <ErrorBoundary>`r`n    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.navBar },
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: FontSize.title3,
          color: colors.textPrimary,
        },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.separator,
          borderTopWidth: 0.5,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '我的包裹',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22 }}>📦</Text>,
        }}
      />
      <Tabs.Screen
        name="manual"
        options={{
          title: '手动录入',
          headerShown: true,
          headerStyle: { backgroundColor: colors.navBar },
          headerTitleStyle: { fontWeight: '600', fontSize: FontSize.title3, color: colors.textPrimary },
          headerShadowVisible: false,
          headerLeft: () => <BackButton />,
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22 }}>✏️</Text>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '设置',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22 }}>⚙️</Text>,
        }}
      />
    </Tabs>`r`n    </ErrorBoundary>`r`n  );
}
