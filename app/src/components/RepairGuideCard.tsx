import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RepairGuide } from '../types';
import {
  categoryLabel,
  colors,
  difficultyLabel,
  radii,
  spacing,
  typography,
} from '../theme/tokens';

interface Props {
  guide: RepairGuide;
  onPress: () => void;
}

export function RepairGuideCard({ guide, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${guide.title}. ${difficultyLabel(guide.difficulty)}, about ${guide.estimatedMinutes} minutes`}
      accessibilityHint="Opens the repair guide"
    >
      <Text style={styles.title}>{guide.title}</Text>
      <View style={styles.metaRow}>
        <View style={styles.metaChip}>
          <Ionicons name="albums-outline" size={12} color={colors.textSecondary} />
          <Text style={styles.metaText}>{categoryLabel(guide.category)}</Text>
        </View>
        <View style={styles.metaChip}>
          <Ionicons name="speedometer-outline" size={12} color={colors.textSecondary} />
          <Text style={styles.metaText}>{difficultyLabel(guide.difficulty)}</Text>
        </View>
        <View style={styles.metaChip}>
          <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
          <Text style={styles.metaText}>{guide.estimatedMinutes} min</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    marginBottom: spacing(3),
  },
  pressed: {
    backgroundColor: colors.surfaceRaised,
  },
  title: {
    ...typography.subheading,
    color: colors.textPrimary,
    marginBottom: spacing(2),
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(3),
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
