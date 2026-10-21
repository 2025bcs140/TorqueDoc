import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useVehicles } from '../store/VehicleContext';
import { PrescriptionCard } from '../components/PrescriptionCard';
import { EmptyState } from '../components/EmptyState';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radii, sourceLabel, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'DiagnosisResult'>;

export function DiagnosisResultScreen({ route, navigation }: Props) {
  const { vehicleId, matches, source, summary, diagnosisId } = route.params;
  const { getVehicle } = useVehicles();
  const vehicle = getVehicle(vehicleId);
  const vehicleName = vehicle?.nickname ?? (vehicle ? `${vehicle.make} ${vehicle.model}` : 'this vehicle');

  const hasUrgent = matches.some((match) => match.cause.severity === 'urgent');

  if (matches.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="search-outline"
          title="No clear match yet"
          message="Nothing in the current catalog matches strongly enough. Try adding more symptoms, or browse the repair library for what you’re seeing."
          actionLabel="Try the symptom checklist"
          onAction={() => navigation.navigate('SymptomChecklist', { vehicleId })}
        />
        <View style={styles.emptyActions}>
          <PrimaryButton
            label="Open repair library"
            onPress={() => navigation.navigate('Main', { screen: 'Library' })}
            variant="secondary"
            icon="book-outline"
          />
          <PrimaryButton
            label={`Back to ${vehicleName}`}
            onPress={() => navigation.navigate('VehicleDetail', { vehicleId })}
            variant="secondary"
          />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>
        {sourceLabel(source)} · {vehicleName}
      </Text>
      <Text style={styles.title}>
        {matches.length} probable {matches.length === 1 ? 'cause' : 'causes'} found
      </Text>
      <Text style={styles.lead}>
        Ranked by how many of each cause’s known signs you reported. Start at the top, but treat
        this as guidance rather than a confirmed diagnosis.
      </Text>

      {summary && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
            <Text style={styles.summaryLabel}>WHAT WE UNDERSTOOD</Text>
          </View>
          <Text style={styles.summaryText}>{summary}</Text>
        </View>
      )}

      {hasUrgent && (
        <View style={styles.safetyCard}>
          <Ionicons name="warning-outline" size={18} color={colors.danger} />
          <Text style={styles.safetyText}>
            At least one possible cause is safety-relevant. If you smell fuel, see smoke, or the
            brakes feel unsafe, stop driving and have the vehicle inspected by a professional.
          </Text>
        </View>
      )}

      {matches.map((match) => (
        <PrescriptionCard
          key={match.cause.id}
          match={match}
          onViewRepair={() =>
            navigation.navigate('RepairGuideDetail', {
              repairGuideId: match.cause.repairGuideId,
            })
          }
        />
      ))}

      <View style={styles.footerCard}>
        <Text style={styles.footerTitle}>What now?</Text>
        <Text style={styles.footerText}>
          Work through the highest-ranked cause first. If the repair guide is beyond your comfort
          level, or the problem returns, have a qualified mechanic confirm it.
        </Text>
        {diagnosisId && (
          <Text style={styles.savedText}>
            Saved to {vehicleName}’s diagnosis history for future reference.
          </Text>
        )}
      </View>

      <PrimaryButton
        label="Back to vehicle"
        onPress={() => navigation.navigate('VehicleDetail', { vehicleId })}
        variant="secondary"
        style={styles.backButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing(4),
    paddingBottom: spacing(10),
  },
  emptyActions: {
    padding: spacing(4),
    paddingTop: 0,
    gap: spacing(3),
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
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    marginBottom: spacing(4),
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginBottom: spacing(2),
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  summaryText: {
    ...typography.body,
    color: colors.textPrimary,
    fontStyle: 'italic',
  },
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(2),
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing(4),
    marginBottom: spacing(4),
  },
  safetyText: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 18,
  },
  footerCard: {
    marginTop: spacing(2),
    padding: spacing(4),
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  footerTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
    marginBottom: spacing(2),
  },
  footerText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  savedText: {
    ...typography.caption,
    color: colors.success,
    marginTop: spacing(3),
  },
  backButton: {
    marginTop: spacing(4),
  },
});
