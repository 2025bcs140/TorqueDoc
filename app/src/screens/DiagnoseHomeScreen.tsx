import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useVehicles } from '../store/VehicleContext';
import { EmptyState } from '../components/EmptyState';
import { colors, radii, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'DiagnoseHome'>;

export function DiagnoseHomeScreen({ route, navigation }: Props) {
  const { vehicleId } = route.params;
  const { getVehicle } = useVehicles();
  const vehicle = getVehicle(vehicleId);

  if (!vehicle) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="car-outline"
          title="Vehicle not found"
          message="Go back to the garage and choose a vehicle to diagnose."
          actionLabel="Back to garage"
          onAction={() => navigation.navigate('Main', { screen: 'Garage' })}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>
        {vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`} · {vehicle.year}
      </Text>
      <Text style={styles.title}>How do you want to describe the problem?</Text>

      <Option
        icon="list-outline"
        label="Symptom checklist"
        sublabel="Tap what you're noticing — fastest, and no AI involved"
        onPress={() => navigation.navigate('SymptomChecklist', { vehicleId })}
      />
      <Option
        icon="chatbubble-ellipses-outline"
        label="Describe it in your own words"
        sublabel="AI-assisted — turns free text into matching symptoms"
        onPress={() => navigation.navigate('FreeTextSymptom', { vehicleId })}
      />
      <Option
        icon="camera-outline"
        label="Take a photo or video"
        sublabel="AI-assisted — for leaks, warning lights, worn parts or smoke"
        onPress={() => navigation.navigate('CameraCapture', { vehicleId })}
      />
      <Option
        icon="bluetooth-outline"
        label="Connect an OBD-II reader"
        sublabel="Coming soon — live fault codes over Bluetooth"
        onPress={() => undefined}
        disabled
      />

      <View style={styles.privacyNote}>
        <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
        <Text style={styles.privacyText}>
          AI options send your description or media to Anthropic through this app’s backend. The
          API key never leaves the server. The symptom checklist stays entirely local to your
          backend.
        </Text>
      </View>
    </ScrollView>
  );
}

function Option(props: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={props.disabled ? undefined : props.onPress}
      disabled={props.disabled}
      style={({ pressed }) => [
        styles.option,
        props.disabled && styles.optionDisabled,
        pressed && !props.disabled && styles.optionPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(props.disabled) }}
      accessibilityLabel={props.label}
      accessibilityHint={props.disabled ? props.sublabel : `${props.sublabel}. Opens the next screen.`}
    >
      <Ionicons name={props.icon} size={22} color={colors.accent} />
      <View style={styles.optionText}>
        <Text style={styles.optionLabel}>{props.label}</Text>
        <Text style={styles.optionSublabel}>{props.sublabel}</Text>
      </View>
      {!props.disabled && (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing(4),
    paddingBottom: spacing(8),
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
    marginBottom: spacing(5),
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    marginBottom: spacing(3),
    gap: spacing(3),
  },
  optionPressed: {
    backgroundColor: colors.surfaceRaised,
  },
  optionDisabled: {
    opacity: 0.45,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
  optionSublabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  privacyNote: {
    flexDirection: 'row',
    gap: spacing(2),
    marginTop: spacing(4),
    padding: spacing(3),
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  privacyText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
});
