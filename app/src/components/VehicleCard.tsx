import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Vehicle } from '../types';
import { colors, radii, spacing, typography } from '../theme/tokens';

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
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={22} color={colors.accent} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.mileage.toLocaleString()} mi
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
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
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing(3),
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
    marginTop: 2,
  },
});
