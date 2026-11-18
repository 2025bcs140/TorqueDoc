import React, { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useVehicles } from '../store/VehicleContext';
import { VehicleType, isMachineType, vehicleTypeLabel } from '../types';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radii, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'VehicleDetail'>;

const TYPE_ICONS: Record<VehicleType, keyof typeof Ionicons.glyphMap> = {
  car: 'car-sport-outline',
  motorcycle: 'bicycle-outline',
  drilling_machine: 'construct-outline',
  milling_machine: 'cog-outline',
  lifting_machine: 'arrow-up-circle-outline',
};

export function VehicleDetailScreen({ route, navigation }: Props) {
  const { getVehicle, removeVehicle } = useVehicles();
  const vehicle = getVehicle(route.params.vehicleId);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!vehicle) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="construct-outline"
          title="Asset not found"
          message="It may have been deleted from another screen."
          actionLabel="Back to garage"
          onAction={() => navigation.navigate('Main', { screen: 'Garage' })}
        />
      </View>
    );
  }

  const title = vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`;
  const machine = isMachineType(vehicle.type);
  const assetWord = machine ? 'machine' : vehicle.type === 'motorcycle' ? 'motorcycle' : 'car';
  const usageLabel = machine ? 'Operating hours' : 'Mileage';
  const usageValue = `${vehicle.mileage.toLocaleString()} ${machine ? 'hours' : 'mi'}`;

  const confirmDelete = () => {
    const message = `This removes the ${assetWord} and its entire diagnosis history from your account. This cannot be undone.`;

    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || window.confirm(`Delete ${title}?\n\n${message}`)) {
        void handleDelete();
      }
      return;
    }

    Alert.alert(`Delete ${title}?`, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void handleDelete();
        },
      },
    ]);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await removeVehicle(vehicle.id);
      navigation.navigate('Main', { screen: 'Garage' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete the asset.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name={TYPE_ICONS[vehicle.type]} size={26} color={colors.accent} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>{vehicleTypeLabel(vehicle.type).toUpperCase()}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {vehicle.year} {vehicle.make} {vehicle.model}
          </Text>
        </View>
      </View>

      <View style={styles.specCard}>
        <Spec
          icon={TYPE_ICONS[vehicle.type]}
          label="Type"
          value={vehicleTypeLabel(vehicle.type)}
        />
        <Spec
          icon={machine ? 'timer-outline' : 'speedometer-outline'}
          label={usageLabel}
          value={usageValue}
        />
        <Spec
          icon="calendar-outline"
          label="Added"
          value={new Date(vehicle.createdAt).toLocaleDateString()}
        />
      </View>

      {error && <ErrorBanner message={error} />}

      <Text style={styles.sectionLabel}>WHAT DO YOU WANT TO DO?</Text>

      <ActionRow
        icon="pulse-outline"
        label="Diagnose a problem"
        sublabel="Checklist, words, photo/video or a recorded sound"
        onPress={() => navigation.navigate('DiagnoseHome', { vehicleId: vehicle.id })}
      />
      <ActionRow
        icon="book-outline"
        label="Repair library"
        sublabel={`Browse guides for ${machine ? 'this machine' : `this ${assetWord}`}`}
        onPress={() => navigation.navigate('Main', { screen: 'Library' })}
      />
      <ActionRow
        icon="time-outline"
        label="Diagnosis history"
        sublabel={`Past checks for this ${assetWord}`}
        onPress={() => navigation.navigate('History', { vehicleId: vehicle.id })}
      />
      <ActionRow
        icon="create-outline"
        label="Edit asset details"
        sublabel={
          machine
            ? 'Update the nickname, year or operating hours'
            : 'Update the nickname, year or current mileage'
        }
        onPress={() => navigation.navigate('AddVehicle', { vehicleId: vehicle.id })}
      />

      <View style={styles.dangerZone}>
        <Text style={styles.dangerLabel}>Danger zone</Text>
        <Text style={styles.dangerText}>
          Deleting this {assetWord} also deletes every diagnosis stored for it.
        </Text>
        <PrimaryButton
          label={machine ? 'Delete machine' : 'Delete vehicle'}
          onPress={confirmDelete}
          loading={deleting}
          variant="danger"
          icon="trash-outline"
          style={styles.deleteButton}
        />
      </View>
    </ScrollView>
  );
}

function Spec(props: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.spec}>
      <Ionicons name={props.icon} size={18} color={colors.accent} />
      <View style={styles.specCopy}>
        <Text style={styles.specLabel}>{props.label}</Text>
        <Text style={styles.specValue}>{props.value}</Text>
      </View>
    </View>
  );
}

function ActionRow(props: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityHint={props.sublabel}
    >
      <Ionicons name={props.icon} size={22} color={colors.accent} />
      <View style={styles.actionText}>
        <Text style={styles.actionLabel}>{props.label}</Text>
        <Text style={styles.actionSublabel}>{props.sublabel}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
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
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(4),
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    marginBottom: spacing(4),
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.accent,
    fontSize: 9,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    marginTop: 2,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  specCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(4),
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    marginBottom: spacing(6),
  },
  spec: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    minWidth: 110,
  },
  specCopy: {
    flexShrink: 1,
  },
  specLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  specValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing(3),
  },
  actionRow: {
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
  actionRowPressed: {
    backgroundColor: colors.surfaceRaised,
  },
  actionText: {
    flex: 1,
  },
  actionLabel: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
  actionSublabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  dangerZone: {
    marginTop: spacing(6),
    paddingTop: spacing(5),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dangerLabel: {
    ...typography.caption,
    color: colors.danger,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing(1),
  },
  dangerText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing(3),
  },
  deleteButton: {
    alignSelf: 'stretch',
  },
});
