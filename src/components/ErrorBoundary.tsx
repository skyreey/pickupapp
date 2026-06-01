// ============================================================
// Error Boundary — catches render crashes and shows fallback UI
// ============================================================
import React, { Component, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>{this.props.fallbackTitle ?? '出错了'}</Text>
          <Text style={styles.message}>
            {this.props.fallbackMessage ?? '应用遇到了意外错误，请尝试重启。'}
          </Text>
          {__DEV__ && this.state.error ? (
            <Text style={styles.errorDetail}>{this.state.error.message}</Text>
          ) : null}
          <Pressable style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>重试</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 32,
  },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#000', marginBottom: 8 },
  message: { fontSize: 15, color: '#8E8E93', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  errorDetail: { fontSize: 11, color: '#FF3B30', textAlign: 'center', marginBottom: 16, fontFamily: 'monospace' },
  button: { backgroundColor: '#007AFF', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  buttonText: { color: '#FFF', fontSize: 17, fontWeight: '600' },
});