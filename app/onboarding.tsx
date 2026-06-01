// ============================================================
// 首次启动引导页（3 页滑动）
// ============================================================
import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Dimensions, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontSize, Spacing, BorderRadius, useColors } from '../src/constants/theme';
import type { ColorScheme } from '../src/constants/theme';
import { setHasSeenOnboarding } from '../src/services/settings-store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PageData {
  icon: string;
  title: string;
  desc: string;
}

const PAGES: PageData[] = [
  {
    icon: '📬',
    title: '快递短信自动识别',
    desc: '自动读取快递取件码短信，提取取件码、快递公司、取件地址，无需手动录入',
  },
  {
    icon: '📍',
    title: '一目了然，快速取件',
    desc: '取件码高亮显示一键复制\n地址一键导航\n到期提醒，不再错过包裹',
  },
  {
    icon: '🚀',
    title: '马上开始使用',
    desc: '授权短信读取权限，立即扫描历史快递短信，取件码自动归集',
  },
];

export default function OnboardingScreen() {
  const { colors } = useColors();
  const styles = createStyles(colors);
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(0);
  const flatListRef = useRef<FlatList<PageData>>(null);

  const handleNext = () => {
    if (currentPage < PAGES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentPage + 1 });
    }
  };

  const handleFinish = async () => {
    await setHasSeenOnboarding(true);
    router.replace('/(tabs)');
  };

  const handleSkip = async () => {
    await setHasSeenOnboarding(true);
    router.replace('/(tabs)');
  };

  const renderPage = ({ item }: { item: PageData }) => (
    <View style={styles.page}>
      <Text style={styles.pageIcon}>{item.icon}</Text>
      <Text style={styles.pageTitle}>{item.title}</Text>
      <Text style={styles.pageDesc}>{item.desc}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 右上角跳过按钮 */}
      <Pressable style={styles.skipBtn} onPress={handleSkip}>
        <Text style={styles.skipText}>跳过</Text>
      </Pressable>

      <FlatList
        ref={flatListRef}
        data={PAGES}
        renderItem={renderPage}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          setCurrentPage(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
        }}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* 底部指示器 + 按钮 */}
      <View style={styles.bottom}>
        <View style={styles.dots}>
          {PAGES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentPage && styles.dotActive]}
            />
          ))}
        </View>

        {currentPage < PAGES.length - 1 ? (
          <Pressable style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextBtnText}>继续</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.startBtn} onPress={handleFinish}>
            <Text style={styles.startBtnText}>开始使用</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: ColorScheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skipBtn: {
    position: 'absolute',
    top: 56,
    right: Spacing.lg,
    zIndex: 10,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  skipText: {
    fontSize: FontSize.subhead,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  pageIcon: {
    fontSize: 80,
    marginBottom: Spacing.xl,
  },
  pageTitle: {
    fontSize: FontSize.title2,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  pageDesc: {
    fontSize: FontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  bottom: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 48,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    marginBottom: Spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.separator,
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 20,
  },
  nextBtn: {
    backgroundColor: colors.secondarySurface,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  nextBtnText: {
    fontSize: FontSize.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  startBtn: {
    backgroundColor: colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  startBtnText: {
    fontSize: FontSize.body,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
