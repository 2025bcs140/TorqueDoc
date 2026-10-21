import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { fetchRepairGuide } from '../services/catalogService';
import { RepairGuide } from '../types';
import { ErrorBanner } from '../components/ErrorBanner';
import {
  categoryLabel,
  colors,
  difficultyLabel,
  radii,
  spacing,
  typography,
} from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'RepairGuideDetail'>;

export function RepairGuideDetailScreen({ route }: Props) {
  const { repairGuideId } = route.params;
  const [guide, setGuide] = useState<RepairGuide | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGuide(await fetchRepairGuide(repairGuideId));
      setCompleted(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the repair guide.');
    } finally {
      setLoading(false);
    }
  }, [repairGuideId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (error || !guide) {
    return (
      <View style={styles.screen}>
        <View style={styles.padded}>
          <ErrorBanner message={error ?? 'Guide not found.'} onRetry={load} />
        </View>
      </View>
    );
  }

  const toggleStep = (index: number) => {
    setCompleted((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const progress = guide.steps.length === 0 ? 0 : completed.size / guide.steps.length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{guide.title}</Text>

      <View style={styles.metaRow}>
        <Meta label="Difficulty" value={difficultyLabel(guide.difficulty)} />
        <Meta label="Time" value={`${guide.estimatedMinutes} min`} />
        <Meta label="Category" value={categoryLabel(guide.category)} />
      </View>

      <View style={styles.vehicleChips}>
        {guide.vehicleTypes.map((type) => (
          <View key={type} style={styles.vehicleChip}>
            <Ionicons
              name={type === 'car' ? 'car-sport-outline' : 'bicycle-outline'}
              size={12}
              color={colors.textSecondary}
            />
            <Text style={styles.vehicleChipText}>{type === 'car' ? 'Car' : 'Motorcycle'}</Text>
          </View>
        ))}
      </View>

      <View style={styles.safetyCard}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
        <Text style={styles.safetyText}>
          Work on a cool, securely supported vehicle and follow the manufacturer’s torque specs.
          If a step feels unsafe, stop and involve a qualified mechanic.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Tools needed</Text>
      <View style={styles.toolsCard}>
        {guide.toolsNeeded.map((tool) => (
          <View key={tool} style={styles.toolRow}>
            <Ionicons name="build-outline" size={14} color={colors.textMuted} />
            <Text style={styles.toolItem}>{tool}</Text>
          </View>
        ))}
      </View>

      <View style={styles.stepsHeader}>
        <Text style={styles.sectionTitle}>Steps</Text>
        <Text style={styles.progressText}>
          {completed.size}/{guide.steps.length} done
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>

      {guide.steps.map((step, index) => {
        const done = completed.has(index);
        return (
          <Pressable
            key={`${index}-${step.slice(0, 12)}`}
            onPress={() => toggleStep(index)}
            style={({ pressed }) => [styles.stepRow, pressed && styles.stepRowPressed]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            accessibilityLabel={`Step ${index + 1}: ${step}`}
          >
            <View style={[styles.stepNumber, done && styles.stepNumberDone]}>
              {done ? (
                <Ionicons name="checkmark" size={14} color={colors.background} />
              ) : (
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              )}
            </View>
            <Text style={[styles.stepText, done && styles.stepTextDone]}>{step}</Text>
          </Pressable>
        );
      })}

      <Text style={styles.disclaimer}>
        TorqueDoc’s guides are general guidance, not a substitute for a factory service manual.
        Torque values, fluids and procedures vary by make, model and year.
      </Text>
    </ScrollView>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaBox}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  padded: {
    padding: spacing(4),
  },
  content: {
    padding: spacing(4),
    paddingBottom: spacing(10),
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing(4),
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  metaBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
  },
  metaLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  metaValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
    marginTop: 2,
  },
  vehicleChips: {
    flexDirection: 'row',
    gap: spacing(2),
    marginBottom: spacing(4),
  },
  vehicleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1),
  },
  vehicleChipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(2),
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    marginBottom: spacing(5),
  },
  safetyText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  sectionTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
    marginBottom: spacing(3),
  },
  toolsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
    marginBottom: spacing(5),
    gap: spacing(2),
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
  },
  toolItem: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  stepsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    ...typography.mono,
    color: colors.textSecondary,
    marginBottom: spacing(3),
  },
  progressTrack: {
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
    marginBottom: spacing(4),
  },
  progressFill: {
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.success,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: spacing(4),
    gap: spacing(3),
    padding: spacing(2),
    borderRadius: radii.sm,
  },
  stepRowPressed: {
    backgroundColor: colors.surface,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberDone: {
    backgroundColor: colors.success,
  },
  stepNumberText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  stepText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  stepTextDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  disclaimer: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing(4),
    lineHeight: 18,
  },
});
