import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../theme/tokens';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Last-resort UI for an unexpected render error. React Native shows a red
 * screen in development; this gives a calmer recovery path and avoids losing
 * the navigation tree entirely.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unexpected error',
    };
  }

  componentDidCatch(error: unknown): void {
    console.error('Unhandled UI error:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <Ionicons name="warning-outline" size={36} color={colors.accent} />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {__DEV__
              ? this.state.message
              : 'The screen hit an unexpected error. You can try again without restarting the app.'}
          </Text>
          <Pressable
            style={styles.button}
            onPress={() => this.setState({ hasError: false, message: '' })}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(6),
    gap: spacing(3),
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing(3),
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingHorizontal: spacing(6),
    paddingVertical: spacing(3),
  },
  buttonText: {
    ...typography.subheading,
    color: colors.background,
  },
});
