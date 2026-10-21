import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { fetchDiagnosis } from '../services/diagnosisService';
import { DiagnosisRecord } from '../types';
import { PrescriptionCard } from '../components/PrescriptionCard';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { colors, sourceLabel, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'HistoryDetail'>;

export function HistoryDetailScreen({ route, navigation }: Props) {
  const { diagnosisId } = route.params;
  const [record, setRecord] = useState<DiagnosisRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      setRecord(await fetchDiagnosis(diagnosisId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load this diagnosis.');
    }
  };

  useEffect(() => {
    void load();
  }, [diagnosisId]);

  if (error) {
    return (
      <View style={styles.screen}>
        <View style={styles.padded}>
          <ErrorBanner message={error} onRetry={load} />
        </View>
      </View>
    );
  }

  if (!record) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>{sourceLabel(record.source)}</Text>
      <Text style={styles.title}>{new Date(record.createdAt).toLocaleString()}</Text>
      <Text style={styles.lead}>
        {record.matches.length > 0
          ? `${record.matches.length} probable ${record.matches.length === 1 ? 'cause was' : 'causes were'} ranked from ${record.symptomIds.length} reported ${record.symptomIds.length === 1 ? 'sign' : 'signs'}.`
          : 'No probable cause matched the reported signs at the time.'}
      </Text>

      {record.matches.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="No match on this record"
          message="The catalog didn’t have a strong match for the signs entered. You can run a fresh diagnosis or browse the repair library."
          actionLabel="Browse repair library"
          onAction={() => navigation.navigate('Main', { screen: 'Library' })}
        />
      ) : (
        record.matches.map((match) => (
          <PrescriptionCard
            key={match.cause.id}
            match={match}
            onViewRepair={() =>
              navigation.navigate('RepairGuideDetail', {
                repairGuideId: match.cause.repairGuideId,
              })
            }
          />
        ))
      )}
    </ScrollView>
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
  eyebrow: {
    ...typography.caption,
    color: colors.accent,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing(2),
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing(2),
  },
  lead: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing(5),
  },
});
