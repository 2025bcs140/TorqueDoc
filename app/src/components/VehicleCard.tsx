import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Vehicle } from '../types';
import { colors, gradients, radii, shadows, spacing, typography } from '../theme/tokens';

interface Props {
  vehicle: Vehicle;
  onPress: () => void;
}

export function VehicleCard({ vehicle, onPress }: Props) {
  const icon = vehicle.type === 'car' ? 'car-sport' : 'bicycle';
  const title = vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${vehicle.year} ${vehicle.make} ${vehicle.model}, ${vehicle.mileage.toLocaleString()} miles`}
      accessibilityHint="Opens this vehicle"
    >
      <LinearGradient
        colors={gradients.card}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.accentRail} />
      <LinearGradient colors={gradients.icon} style={styles.iconWrap}>
        <Ionicons name={icon} size={23} color={colors.accent} />
      </LinearGradient>
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {vehicle.year} {vehicle.make} {vehicle.model}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.typeTag}>{vehicle.type === 'car' ? 'CAR' : 'MOTO'}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.meta}>{vehicle.mileage.toLocaleString()} mi</Text>
        </View>
      </View>
      <View style={styles.right}>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    marginBottom: spacing(3),
    overflow: 'hidden',
    ...shadows.card,
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.995 }],
  },
  accentRail: {
    position: 'absolute',
    left: 0,
    top: 16,
    bottom: 16,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: colors.accent,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing(3),
    borderWidth: 1,
    borderColor: 'rgba(255, 176, 32, 0.18)',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    marginTop: spacing(2),
  },
  typeTag: {
    ...typography.eyebrow,
    color: colors.accent,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  metaDot: {
    color: colors.textMuted,
    fontSize: 11,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  right: {
    marginLeft: spacing(2),
  },
});
