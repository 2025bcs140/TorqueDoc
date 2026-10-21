import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/types';
import { useVehicles } from '../store/VehicleContext';
import { fetchSymptoms } from '../services/catalogService';
import { runDiagnosis } from '../services/diagnosisService';
import { ChecklistItem } from '../components/ChecklistItem';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { PrimaryButton } from '../components/PrimaryButton';
import { Symptom, SymptomCategory } from '../types';
import { categoryLabel, colors, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'SymptomChecklist'>;

export function SymptomChecklistScreen({ route, navigation }: Props) {
  const { vehicleId } = route.params;
  const { getVehicle } = useVehicles();
  const vehicle = getVehicle(vehicleId);
  const insets = useSafeAreaInsets();

  const [symptoms, setSymptoms] = useState<Symptom[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const vehicleType = vehicle?.type;

  const load = useCallback(async () => {
    if (!vehicleType) return;
    setSymptoms(null);
    setLoadError(null);
    try {
      setSymptoms(await fetchSymptoms(vehicleType));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load symptoms.');
    }
  }, [vehicleType]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    if (!symptoms) return [] as [SymptomCategory, Symptom[]][];
    const byCategory = new Map<SymptomCategory, Symptom[]>();
    for (const symptom of symptoms) {
      const list = byCategory.get(symptom.category) ?? [];
      list.push(symptom);
      byCategory.set(symptom.category, list);
    }
    return Array.from(byCategory.entries());
  }, [symptoms]);

  if (!vehicle) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="car-outline"
          title="Vehicle not found"
          message="Go back to the garage and choose a vehicle."
          actionLabel="Back to garage"
          onAction={() => navigation.navigate('Main', { screen: 'Garage' })}
        />
      </View>
    );
  }

  const toggle = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGetDiagnosis = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await runDiagnosis(vehicle.type, Array.from(selected), {
        vehicleId: vehicle.id,
        source: 'checklist',
      });
      navigation.navigate('DiagnosisResult', {
        vehicleId,
        matches: result.matches,
        source: 'checklist',
        diagnosisId: result.diagnosisId,
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to get a diagnosis.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      {loadError ? (
        <View style={styles.padded}>
          <ErrorBanner message={loadError} onRetry={load} />
        </View>
      ) : !symptoms ? (
        <ActivityIndicator color={colors.accent} style={styles.loader} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.hint}>
              Select everything you’re noticing. More matching signs produce a clearer ranking.
            </Text>

            {grouped.map(([category, categorySymptoms]) => (
              <View key={category} style={styles.group}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>{categoryLabel(category)}</Text>
                  <Text style={styles.groupCount}>{categorySymptoms.length}</Text>
                </View>
                {categorySymptoms.map((symptom) => (
                  <ChecklistItem
                    key={symptom.id}
                    label={symptom.label}
                    checked={selected.has(symptom.id)}
                    onToggle={() => toggle(symptom.id)}
                  />
                ))}
              </View>
            ))}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(spacing(4), insets.bottom) }]}>
            {submitError && <ErrorBanner message={submitError} />}
            <View style={styles.footerRow}>
              {selected.size > 0 && (
                <Pressable
                  onPress={() => setSelected(new Set())}
                  style={styles.clearButton}
                  accessibilityRole="button"
                  accessibilityLabel="Clear selected symptoms"
                >
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              )}
              <PrimaryButton
                label={
                  selected.size === 0
                    ? 'Select at least one symptom'
                    : `Get diagnosis (${selected.size})`
                }
                onPress={handleGetDiagnosis}
                loading={submitting}
                disabled={selected.size === 0}
                style={styles.submitButton}
              />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  padded: {
    padding: spacing(4),
  },
  content: {
    padding: spacing(4),
    paddingBottom: spacing(6),
  },
  hint: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing(5),
  },
  loader: {
    marginTop: spacing(10),
  },
  group: {
    marginBottom: spacing(5),
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(1),
  },
  groupTitle: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  groupCount: {
    ...typography.mono,
    color: colors.textMuted,
  },
  footer: {
    padding: spacing(4),
    paddingTop: spacing(3),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
  },
  clearButton: {
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(3),
  },
  clearText: {
    ...typography.body,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  submitButton: {
    flex: 1,
  },
});
