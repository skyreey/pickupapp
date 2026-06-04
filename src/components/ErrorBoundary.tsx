// ============================================================
// ErrorBoundary — 捕获渲染错误，防止整个页面白屏
// ============================================================
import React, { Component } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
} from 'react-native';
import { FontSize, Spacing, BorderRadius, Shadow, useColors } from '../constants/theme';
import type { ColorScheme } from '../constants/theme';
import { createLogger } from '../utils/logger';

const log = createLogger('ErrorBoundary');

// ============================================================
// 错误回退 UI（函数组件）
// ============================================================

interface FallbackProps {
  error: Error;
  errorInfo: React.ErrorInfo | null;
  onRetry: () => void;
  darkMode?: boolean;
}

function ErrorFallback({ error, errorInfo, onRetry, darkMode }: FallbackProps) {
  const bg = darkMode ? '#1C1C1E' : '#F2F2F7';
  const cardBg = darkMode ? '#2C2C2E' : '#FFFFFF';
  const text = darkMode ? '#FFFFFF' : '#1C1C1E';
  const subText = darkMode ? '#8E8E93' : '#8E8E93';
  const devBg = darkMode ? '#3A3A3C' : '#F2F2F7';

  return (
    <View style={[fallbackStyles.container, { backgroundColor: bg }]}>
      <View style={[fallbackStyles.card, { backgroundColor: cardBg }]}>
        <Text style={fallbackStyles.emoji}>😵</Text>
        <Text style={[fallbackStyles.title, { color: text }]}>出了点问题</Text>
        <Text style={[fallbackStyles.message, { color: subText }]}>
          {error.message || '未知错误'}
        </Text>

        {__DEV__ && errorInfo ? (
          <ScrollView style={[fallbackStyles.devScroll, { backgroundColor: devBg }]} horizontal={false}>
            <Text style={fallbackStyles.devTitle}>组件堆栈（仅开发环境可见）：</Text>
            <Text style={[fallbackStyles.devText, { color: subText }]}>
              {errorInfo.componentStack?.slice(0, 500)}
            </Text>
          </ScrollView>
        ) : null}

        <Pressable
          style={fallbackStyles.retryBtn}
          onPress={onRetry}
        >
          <Text style={fallbackStyles.retryText}>🔄 重试</Text>
        </Pressable>

        <Text style={[fallbackStyles.hint, { color: darkMode ? '#636366' : '#C7C7CC' }]}>
          如果问题持续出现，请截图反馈给开发者
        </Text>
      </View>
    </View>
  );
}

// ============================================================
// ErrorBoundary 类组件
// ============================================================

interface Props {
  children: React.ReactNode;
  /** 暗色模式 */
  darkMode?: boolean;
  /** 自定义错误回退 UI，不传则用默认 */
  fallback?: (error: Error, errorInfo: React.ErrorInfo | null, retry: () => void) => React.ReactNode;
  /** 错误回调（上报到外部系统） */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });

    // 写日志
    log.error('组件渲染崩溃', {
      message: error.message,
      stack: error.stack?.slice(0, 300),
      componentStack: errorInfo.componentStack?.slice(0, 300),
    });

    // 外部回调（可接 Sentry/BugSnag）
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(
          this.state.error,
          this.state.errorInfo,
          this.handleRetry,
        );
      }
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
          darkMode={this.props.darkMode}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================================
// 回退 UI 样式（不依赖 hooks）
// ============================================================

const fallbackStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: Spacing.xl,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    ...Shadow.medium,
  },
  emoji: {
    fontSize: 56,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.title2,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: FontSize.subhead,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  devScroll: {
    maxHeight: 150,
    width: '100%',
    backgroundColor: '#F2F2F7',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  devTitle: {
    fontSize: FontSize.caption1,
    fontWeight: '600',
    color: '#FF3B30',
    marginBottom: Spacing.xs,
  },
  devText: {
    fontSize: FontSize.caption,
    color: '#8E8E93',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  retryBtn: {
    backgroundColor: '#007AFF',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    marginBottom: Spacing.md,
  },
  retryText: {
    fontSize: FontSize.subhead,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  hint: {
    fontSize: FontSize.caption1,
    color: '#C7C7CC',
    textAlign: 'center',
  },
});

export default ErrorBoundary;
