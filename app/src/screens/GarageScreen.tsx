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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, TabParamList } from '../navigation/types';
import { useVehicles } from '../store/VehicleContext';
import { VehicleCard } from '../components/VehicleCard';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { colors, radii, spacing, touchTarget, typography } from '../theme/tokens';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Garage'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function GarageScreen({ navigation }: Props) {
  const { vehicles, loading, error, refresh } = useVehicles();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing(4) }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Your garage</Text>
          <Text style={styles.subtitle}>
            {vehicles.length === 0
              ? 'No vehicles yet'
              : `${vehicles.length} ${vehicles.length === 1 ? 'vehicle' : 'vehicles'} ready to diagnose`}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
          onPress={() => navigation.navigate('AddVehicle')}
          accessibilityRole="button"
          accessibilityLabel="Add a vehicle"
        >
          <Ionicons name="add" size={24} color={colors.background} />
        </Pressable>
      </View>

      {error && <ErrorBanner message={error} onRetry={refresh} />}

      {loading && vehicles.length === 0 ? (
        <ActivityIndicator color={colors.accent} style={styles.loader} />
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={(vehicle) => vehicle.id}
          contentContainerStyle={[
            styles.list,
            vehicles.length === 0 && styles.listEmpty,
          ]}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />
          }
          renderItem={({ item }) => (
            <VehicleCard
              vehicle={item}
              onPress={() => navigation.navigate('VehicleDetail', { vehicleId: item.id })}
            />
          )}
          ListEmptyComponent={
            !error ? (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing(4),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing(5),
    gap: spacing(3),
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing(1),
  },
  addButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonPressed: {
    opacity: 0.8,
  },
  list: {
    paddingBottom: spacing(8),
  },
  listEmpty: {
    flexGrow: 1,
  },
  loader: {
    marginTop: spacing(10),
  },
});
