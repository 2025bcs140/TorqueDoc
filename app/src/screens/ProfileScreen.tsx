import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, TabParamList } from '../navigation/types';
import { useAuth } from '../store/AuthContext';
import { useVehicles } from '../store/VehicleContext';
import { ProfileActivity, ProfileData, fetchProfile } from '../services/profileService';
import { ErrorBanner } from '../components/ErrorBanner';
import { isMachineType, vehicleTypeLabel } from '../types';
import {
  colors,
  gradients,
  radii,
  shadows,
  sourceLabel,
  spacing,
  typography,
} from '../theme/tokens';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Profile'>,
  NativeStackScreenProps<RootStackParamList>
>;

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function memberSince(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function relativeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function activityIcon(activity: ProfileActivity): keyof typeof Ionicons.glyphMap {
  if (isMachineType(activity.vehicleType)) {
    return activity.vehicleType === 'lifting_machine'
      ? 'arrow-up-circle-outline'
      : 'construct-outline';
  }
  return activity.vehicleType === 'car' ? 'car-sport-outline' : 'bicycle-outline';
}

function statusCopy(status: ProfileData['status']): { label: string; text: string } {
  switch (status) {
    case 'active':
      return { label: 'In the bay', text: 'You have a diagnosis from the last seven days.' };
    case 'idle':
      return { label: 'Ready', text: 'Your garage is quiet. A fresh check-up is one tap away.' };
    case 'new':
      return { label: 'New workshop', text: 'Run your first diagnosis to start your service record.' };
  }
}

export function ProfileScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const { refresh: refreshGarage } = useVehicles();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setData(await fetchProfile());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your profile.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(data ? 'refresh' : 'initial');
      // Refresh when the tab is focused; `data` only chooses the spinner mode.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, Boolean(data)])
  );

  const handleRefresh = async () => {
    await Promise.all([load('refresh'), refreshGarage()]);
  };

  const shareReferral = async () => {
    if (!data) return;
    const message = `Join me on TorqueDoc - a private garage and repair assistant for cars, motorcycles and workshop machines. Use my code ${data.referral.code}: ${data.referral.url}`;

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(data.referral.url);
        Alert.alert('Link copied', 'Your referral link is on the clipboard.');
        return;
      } catch {
        // Fall back to the share sheet or a visible link.
      }
    }

    try {
      await Share.share({ message, url: data.referral.url });
    } catch {
      Alert.alert('Referral link', data.referral.url);
    }
  };

  const confirmSignOut = () => {
    const message =
      'Your garage and history stay safe in the cloud. You can sign back in anytime.';

    // React Native Web's Alert implementation does not render action buttons, so
    // use the browser confirmation and sign out directly instead of getting stuck.
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || window.confirm(`Sign out?\n\n${message}`)) {
        void signOut();
      }
      return;
    }

    Alert.alert('Sign out?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  if (loading && !data) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.loadingText}>Loading your workshop...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + spacing(4) }]}>
        <View style={styles.errorWrap}>
          <ErrorBanner message={error ?? 'Could not load your profile.'} onRetry={() => void load()} />
        </View>
      </View>
    );
  }

  const status = statusCopy(data.status);
  const displayName = data.user.displayName || user?.displayName || 'TorqueDoc user';
  const stats = data.stats;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing(3), paddingBottom: insets.bottom + spacing(8) },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void handleRefresh()}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
    >
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View pointerEvents="none" style={styles.heroOrb} />
        <View style={styles.heroTop}>
          <Text style={styles.eyebrow}>MY WORKSHOP</Text>
          <View style={styles.syncBadge}>
            <Ionicons
              name={data.storage === 'postgres' ? 'cloud-done-outline' : 'server-outline'}
              size={13}
              color={data.storage === 'postgres' ? colors.success : colors.accent}
            />
            <Text style={styles.syncText}>
              {data.storage === 'postgres' ? 'Cloud sync' : 'Local data'}
            </Text>
          </View>
        </View>

        <View style={styles.identityRow}>
          <LinearGradient colors={gradients.accent} style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(displayName) || 'TD'}</Text>
          </LinearGradient>
          <View style={styles.identityCopy}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.email}>{data.user.email}</Text>
            <View style={styles.memberRow}>
              <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
              <Text style={styles.memberText}>Member since {memberSince(data.user.createdAt)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statusRow}>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusLabel}>{status.label}</Text>
          </View>
          <Text style={styles.statusText}>{status.text}</Text>
        </View>
      </LinearGradient>

      <View style={styles.statsRow}>
        <Stat value={stats.assets} label="Assets" icon="albums-outline" />
        <View style={styles.statDivider} />
        <Stat value={stats.diagnoses} label="Diagnoses" icon="pulse-outline" />
        <View style={styles.statDivider} />
        <Stat value={stats.diagnosesThisMonth} label="This month" icon="calendar-outline" />
      </View>

      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.sectionEyebrow}>ONGOING ACTIVITY</Text>
          <Text style={styles.sectionTitle}>Latest work</Text>
        </View>
        {data.latestActivity && (
          <Pressable
            onPress={() => navigation.navigate('History', { vehicleId: data.latestActivity!.vehicleId })}
            style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Open full history"
          >
            <Text style={styles.textButtonLabel}>History</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.accent} />
          </Pressable>
        )}
      </View>

      {data.latestActivity ? (
        <LatestActivityCard
          activity={data.latestActivity}
          onPress={() =>
            navigation.navigate('HistoryDetail', { diagnosisId: data.latestActivity!.id })
          }
        />
      ) : (
        <View style={styles.emptyActivity}>
          <View style={styles.emptyIcon}>
            <Ionicons name="pulse-outline" size={22} color={colors.accent} />
          </View>
          <View style={styles.emptyCopy}>
            <Text style={styles.emptyTitle}>No diagnoses yet</Text>
            <Text style={styles.emptyText}>
              Choose an asset in the garage and run the checklist, describe the problem, or
              record a sound.
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Main', { screen: 'Garage' })}
            style={({ pressed }) => [styles.smallAction, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Open garage"
          >
            <Text style={styles.smallActionText}>Open garage</Text>
          </Pressable>
        </View>
      )}

      {data.recentActivity.length > 1 && (
        <>
          <View style={styles.sectionHead}>
            <View>
              <Text style={styles.sectionEyebrow}>SERVICE RECORD</Text>
              <Text style={styles.sectionTitle}>Recent activity</Text>
            </View>
          </View>
          <View style={styles.activityList}>
            {data.recentActivity.slice(1, 6).map((activity) => (
              <Pressable
                key={activity.id}
                onPress={() => navigation.navigate('HistoryDetail', { diagnosisId: activity.id })}
                style={({ pressed }) => [styles.activityRow, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`${activity.vehicleName}, ${relativeDate(activity.createdAt)}`}
              >
                <View style={styles.activityIcon}>
                  <Ionicons name={activityIcon(activity)} size={18} color={colors.primaryLight} />
                </View>
                <View style={styles.activityCopy}>
                  <Text style={styles.activityName} numberOfLines={1}>
                    {activity.vehicleName}
                  </Text>
                  <Text style={styles.activityMeta} numberOfLines={1}>
                    {vehicleTypeLabel(activity.vehicleType)} / {sourceLabel(activity.source)} /{' '}
                    {relativeDate(activity.createdAt)}
                  </Text>
                  {activity.topCause && (
                    <Text style={styles.activityCause} numberOfLines={1}>
                      {activity.topCause.label}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </>
      )}

      <LinearGradient
        colors={['#2B1E07', '#1B2230']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.referralCard}
      >
        <View style={styles.referralTop}>
          <View style={styles.referralIcon}>
            <Ionicons name="people-outline" size={20} color={colors.accent} />
          </View>
          <View style={styles.referralCopy}>
            <Text style={styles.referralTitle}>Invite your crew</Text>
            <Text style={styles.referralText}>
              Share TorqueDoc with another driver or workshop. Your code is tied to this account.
            </Text>
          </View>
        </View>
        <View style={styles.referralCodeRow}>
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>YOUR CODE</Text>
            <Text style={styles.code}>{data.referral.code}</Text>
          </View>
          <Pressable
            onPress={() => void shareReferral()}
            style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Share referral link"
          >
            <Ionicons name="share-social-outline" size={17} color={colors.background} />
            <Text style={styles.shareLabel}>Share</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <View style={styles.accountCard}>
        <Text style={styles.accountTitle}>Account</Text>
        <AccountRow icon="mail-outline" label="Email" value={data.user.email} />
        <AccountRow
          icon="server-outline"
          label="Storage"
          value={
            data.storage === 'postgres'
              ? 'Postgres cloud database'
              : 'Local SQLite (development)'
          }
        />
        <AccountRow
          icon="shield-checkmark-outline"
          label="Privacy"
          value="Private to this account"
        />
      </View>

      <Pressable
        onPress={confirmSignOut}
        style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>

      <Text style={styles.footer}>TORQUEDOC / PRIVATE GARAGE + REPAIR ASSISTANT</Text>

      {error && (
        <View style={styles.inlineError}>
          <ErrorBanner message={error} onRetry={() => void handleRefresh()} />
        </View>
      )}
    </ScrollView>
  );
}

function Stat({
  value,
  label,
  icon,
}: {
  value: number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={16} color={colors.accent} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function LatestActivityCard({
  activity,
  onPress,
}: {
  activity: ProfileActivity;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.latestCard, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open latest diagnosis for ${activity.vehicleName}`}
    >
      <View style={styles.latestRail} />
      <View style={styles.latestTop}>
        <View style={styles.latestIcon}>
          <Ionicons name={activityIcon(activity)} size={22} color={colors.accent} />
        </View>
        <View style={styles.latestCopy}>
          <Text style={styles.latestName}>{activity.vehicleName}</Text>
          <Text style={styles.latestMeta}>
            {vehicleTypeLabel(activity.vehicleType)} / {sourceLabel(activity.source)} /{' '}
            {relativeDate(activity.createdAt)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>

      {activity.topCause ? (
        <View style={styles.latestFinding}>
          <View style={styles.findingHead}>
            <Text style={styles.findingEyebrow}>TOP FINDING</Text>
            <Text style={styles.findingConfidence}>
              {Math.round(activity.topCause.confidence * 100)}% match
            </Text>
          </View>
          <Text style={styles.findingLabel}>{activity.topCause.label}</Text>
          <Text style={styles.findingMeta}>
            {activity.symptomCount} {activity.symptomCount === 1 ? 'symptom' : 'symptoms'} checked
          </Text>
        </View>
      ) : (
        <Text style={styles.latestNoFinding}>No ranked cause was saved for this run.</Text>
      )}
    </Pressable>
  );
}

function AccountRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.accountRow}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.accountLabel}>{label}</Text>
      <Text style={styles.accountValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', gap: spacing(3) },
  loadingText: { ...typography.caption, color: colors.textMuted },
  content: { paddingHorizontal: spacing(4) },
  hero: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.16)',
    padding: spacing(5),
    overflow: 'hidden',
    ...shadows.card,
  },
  heroOrb: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    right: -90,
    top: -120,
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(4),
  },
  eyebrow: { ...typography.eyebrow, color: colors.accent, fontSize: 9 },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    backgroundColor: 'rgba(8, 13, 19, 0.42)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  syncText: { ...typography.caption, color: colors.textSecondary, fontSize: 10 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(4) },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glow,
  },
  avatarText: { ...typography.heading, color: colors.background, fontSize: 25 },
  identityCopy: { flex: 1 },
  name: { ...typography.heading, color: colors.textPrimary },
  email: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    marginTop: spacing(2),
  },
  memberText: { ...typography.caption, color: colors.textMuted, fontSize: 10 },
  statusRow: {
    marginTop: spacing(4),
    paddingTop: spacing(4),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.09)',
    gap: spacing(2),
  },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: 'rgba(52, 211, 153, 0.13)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1) + 1,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  statusLabel: { ...typography.caption, color: colors.success, fontWeight: '700' },
  statusText: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing(3),
    paddingVertical: spacing(4),
  },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { ...typography.heading, color: colors.textPrimary },
  statLabel: { ...typography.caption, color: colors.textMuted, fontSize: 10 },
  statDivider: { width: 1, height: 34, backgroundColor: colors.border },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing(6),
    marginBottom: spacing(3),
  },
  sectionEyebrow: { ...typography.eyebrow, color: colors.textMuted, fontSize: 9 },
  sectionTitle: { ...typography.heading, color: colors.textPrimary, marginTop: 2 },
  textButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    paddingVertical: spacing(1),
  },
  textButtonLabel: { ...typography.caption, color: colors.accent, fontWeight: '600' },
  latestCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    overflow: 'hidden',
  },
  latestRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.accent,
  },
  latestTop: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  latestIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  latestCopy: { flex: 1 },
  latestName: { ...typography.subheading, color: colors.textPrimary },
  latestMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  latestFinding: {
    marginTop: spacing(4),
    paddingTop: spacing(3),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  findingHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  findingEyebrow: { ...typography.eyebrow, color: colors.textMuted, fontSize: 8 },
  findingConfidence: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
    fontSize: 10,
  },
  findingLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
    marginTop: spacing(1),
  },
  findingMeta: { ...typography.caption, color: colors.textMuted, marginTop: spacing(1) },
  latestNoFinding: { ...typography.caption, color: colors.textMuted, marginTop: spacing(3) },
  emptyActivity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing(4),
  },
  emptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: { flex: 1 },
  emptyTitle: { ...typography.subheading, color: colors.textPrimary },
  emptyText: { ...typography.caption, color: colors.textMuted, lineHeight: 17, marginTop: 2 },
  smallAction: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  smallActionText: { ...typography.caption, color: colors.background, fontWeight: '700', fontSize: 10 },
  activityList: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    padding: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  activityIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCopy: { flex: 1 },
  activityName: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  activityMeta: { ...typography.caption, color: colors.textMuted, marginTop: 1, fontSize: 10 },
  activityCause: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  referralCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 176, 32, 0.22)',
    padding: spacing(4),
    marginTop: spacing(6),
  },
  referralTop: { flexDirection: 'row', gap: spacing(3) },
  referralIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 176, 32, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  referralCopy: { flex: 1 },
  referralTitle: { ...typography.subheading, color: colors.textPrimary },
  referralText: { ...typography.caption, color: colors.textSecondary, lineHeight: 17, marginTop: 2 },
  referralCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginTop: spacing(4),
  },
  codeBox: {
    flex: 1,
    backgroundColor: 'rgba(8, 13, 19, 0.48)',
    borderRadius: radii.md,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  codeLabel: { ...typography.eyebrow, color: colors.textMuted, fontSize: 8 },
  code: {
    ...typography.mono,
    color: colors.accent,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 1,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
  },
  shareLabel: { ...typography.caption, color: colors.background, fontWeight: '700' },
  accountCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    marginTop: spacing(4),
    gap: spacing(3),
  },
  accountTitle: { ...typography.subheading, color: colors.textPrimary, marginBottom: spacing(1) },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  accountLabel: { ...typography.caption, color: colors.textMuted, width: 58 },
  accountValue: {
    flex: 1,
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    marginTop: spacing(4),
    paddingVertical: spacing(3),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.35)',
    backgroundColor: 'rgba(251, 113, 133, 0.06)',
  },
  signOutText: { ...typography.body, color: colors.danger, fontWeight: '600' },
  footer: {
    ...typography.eyebrow,
    color: colors.textMuted,
    fontSize: 8,
    textAlign: 'center',
    marginTop: spacing(6),
    letterSpacing: 1.2,
  },
  inlineError: { marginTop: spacing(4) },
  errorWrap: { paddingHorizontal: spacing(4) },
  pressed: { opacity: 0.82 },
});
