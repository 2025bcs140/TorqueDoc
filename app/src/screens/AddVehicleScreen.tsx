import React, { useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { Vehicle, VehicleType } from '../types';
import { PrimaryButton } from '../components/PrimaryButton';
import { ErrorBanner } from '../components/ErrorBanner';
import { colors, radii, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'AddVehicle'>;
type FieldKey = 'make' | 'model' | 'year' | 'mileage' | 'nickname';

export function AddVehicleScreen({ route, navigation }: Props) {
  const vehicleId = route.params?.vehicleId;
  const { getVehicle, loading } = useVehicles();
  const existing = vehicleId ? getVehicle(vehicleId) : undefined;

  useLayoutEffect(() => {
    navigation.setOptions({ title: vehicleId ? 'Edit vehicle' : 'Add vehicle' });
  }, [navigation, vehicleId]);

  if (vehicleId && !existing) {
    return (
      <View style={[styles.screen, styles.centered]}>
        {loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Text style={styles.notFound}>That vehicle no longer exists.</Text>
        )}
      </View>
    );
  }

  return (
    <VehicleForm
      key={existing?.id ?? 'new'}
      vehicle={existing}
      onDone={() => navigation.goBack()}
    />
  );
}

function currentYear(): number {
  return new Date().getFullYear() + 1;
}

function VehicleForm({ vehicle, onDone }: { vehicle?: Vehicle; onDone: () => void }) {
  const { addVehicle, editVehicle } = useVehicles();
  const isEdit = Boolean(vehicle);

  const [type, setType] = useState<VehicleType>(vehicle?.type ?? 'car');
  const [make, setMake] = useState(vehicle?.make ?? '');
  const [model, setModel] = useState(vehicle?.model ?? '');
  const [year, setYear] = useState(vehicle ? String(vehicle.year) : '');
  const [mileage, setMileage] = useState(vehicle ? String(vehicle.mileage) : '');
  const [nickname, setNickname] = useState(vehicle?.nickname ?? '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validate = (): boolean => {
    const next: Partial<Record<FieldKey, string>> = {};

    if (!make.trim()) next.make = 'Enter the manufacturer (e.g. Toyota).';
    if (!model.trim()) next.model = 'Enter the model (e.g. Corolla).';

    const yearNumber = Number(year);
    if (
      !year.trim() ||
      !Number.isInteger(yearNumber) ||
      yearNumber < 1886 ||
      yearNumber > currentYear()
    ) {
      next.year = `Enter a year between 1886 and ${currentYear()}.`;
    }

    const mileageNumber = Number(mileage);
    if (
      !mileage.trim() ||
      !Number.isInteger(mileageNumber) ||
      mileageNumber < 0 ||
      mileageNumber > 2_000_000
    ) {
      next.mileage = 'Enter the current mileage as a whole number (0 is fine).';
    }

    if (nickname.trim().length > 60) next.nickname = 'Keep the nickname under 60 characters.';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    setSubmitError(null);
    if (!validate()) return;

    const parsedYear = Number(year);
    const parsedMileage = Number(mileage);
    const trimmedNickname = nickname.trim();

    setSaving(true);
    try {
      if (isEdit && vehicle) {
        await editVehicle(vehicle.id, {
          type,
          nickname: trimmedNickname || null,
          make: make.trim(),
          model: model.trim(),
          year: parsedYear,
          mileage: parsedMileage,
        });
      } else {
        await addVehicle({
          type,
          nickname: trimmedNickname || undefined,
          make: make.trim(),
          model: model.trim(),
          year: parsedYear,
          mileage: parsedMileage,
        });
      }
      onDone();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to save the vehicle.');
    } finally {
      setSaving(false);
    }
  };

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
        <Text style={styles.label}>Vehicle type</Text>
        <View style={styles.typeRow}>
          {(['car', 'motorcycle'] as VehicleType[]).map((option) => (
            <TypeChip
              key={option}
              label={option === 'car' ? 'Car' : 'Motorcycle'}
              selected={type === option}
              onPress={() => setType(option)}
            />
          ))}
        </View>

        <Field
          label="Nickname (optional)"
          value={nickname}
          onChangeText={setNickname}
          placeholder="e.g. The Daily"
          maxLength={60}
          error={errors.nickname}
          autoCapitalize="words"
        />
        <Field
          label="Make"
          value={make}
          onChangeText={setMake}
          placeholder="e.g. Toyota"
          maxLength={60}
          error={errors.make}
          autoCapitalize="words"
        />
        <Field
          label="Model"
          value={model}
          onChangeText={setModel}
          placeholder="e.g. Corolla"
          maxLength={60}
          error={errors.model}
          autoCapitalize="words"
        />
        <Field
          label="Year"
          value={year}
          onChangeText={setYear}
          placeholder="e.g. 2018"
          keyboardType="number-pad"
          maxLength={4}
          error={errors.year}
        />
        <Field
          label="Mileage"
          value={mileage}
          onChangeText={setMileage}
          placeholder="e.g. 45000"
          keyboardType="number-pad"
          maxLength={7}
          error={errors.mileage}
        />

        {submitError && <ErrorBanner message={submitError} />}

        <PrimaryButton
          label={isEdit ? 'Save changes' : 'Add to garage'}
          onPress={handleSave}
          loading={saving}
          style={styles.saveButton}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TypeChip(props: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.typeChip,
        props.selected && styles.typeChipActive,
        pressed && styles.typeChipPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: props.selected }}
      accessibilityLabel={`${props.label} vehicle type`}
    >
      <Text style={[styles.typeChipText, props.selected && styles.typeChipTextActive]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  error?: string;
  keyboardType?: 'default' | 'number-pad';
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={[styles.input, props.error && styles.inputError]}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={props.keyboardType ?? 'default'}
        maxLength={props.maxLength}
        autoCapitalize={props.autoCapitalize ?? 'sentences'}
        accessibilityLabel={props.label}
      />
      {props.error && <Text style={styles.errorText}>{props.error}</Text>}
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
  content: {
    padding: spacing(4),
    paddingBottom: spacing(10),
  },
  notFound: {
    ...typography.body,
    color: colors.textSecondary,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing(2),
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing(2),
    marginBottom: spacing(4),
  },
  typeChip: {
    flex: 1,
    paddingVertical: spacing(3),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    overflow: 'hidden',
  },
  typeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeChipPressed: {
    opacity: 0.8,
  },
  typeChipText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  typeChipTextActive: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  fieldWrap: {
    marginBottom: spacing(4),
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(3),
    color: colors.textPrimary,
    ...typography.body,
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing(1),
  },
  saveButton: {
    marginTop: spacing(2),
  },
});
