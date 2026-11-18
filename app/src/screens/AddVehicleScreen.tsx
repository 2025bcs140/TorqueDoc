import React, { useEffect, useLayoutEffect, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useVehicles } from '../store/VehicleContext';
import { Vehicle, VehicleType, isMachineType } from '../types';
import { CatalogField } from '../components/CatalogField';
import { PrimaryButton } from '../components/PrimaryButton';
import { ErrorBanner } from '../components/ErrorBanner';
import { fetchMakes, fetchModels } from '../services/vehicleCatalogService';
import { colors, radii, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'AddVehicle'>;
type FieldKey = 'make' | 'model' | 'year' | 'mileage' | 'nickname';

const TYPE_ICONS: Record<VehicleType, keyof typeof Ionicons.glyphMap> = {
  car: 'car-sport-outline',
  motorcycle: 'bicycle-outline',
  drilling_machine: 'construct-outline',
  milling_machine: 'cog-outline',
  lifting_machine: 'arrow-up-circle-outline',
};

const TYPE_LABELS: Record<VehicleType, string> = {
  car: 'Car',
  motorcycle: 'Motorcycle',
  drilling_machine: 'Drilling',
  milling_machine: 'Milling',
  lifting_machine: 'Lifting',
};

export function AddVehicleScreen({ route, navigation }: Props) {
  const vehicleId = route.params?.vehicleId;
  const { getVehicle, loading } = useVehicles();
  const existing = vehicleId ? getVehicle(vehicleId) : undefined;

  useLayoutEffect(() => {
    navigation.setOptions({ title: vehicleId ? 'Edit asset' : 'Add asset' });
  }, [navigation, vehicleId]);

  if (vehicleId && !existing) {
    return (
      <View style={[styles.screen, styles.centered]}>
        {loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Text style={styles.notFound}>That garage asset no longer exists.</Text>
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

function maxYear(): number {
  return new Date().getFullYear() + 1;
}

function VehicleForm({ vehicle, onDone }: { vehicle?: Vehicle; onDone: () => void }) {
  const { addVehicle, editVehicle } = useVehicles();
  const isEdit = Boolean(vehicle);

  const [type, setType] = useState<VehicleType>(vehicle?.type ?? 'car');
  const [make, setMake] = useState(vehicle?.make ?? '');
  const [model, setModel] = useState(vehicle?.model ?? '');
  const [year, setYear] = useState(
    vehicle ? String(vehicle.year) : String(new Date().getFullYear())
  );
  const [mileage, setMileage] = useState(vehicle ? String(vehicle.mileage) : '');
  const [nickname, setNickname] = useState(vehicle?.nickname ?? '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [makeOptions, setMakeOptions] = useState<string[]>([]);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [makesLoading, setMakesLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [catalogSource, setCatalogSource] = useState<'nhtsa' | 'fallback' | 'builtin' | null>(
    null
  );

  useEffect(() => {
    let active = true;
    setMakesLoading(true);
    setModelOptions([]);
    void fetchMakes(type)
      .then((catalog) => {
        if (!active) return;
        setMakeOptions(catalog.makes);
        setCatalogSource(catalog.source);
      })
      .catch(() => {
        if (!active) return;
        setMakeOptions([]);
        setCatalogSource(null);
      })
      .finally(() => {
        if (active) setMakesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [type]);

  useEffect(() => {
    const yearNumber = Number(year);
    const cleanMake = make.trim();
    if (
      cleanMake.length < 2 ||
      !Number.isInteger(yearNumber) ||
      yearNumber < 1886 ||
      yearNumber > maxYear()
    ) {
      setModelOptions([]);
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      setModelsLoading(true);
      void fetchModels(type, cleanMake, yearNumber)
        .then((catalog) => {
          if (active) setModelOptions(catalog.models);
        })
        .catch(() => {
          if (active) setModelOptions([]);
        })
        .finally(() => {
          if (active) setModelsLoading(false);
        });
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [type, make, year]);

  const machine = isMachineType(type);
  const usageLabel = machine ? 'Operating hours' : 'Mileage';
  const usagePlaceholder = machine ? 'e.g. 1200' : 'e.g. 45000';

  const handleTypeChange = (next: VehicleType) => {
    if (next === type) return;
    setType(next);
    setMake('');
    setModel('');
    setMakeOptions([]);
    setModelOptions([]);
    setCatalogSource(null);
    setErrors((current) => ({ ...current, make: undefined, model: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<FieldKey, string>> = {};

    if (!make.trim()) {
      next.make = machine
        ? 'Enter the machine manufacturer (e.g. Haas).'
        : 'Enter the manufacturer (e.g. Toyota).';
    }
    if (!model.trim()) {
      next.model = machine ? 'Enter the model (e.g. VF-2).' : 'Enter the model (e.g. Corolla).';
    }

    const yearNumber = Number(year);
    if (
      !year.trim() ||
      !Number.isInteger(yearNumber) ||
      yearNumber < 1886 ||
      yearNumber > maxYear()
    ) {
      next.year = `Enter a year between 1886 and ${maxYear()}.`;
    }

    const mileageNumber = Number(mileage);
    if (
      !mileage.trim() ||
      !Number.isInteger(mileageNumber) ||
      mileageNumber < 0 ||
      mileageNumber > 2_000_000
    ) {
      next.mileage = machine
        ? 'Enter the operating hours as a whole number (0 is fine).'
        : 'Enter the current mileage as a whole number (0 is fine).';
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
      setSubmitError(error instanceof Error ? error.message : 'Failed to save the asset.');
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
        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <Ionicons name="construct-outline" size={20} color={colors.accent} />
          </View>
          <View style={styles.introCopy}>
            <Text style={styles.introTitle}>One garage, every asset</Text>
            <Text style={styles.introText}>
              Cars and motorcycles use the road-vehicle catalog. Industrial machines use the
              workshop catalog and their own symptoms and guides.
            </Text>
          </View>
        </View>

        <Text style={styles.label}>Vehicle</Text>
        <View style={styles.typeRow}>
          <TypeChip
            type="car"
            selected={type === 'car'}
            onPress={() => handleTypeChange('car')}
          />
          <TypeChip
            type="motorcycle"
            selected={type === 'motorcycle'}
            onPress={() => handleTypeChange('motorcycle')}
          />
        </View>

        <Text style={styles.label}>Workshop machine</Text>
        <View style={styles.typeRow}>
          <TypeChip
            type="drilling_machine"
            selected={type === 'drilling_machine'}
            onPress={() => handleTypeChange('drilling_machine')}
          />
          <TypeChip
            type="milling_machine"
            selected={type === 'milling_machine'}
            onPress={() => handleTypeChange('milling_machine')}
          />
          <TypeChip
            type="lifting_machine"
            selected={type === 'lifting_machine'}
            onPress={() => handleTypeChange('lifting_machine')}
          />
        </View>

        <CatalogField
          label="Make"
          value={make}
          onChangeText={setMake}
          placeholder={machine ? 'e.g. Haas' : 'e.g. Toyota'}
          options={makeOptions}
          loading={makesLoading}
          error={errors.make}
          helperText={
            catalogSource === 'builtin'
              ? 'Built-in machine catalog. You can still type any make.'
              : catalogSource === 'fallback'
                ? 'Offline list active. You can type any make or model.'
                : 'Live catalog. You can still type a value manually.'
          }
        />
        <CatalogField
          label="Model"
          value={model}
          onChangeText={setModel}
          placeholder={machine ? 'e.g. VF-2' : 'e.g. Corolla'}
          options={modelOptions}
          loading={modelsLoading}
          error={errors.model}
          helperText={
            modelOptions.length > 0
              ? `${modelOptions.length} current model${modelOptions.length === 1 ? '' : 's'} for ${year}.`
              : 'Pick a model or type your own.'
          }
        />
        <Field
          label="Year"
          value={year}
          onChangeText={setYear}
          placeholder="e.g. 2024"
          keyboardType="number-pad"
          maxLength={4}
          error={errors.year}
        />
        <Field
          label={usageLabel}
          value={mileage}
          onChangeText={setMileage}
          placeholder={usagePlaceholder}
          keyboardType="number-pad"
          maxLength={7}
          error={errors.mileage}
        />
        <Field
          label="Nickname (optional)"
          value={nickname}
          onChangeText={setNickname}
          placeholder={machine ? 'e.g. Bridgeport #2' : 'e.g. The Daily'}
          maxLength={60}
          error={errors.nickname}
          autoCapitalize="words"
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

function TypeChip({
  type,
  selected,
  onPress,
}: {
  type: VehicleType;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.typeChip,
        selected && styles.typeChipActive,
        pressed && styles.typeChipPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${TYPE_LABELS[type]} asset type`}
    >
      <Ionicons
        name={TYPE_ICONS[type]}
        size={18}
        color={selected ? colors.accent : colors.textMuted}
      />
      <Text style={[styles.typeChipText, selected && styles.typeChipTextActive]}>
        {TYPE_LABELS[type]}
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
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  notFound: { ...typography.body, color: colors.textSecondary },
  introCard: {
    flexDirection: 'row',
    gap: spacing(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing(4),
    marginBottom: spacing(5),
  },
  introIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introCopy: { flex: 1 },
  introTitle: { ...typography.subheading, color: colors.textPrimary },
  introText: { ...typography.caption, color: colors.textMuted, lineHeight: 17, marginTop: 2 },
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
    minHeight: 66,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(1),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(1),
  },
  typeChipActive: {
    backgroundColor: 'rgba(255, 176, 32, 0.10)',
    borderColor: colors.accent,
  },
  typeChipPressed: { opacity: 0.8 },
  typeChipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  typeChipTextActive: { color: colors.textPrimary, fontWeight: '700' },
  fieldWrap: { marginBottom: spacing(4) },
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
  inputError: { borderColor: colors.danger },
  errorText: { ...typography.caption, color: colors.danger, marginTop: spacing(1) },
  saveButton: { marginTop: spacing(2) },
});
