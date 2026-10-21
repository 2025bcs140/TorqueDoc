import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useVehicles } from '../store/VehicleContext';
import { fetchVehicleHistory } from '../services/vehicleService';
import { DiagnosisRecord } from '../types';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import {
  colors,
  radii,
  severityColor,
  sourceLabel,
  spacing,
  typography,
} from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export function HistoryScreen({ route, navigation }: Props) {
  const { vehicleId } = route.params;
  const { getVehicle } = useVehicles();
  const vehicle = getVehicle(vehicleId);

  const [history, setHistory] = useState<DiagnosisRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setHistory(await fetchVehicleHistory(vehicleId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history.');
    }
  }, [vehicleId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (error && !history) {
    return (
      <View style={styles.screen}>
        <View style={styles.padded}>
          <ErrorBanner message={error} onRetry={load} />
        </View>
      </View>
    );
  }

  if (!history) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={[styles.list, history.length === 0 && styles.listEmpty]}
      data={history}
      keyExtractor={(record) => record.id}
      onRefresh={refresh}
      refreshing={refreshing}
      ListHeaderComponent={
        error ? (
          <ErrorBanner message={error} onRetry={load} />
        ) : vehicle ? (
          <Text style={styles.headerText}>
            {vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`} · {history.length}{' '}
            {history.length === 1 ? 'record' : 'records'}
          </Text>
        ) : null
      }
      ListEmptyComponent={
        <EmptyState
          icon="time-outline"
          title="No diagnoses yet"
          message="Run a symptom checklist, a written description, or a photo analysis and it will appear here."
          actionLabel="Diagnose a problem"
          onAction={() => navigation.navigate('DiagnoseHome', { vehicleId })}
        />
      }
      renderItem={({ item }) => (
        <RecordCard
          record={item}
          onPress={() => navigation.navigate('HistoryDetail', { diagnosisId: item.id })}
        />
      )}
    />
  );
}

function RecordCard({ record, onPress }: { record: DiagnosisRecord; onPress: () => void }) {
  const topMatches = record.matches.slice(0, 3);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Diagnosis from ${new Date(record.createdAt).toLocaleString()}. ${topMatches.length} matching causes.`}
      accessibilityHint="Opens the full diagnosis record"
    >
      <View style={styles.cardHeader}>
        <Text style={styles.date}>{new Date(record.createdAt).toLocaleString()}</Text>
        <View style={styles.sourceChip}>
          <Ionicons
            name={
              record.source === 'checklist'
                ? 'list-outline'
                : record.source === 'free_text'
                  ? 'chatbubble-ellipses-outline'
                  : 'camera-outline'
            }
            size={11}
            color={colors.textSecondary}
          />
          <Text style={styles.source}>{sourceLabel(record.source)}</Text>
        </View>
      </View>

      {topMatches.length > 0 ? (
        <>
          {topMatches.map((match, index) => (
            <View key={match.cause.id} style={styles.matchRow}>
              <View
                style={[styles.dot, { backgroundColor: severityColor(match.cause.severity) }]}
              />
              <Text style={styles.causeLabel} numberOfLines={1}>
                {match.cause.label}
              </Text>
              <Text style={styles.confidence}>
                {index === 0 ? `${Math.round(match.confidence * 100)}%` : ''}
              </Text>
            </View>
          ))}
          {record.matches.length > 3 && (
            <Text style={styles.more}>+{record.matches.length - 3} more</Text>
          )}
        </>
      ) : (
        <Text style={styles.noMatch}>No clear match found at the time</Text>
      )}

      <View style={styles.chevronRow}>
        <Text style={styles.details}>View details</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
    </Pressable>
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
  list: {
    padding: spacing(4),
    paddingBottom: spacing(8),
  },
  listEmpty: {
    flexGrow: 1,
  },
  headerText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing(3),
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    marginBottom: spacing(3),
  },
  cardPressed: {
    backgroundColor: colors.surfaceRaised,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing(2),
    gap: spacing(2),
  },
  date: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  source: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginTop: spacing(1),
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  causeLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  confidence: {
    ...typography.mono,
    color: colors.textSecondary,
  },
  more: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing(2),
    marginLeft: spacing(4),
  },
  noMatch: {
    ...typography.body,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  chevronRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing(1),
    marginTop: spacing(3),
  },
  details: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
