import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, TabParamList } from '../navigation/types';
import { fetchRepairGuides } from '../services/catalogService';
import { RepairGuideCard } from '../components/RepairGuideCard';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import {
  RepairGuide,
  VEHICLE_TYPES,
  VehicleType,
  vehicleTypeLabel,
} from '../types';
import { colors, radii, spacing, typography } from '../theme/tokens';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Library'>,
  NativeStackScreenProps<RootStackParamList>
>;

const FILTERS: { label: string; value: VehicleType | 'all' }[] = [
  { label: 'All assets', value: 'all' },
  ...VEHICLE_TYPES.map((type) => ({
    label: type === 'motorcycle' ? 'Motorcycles' : `${vehicleTypeLabel(type)}s`,
    value: type,
  })),
];

export function RepairLibraryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<VehicleType | 'all'>('all');
  const [query, setQuery] = useState('');
  const [allGuides, setAllGuides] = useState<RepairGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch each asset catalog and merge by guide id. Guides can apply to
      // more than one type, so de-duplicate before sorting.
      const catalogs = await Promise.all(
        VEHICLE_TYPES.map((type) => fetchRepairGuides(type))
      );
      const byId = new Map<string, RepairGuide>();
      for (const guide of catalogs.flat()) byId.set(guide.id, guide);
      setAllGuides(Array.from(byId.values()).sort((a, b) => a.title.localeCompare(b.title)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load repair guides.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const guides = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return allGuides.filter((guide) => {
      const matchesType = filter === 'all' || guide.vehicleTypes.includes(filter);
      const matchesQuery =
        normalizedQuery.length === 0 ||
        guide.title.toLowerCase().includes(normalizedQuery) ||
        guide.category.toLowerCase().includes(normalizedQuery) ||
        guide.toolsNeeded.some((tool) => tool.toLowerCase().includes(normalizedQuery));
      return matchesType && matchesQuery;
    });
  }, [allGuides, filter, query]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing(4) }]}>
      <Text style={styles.title}>Repair library</Text>
      <Text style={styles.subtitle}>
        {allGuides.length} guides - step-by-step, with tools and realistic time estimates
      </Text>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search guides or tools"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Search repair guides"
        />
        {query.length > 0 && (
          <Pressable
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => setFilter(option.value)}
            style={({ pressed }) => [
              styles.filterChip,
              filter === option.value && styles.filterChipActive,
              pressed && styles.filterChipPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === option.value }}
          >
            <Text
              style={[styles.filterText, filter === option.value && styles.filterTextActive]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.loader} />
      ) : (
        <FlatList
          data={guides}
          keyExtractor={(guide) => guide.id}
          contentContainerStyle={[
            styles.list,
            guides.length === 0 && styles.listEmpty,
          ]}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <RepairGuideCard
              guide={item}
              onPress={() =>
                navigation.navigate('RepairGuideDetail', { repairGuideId: item.id })
              }
            />
          )}
          ListEmptyComponent={
            !error ? (
              <EmptyState
                icon="book-outline"
                title="No guides match"
                message={
                  query.trim()
                    ? `Nothing matched "${query.trim()}". Try a different term or clear the search.`
                    : 'There are no guides for this asset type yet.'
                }
                actionLabel={query.trim() ? 'Clear search' : undefined}
                onAction={query.trim() ? () => setQuery('') : undefined}
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
  title: {
    ...typography.display,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing(1),
    marginBottom: spacing(4),
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(3),
    marginBottom: spacing(3),
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    ...typography.body,
    paddingVertical: spacing(3),
  },
  filterScroll: {
    flexGrow: 0,
    marginBottom: spacing(4),
  },
  filterRow: {
    gap: spacing(2),
    paddingRight: spacing(4),
  },
  filterChip: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipPressed: {
    opacity: 0.8,
  },
  filterText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.textPrimary,
    fontWeight: '600',
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
