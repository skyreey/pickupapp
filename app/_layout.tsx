// ============================================================
// 根布局
// ============================================================
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useColors } from '../src/constants/theme';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}

function RootLayoutInner() {
  const { colors, isDark } = useColors();

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen
          name="detail/[id]"
          options={{
            headerShown: true,
            title: '包裹详情',
            headerStyle: { backgroundColor: colors.navBar },
            headerTintColor: colors.primary,
            headerTitleStyle: { fontWeight: '600', color: colors.textPrimary },
            headerShadowVisible: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="legal/privacy-policy"
          options={{
            headerShown: true,
            title: '隐私政策',
            headerStyle: { backgroundColor: colors.navBar },
            headerTintColor: colors.primary,
            headerTitleStyle: { fontWeight: '600', color: colors.textPrimary },
            headerShadowVisible: false,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="legal/user-agreement"
          options={{
            headerShown: true,
            title: '用户协议',
            headerStyle: { backgroundColor: colors.navBar },
            headerTintColor: colors.primary,
            headerTitleStyle: { fontWeight: '600', color: colors.textPrimary },
            headerShadowVisible: false,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="pro/activate"
          options={{
            headerShown: true,
            title: '升级 Pro',
            headerStyle: { backgroundColor: colors.navBar },
            headerTintColor: colors.primary,
            headerTitleStyle: { fontWeight: '600', color: colors.textPrimary },
            headerShadowVisible: false,
            presentation: 'modal',
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
