import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DiagnosisMatch } from '../types';
import { colors, radii, severityColor, severityLabel, spacing, typography } from '../theme/tokens';

interface Props {
  match: DiagnosisMatch;
  onViewRepair: () => void;
}

/**
 * Styled like a workshop prescription slip: a colored severity stripe down
 * the side (like a highlighter mark on a work order), a torn-edge divider,
 * and the coverage readout set in monospace like a printed diagnostic value.
 *
 * "Percentage match" is deliberately explained as coverage — the share of
 * this cause's known signs the person reported — rather than implied
 * probability. See docs/ARCHITECTURE.md.
 */
export function PrescriptionCard({ match, onViewRepair }: Props) {
  const stripeColor = severityColor(match.cause.severity);
  const matchedSymptoms = match.matchedSymptoms ?? [];
  const matchedCount = match.matchedSymptomIds.length;
  const totalCount = Math.max(match.totalLinkedSymptoms ?? matchedCount, matchedCount);
  const percent = Math.round(match.confidence * 100);

  return (
    <View style={styles.card}>
      <View style={[styles.stripe, { backgroundColor: stripeColor }]} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.eyebrow}>PROBABLE CAUSE</Text>
          <Text style={styles.coverage}>
            {matchedCount} of {totalCount} signs
          </Text>
        </View>

        <Text style={styles.causeLabel}>{match.cause.label}</Text>

        <View style={styles.coverageBarRow}>
          <View style={styles.coverageTrack}>
            <View
              style={[
                styles.coverageFill,
                { width: `${Math.max(percent, 4)}%`, backgroundColor: stripeColor },
              ]}
            />
          </View>
          <Text style={styles.percent}>{percent}%</Text>
        </View>

        <View style={[styles.severityBadge, { borderColor: stripeColor }]}>
          <View style={[styles.severityDot, { backgroundColor: stripeColor }]} />
          <Text style={[styles.severityText, { color: stripeColor }]}>
            {severityLabel(match.cause.severity)}
          </Text>
        </View>

        {matchedSymptoms.length > 0 && (
          <View style={styles.signs}>
            <Text style={styles.eyebrow}>WHAT MATCHED</Text>
            {matchedSymptoms.slice(0, 5).map((symptom) => (
              <View key={symptom.id} style={styles.signRow}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={styles.signText}>{symptom.label}</Text>
              </View>
            ))}
            {matchedSymptoms.length > 5 && (
              <Text style={styles.moreSigns}>+{matchedSymptoms.length - 5} more</Text>
            )}
          </View>
        )}

        <View style={styles.tearLine} />

        <Text style={styles.eyebrow}>PRESCRIBED REPAIR</Text>
        <Pressable
          onPress={onViewRepair}
          style={({ pressed }) => [styles.repairButton, pressed && styles.repairButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel={`View repair steps for ${match.cause.label}`}
        >
          <Text style={styles.repairButtonText}>View repair steps</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing(4),
  },
  stripe: {
    width: 6,
  },
  body: {
    flex: 1,
    padding: spacing(4),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing(2),
    gap: spacing(2),
  },
  eyebrow: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  coverage: {
    ...typography.mono,
    color: colors.textSecondary,
  },
  causeLabel: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing(3),
  },
  coverageBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  coverageTrack: {
    flex: 1,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  coverageFill: {
    height: 6,
    borderRadius: radii.pill,
  },
  percent: {
    ...typography.mono,
    color: colors.textPrimary,
    minWidth: 38,
    textAlign: 'right',
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1),
  },
  severityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing(2),
  },
  severityText: {
    ...typography.caption,
    fontWeight: '600',
  },
  signs: {
    marginTop: spacing(4),
    gap: spacing(1),
  },
  signRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(2),
    marginTop: spacing(1),
  },
  signText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 17,
  },
  moreSigns: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing(1),
    marginLeft: spacing(5),
  },
  tearLine: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: colors.border,
    marginVertical: spacing(4),
  },
  repairButton: {
    marginTop: spacing(2),
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(3),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
  },
  repairButtonPressed: {
    backgroundColor: colors.primaryLight,
  },
  repairButtonText: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
});
