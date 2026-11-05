import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, TabParamList } from '../navigation/types';
import { useVehicles } from '../store/VehicleContext';
import { useAuth } from '../store/AuthContext';
import { VehicleCard } from '../components/VehicleCard';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import {
  colors,
  gradients,
  radii,
  shadows,
  spacing,
  touchTarget,
  typography,
} from '../theme/tokens';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Garage'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function GarageScreen({ navigation }: Props) {
  const { vehicles, loading, error, refresh } = useVehicles();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const firstName = user?.displayName.split(' ')[0] || 'driver';

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing(3) }]}>
      <FlatList
        data={vehicles}
        keyExtractor={(vehicle) => vehicle.id}
        contentContainerStyle={[
          styles.list,
          vehicles.length === 0 && styles.listEmpty,
          { paddingBottom: insets.bottom + spacing(8) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListHeaderComponent={
          <>
            <LinearGradient
              colors={gradients.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <View pointerEvents="none" style={styles.heroOrb} />
              <View style={styles.heroTop}>
                <View style={styles.brandRow}>
                  <View style={styles.brandMark}>
                    <Ionicons name="speedometer" size={18} color={colors.background} />
                  </View>
                  <Text style={styles.brand}>TORQUEDOC</Text>
                </View>
                <Pressable
                  onPress={() => void signOut()}
                  style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Sign out"
                >
                  <Ionicons name="log-out-outline" size={18} color={colors.textSecondary} />
                </Pressable>
              </View>

              <Text style={styles.greeting}>Welcome back, {firstName}.</Text>
              <Text style={styles.heroSub}>
                {vehicles.length === 0
                  ? 'Add your first car or motorcycle to start diagnosing.'
                  : `${vehicles.length} ${vehicles.length === 1 ? 'vehicle' : 'vehicles'} ready for a health check.`}
              </Text>

              <View style={styles.heroStats}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{vehicles.length}</Text>
                  <Text style={styles.statLabel}>In garage</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Ionicons name="sparkles-outline" size={18} color={colors.accent} />
                  <Text style={styles.statLabel}>AI-assisted</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
                  <Text style={styles.statLabel}>Private</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={styles.sectionHead}>
              <View>
                <Text style={styles.sectionEyebrow}>YOUR GARAGE</Text>
                <Text style={styles.sectionTitle}>Vehicles</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
                onPress={() => navigation.navigate('AddVehicle')}
                accessibilityRole="button"
                accessibilityLabel="Add a vehicle"
              >
                <Ionicons name="add" size={22} color={colors.background} />
                <Text style={styles.addLabel}>Add</Text>
              </Pressable>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <VehicleCard
            vehicle={item}
            onPress={() => navigation.navigate('VehicleDetail', { vehicleId: item.id })}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.accent} style={styles.loader} />
          ) : !error ? (
            <EmptyState
              icon="car-sport-outline"
              title="Your garage is empty"
              message="Add a car or motorcycle to start diagnosing issues and keeping a repair history."
              actionLabel="Add your first vehicle"
              onAction={() => navigation.navigate('AddVehicle')}
            />
          ) : null
        }
      />

      {error && (
        <View style={styles.errorWrap}>
          <ErrorBanner message={error} onRetry={refresh} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    paddingHorizontal: spacing(4),
  },
  listEmpty: {
    flexGrow: 1,
  },
  hero: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.16)',
    padding: spacing(5),
    marginBottom: spacing(6),
    overflow: 'hidden',
    ...shadows.card,
  },
  heroOrb: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -80,
    top: -100,
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(5),
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
  },
  brandMark: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    ...typography.eyebrow,
    color: colors.textPrimary,
    fontSize: 11,
    letterSpacing: 2,
  },
  signOut: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 13, 19, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  greeting: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing(1),
  },
  heroSub: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    maxWidth: 300,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing(5),
    backgroundColor: 'rgba(8, 13, 19, 0.32)',
    borderRadius: radii.md,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(3),
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: spacing(1),
  },
  statValue: {
    ...typography.subheading,
    color: colors.accent,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(3),
  },
  sectionEyebrow: {
    ...typography.eyebrow,
    color: colors.textMuted,
    fontSize: 9,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingHorizontal: spacing(3),
    height: touchTarget - 4,
    ...shadows.glow,
  },
  addLabel: {
    ...typography.caption,
    color: colors.background,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.82,
  },
  loader: {
    marginTop: spacing(8),
  },
  errorWrap: {
    position: 'absolute',
    left: spacing(4),
    right: spacing(4),
    bottom: spacing(4),
  },
});
