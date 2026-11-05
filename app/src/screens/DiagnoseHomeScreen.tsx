import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useVehicles } from '../store/VehicleContext';
import { EmptyState } from '../components/EmptyState';
import {
  colors,
  gradients,
  radii,
  shadows,
  spacing,
  typography,
} from '../theme/tokens';

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

  const title = vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.vehicleCard}
      >
        <View pointerEvents="none" style={styles.vehicleOrb} />
        <View style={styles.vehicleTop}>
          <LinearGradient colors={gradients.icon} style={styles.vehicleIcon}>
            <Ionicons
              name={vehicle.type === 'car' ? 'car-sport' : 'bicycle'}
              size={22}
              color={colors.accent}
            />
          </LinearGradient>
          <View style={styles.vehicleText}>
            <Text style={styles.eyebrow}>DIAGNOSING</Text>
            <Text style={styles.vehicleTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>
          <Text style={styles.typeTag}>{vehicle.type === 'car' ? 'CAR' : 'MOTO'}</Text>
        </View>
        <Text style={styles.vehicleMeta}>
          {vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.mileage.toLocaleString()} mi
        </Text>
      </LinearGradient>

      <Text style={styles.title}>How do you want to describe the problem?</Text>
      <Text style={styles.subtitle}>
        Start with the checklist for the fastest answer, or let AI interpret a description,
        photo, video or sound.
      </Text>

      <Option
        icon="list-outline"
        label="Symptom checklist"
        sublabel="Tap what you're noticing — fastest, and no AI involved"
        onPress={() => navigation.navigate('SymptomChecklist', { vehicleId })}
        accent={colors.success}
        badge="FASTEST"
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
        icon="mic-outline"
        label="Record a sound"
        sublabel="AI-assisted — engine knock, brake squeal, chain slap or exhaust noise"
        onPress={() => navigation.navigate('AudioCapture', { vehicleId })}
        accent={colors.cyan}
        badge="NEW"
      />
      <Option
        icon="bluetooth-outline"
        label="Connect an OBD-II reader"
        sublabel="Coming soon — live fault codes over Bluetooth"
        onPress={() => undefined}
        disabled
      />

      <View style={styles.privacyNote}>
        <Ionicons name="shield-checkmark-outline" size={17} color={colors.success} />
        <Text style={styles.privacyText}>
          AI options send only the content you choose to Cloudflare Workers AI through this
          backend. Cloudflare does not train on or retain it, the API token stays server-side, and
          uploaded media is not stored after the request. Checklist answers never go to an AI provider.
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
  accent?: string;
  badge?: string;
}) {
  const tint = props.accent ?? colors.accent;
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
      accessibilityHint={
        props.disabled ? props.sublabel : `${props.sublabel}. Opens the next screen.`
      }
    >
      <LinearGradient
        colors={[`${tint}26`, `${tint}0D`]}
        style={[styles.optionIcon, { borderColor: `${tint}33` }]}
      >
        <Ionicons name={props.icon} size={21} color={tint} />
      </LinearGradient>
      <View style={styles.optionText}>
        <View style={styles.optionTitleRow}>
          <Text style={styles.optionLabel}>{props.label}</Text>
          {props.badge && (
            <Text style={[styles.optionBadge, { color: tint, borderColor: `${tint}44` }]}>
              {props.badge}
            </Text>
          )}
        </View>
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
    paddingBottom: spacing(10),
  },
  vehicleCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.16)',
    padding: spacing(4),
    marginBottom: spacing(6),
    overflow: 'hidden',
    ...shadows.card,
  },
  vehicleOrb: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    right: -50,
    top: -70,
    backgroundColor: 'rgba(255, 176, 32, 0.10)',
  },
  vehicleTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
  },
  vehicleIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 176, 32, 0.18)',
  },
  vehicleText: {
    flex: 1,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.textMuted,
    fontSize: 9,
  },
  vehicleTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
    marginTop: 2,
  },
  typeTag: {
    ...typography.eyebrow,
    color: colors.accent,
    fontSize: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 176, 32, 0.30)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
  },
  vehicleMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing(3),
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing(2),
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: spacing(5),
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    marginBottom: spacing(3),
    gap: spacing(3),
  },
  optionPressed: {
    backgroundColor: colors.surfaceRaised,
    transform: [{ scale: 0.995 }],
  },
  optionDisabled: {
    opacity: 0.4,
  },
  optionIcon: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  optionText: {
    flex: 1,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    flexWrap: 'wrap',
  },
  optionLabel: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
  optionBadge: {
    ...typography.eyebrow,
    fontSize: 8,
    letterSpacing: 0.9,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
  },
  optionSublabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 17,
  },
  privacyNote: {
    flexDirection: 'row',
    gap: spacing(2),
    marginTop: spacing(4),
    padding: spacing(3),
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  privacyText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
});
