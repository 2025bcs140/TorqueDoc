import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useVehicles } from '../store/VehicleContext';
import { interpretFreeTextSymptom } from '../services/aiSymptomService';
import { runDiagnosis } from '../services/diagnosisService';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radii, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'FreeTextSymptom'>;

const MAX_LENGTH = 2_000;

const EXAMPLES = [
  'There’s a high-pitched squeal whenever I brake.',
  'It clicks rapidly and won’t start in the morning.',
  'The idle is rough and the engine sometimes stalls.',
];

export function FreeTextSymptomScreen({ route, navigation }: Props) {
  const { vehicleId } = route.params;
  const { getVehicle } = useVehicles();
  const vehicle = getVehicle(vehicleId);

  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const interpretation = await interpretFreeTextSymptom(vehicle.type, description);

      if (interpretation.matchedSymptomIds.length === 0) {
        setError(
          interpretation.summary
            ? `We understood: “${interpretation.summary}” — but couldn’t map it to a known symptom yet. Add more detail, or use the symptom checklist.`
            : 'Couldn’t match that to anything specific yet. Add more detail, or use the symptom checklist instead.'
        );
        return;
      }

      const result = await runDiagnosis(vehicle.type, interpretation.matchedSymptomIds, {
        vehicleId: vehicle.id,
        source: 'free_text',
      });

      navigation.navigate('DiagnosisResult', {
        vehicleId,
        matches: result.matches,
        source: 'free_text',
        summary: interpretation.summary,
        diagnosisId: result.diagnosisId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong getting a diagnosis.');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = description.trim().length >= 5 && !loading;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.title}>Tell us what’s happening</Text>
        <Text style={styles.hint}>
          Describe noises, smells, warning lights, or changes in how the {vehicle.type} drives.
          Plain language is fine — this is sent to Cloudflare Workers AI only when you tap the
          button, and Cloudflare doesn’t train on or retain it.
        </Text>

        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. There’s a squealing noise every time I brake, and it’s gotten louder over the last week…"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={7}
            maxLength={MAX_LENGTH}
            textAlignVertical="top"
            editable={!loading}
            accessibilityLabel="Describe the problem"
          />
          <Text style={styles.counter}>
            {description.length}/{MAX_LENGTH}
          </Text>
        </View>

        <Text style={styles.examplesLabel}>Need a starting point?</Text>
        <View style={styles.examples}>
          {EXAMPLES.map((example) => (
            <Pressable
              key={example}
              onPress={() => setDescription(example)}
              style={({ pressed }) => [styles.exampleChip, pressed && styles.exampleChipPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Use example: ${example}`}
            >
              <Text style={styles.exampleText}>{example}</Text>
            </Pressable>
          ))}
        </View>

        {error && <ErrorBanner message={error} />}

        <PrimaryButton
          label={loading ? 'Reading your description…' : 'Get diagnosis'}
          onPress={handleSubmit}
          loading={loading}
          disabled={!canSubmit}
          icon="sparkles-outline"
          style={styles.submitButton}
        />
      </ScrollView>
    </KeyboardAvoidingView>
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
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing(2),
  },
  hint: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing(4),
  },
  inputWrap: {
    marginBottom: spacing(4),
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
    color: colors.textPrimary,
    minHeight: 160,
    ...typography.body,
  },
  counter: {
    ...typography.mono,
    color: colors.textMuted,
    alignSelf: 'flex-end',
    marginTop: spacing(1),
  },
  examplesLabel: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing(2),
  },
  examples: {
    gap: spacing(2),
    marginBottom: spacing(4),
  },
  exampleChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing(3),
  },
  exampleChipPressed: {
    backgroundColor: colors.surfaceRaised,
  },
  exampleText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  submitButton: {
    marginTop: spacing(2),
  },
});
