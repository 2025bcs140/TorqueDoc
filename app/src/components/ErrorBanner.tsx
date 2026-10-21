import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../theme/tokens';

interface Props {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

/** Consistent inline error with an optional retry action. */
export function ErrorBanner({ message, onRetry, retryLabel = 'Try again' }: Props) {
  return (
    <View style={styles.box} accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
      <View style={styles.content}>
        <Text style={styles.text}>{message}</Text>
        {onRetry && (
          <Pressable onPress={onRetry} style={styles.retry} accessibilityRole="button">
            <Text style={styles.retryText}>{retryLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(2),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.md,
    padding: spacing(3),
    marginBottom: spacing(3),
  },
  content: {
    flex: 1,
  },
  text: {
    ...typography.caption,
    color: colors.danger,
    lineHeight: 18,
  },
  retry: {
    marginTop: spacing(2),
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  retryText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
