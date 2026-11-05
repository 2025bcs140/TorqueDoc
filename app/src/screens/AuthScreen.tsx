import React, { useState } from 'react';
import {
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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../store/AuthContext';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, gradients, radii, shadows, spacing, typography } from '../theme/tokens';

type Mode = 'signin' | 'register';

export function AuthScreen() {
  const { signIn, register } = useAuth();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setPassword('');
  };

  const submit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (mode === 'register' && displayName.trim().length < 2) {
      setError('Tell us your name (at least 2 characters).');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (mode === 'signin') {
        await signIn(cleanEmail, password);
      } else {
        await register(displayName.trim(), cleanEmail, password);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : mode === 'signin'
            ? 'Could not sign in. Please try again.'
            : 'Could not create your account. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={gradients.app} style={styles.screen}>
      <View pointerEvents="none" style={styles.orbOne} />
      <View pointerEvents="none" style={styles.orbTwo} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing(6), paddingBottom: insets.bottom + spacing(8) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandRow}>
            <LinearGradient colors={gradients.accent} style={styles.logo}>
              <Ionicons name="speedometer" size={24} color={colors.background} />
            </LinearGradient>
            <View>
              <Text style={styles.brand}>TORQUEDOC</Text>
              <Text style={styles.brandTag}>Garage intelligence</Text>
            </View>
          </View>

          <View style={styles.hero}>
            <Text style={styles.eyebrow}>DIAGNOSE WITH CONFIDENCE</Text>
            <Text style={styles.heroTitle}>Know what your vehicle is telling you.</Text>
            <Text style={styles.heroText}>
              A private garage, a mechanic’s checklist, and AI-assisted photo, video and sound
              analysis — all in one place.
            </Text>

            <View style={styles.featureRow}>
              <Feature icon="car-sport-outline" label="Cars & bikes" />
              <Feature icon="mic-outline" label="Sound analysis" />
              <Feature icon="lock-closed-outline" label="Private garage" />
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.tabs}>
              <Pressable
                onPress={() => switchMode('signin')}
                style={[styles.tab, mode === 'signin' && styles.tabActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === 'signin' }}
              >
                <Text style={[styles.tabText, mode === 'signin' && styles.tabTextActive]}>
                  Sign in
                </Text>
              </Pressable>
              <Pressable
                onPress={() => switchMode('register')}
                style={[styles.tab, mode === 'register' && styles.tabActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === 'register' }}
              >
                <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>
                  Create account
                </Text>
              </Pressable>
            </View>

            <Text style={styles.cardTitle}>
              {mode === 'signin' ? 'Welcome back.' : 'Set up your garage.'}
            </Text>
            <Text style={styles.cardHint}>
              {mode === 'signin'
                ? 'Sign in to open your vehicles, diagnosis history and repair guides.'
                : 'Your vehicles and diagnosis history stay attached to your account.'}
            </Text>

            {mode === 'register' && (
              <Field
                icon="person-outline"
                label="Your name"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Alex"
                autoCapitalize="words"
                autoComplete="name"
              />
            )}

            <Field
              icon="mail-outline"
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Field
              icon="lock-closed-outline"
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              trailing={
                <Pressable
                  onPress={() => setShowPassword((value) => !value)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textMuted}
                  />
                </Pressable>
              }
            />

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={17} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <PrimaryButton
              label={
                loading
                  ? mode === 'signin'
                    ? 'Signing in…'
                    : 'Creating account…'
                  : mode === 'signin'
                    ? 'Open my garage'
                    : 'Create my account'
              }
              onPress={submit}
              loading={loading}
              icon={mode === 'signin' ? 'log-in-outline' : 'sparkles-outline'}
              style={styles.submit}
            />

            <View style={styles.privacyRow}>
              <Ionicons name="shield-checkmark-outline" size={15} color={colors.success} />
              <Text style={styles.privacyText}>
                Passwords are hashed on the server. TorqueDoc never sends your password to an AI
                provider.
              </Text>
            </View>
          </View>

          <Text style={styles.footer}>Cars and motorcycles only · Built for the garage</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function Feature(props: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.feature}>
      <Ionicons name={props.icon} size={14} color={colors.accent} />
      <Text style={styles.featureText}>{props.label}</Text>
    </View>
  );
}

function Field(props: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'words';
  autoComplete?: 'email' | 'name' | 'current-password' | 'new-password';
  trailing?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
        <Ionicons name={props.icon} size={18} color={focused ? colors.accent : colors.textMuted} />
        <TextInput
          style={styles.input}
          value={props.value}
          onChangeText={props.onChangeText}
          placeholder={props.placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={props.secureTextEntry}
          keyboardType={props.keyboardType}
          autoCapitalize={props.autoCapitalize}
          autoComplete={props.autoComplete}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={props.label}
        />
        {props.trailing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  orbOne: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(34, 211, 238, 0.10)',
    top: -120,
    right: -110,
  },
  orbTwo: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255, 176, 32, 0.10)',
    bottom: 40,
    left: -150,
  },
  content: {
    paddingHorizontal: spacing(5),
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    marginBottom: spacing(7),
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glow,
  },
  brand: {
    ...typography.eyebrow,
    color: colors.textPrimary,
    fontSize: 13,
    letterSpacing: 2.2,
  },
  brandTag: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  hero: {
    marginBottom: spacing(7),
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.accent,
    marginBottom: spacing(3),
  },
  heroTitle: {
    ...typography.display,
    color: colors.textPrimary,
    marginBottom: spacing(3),
  },
  heroText: {
    ...typography.body,
    color: colors.textSecondary,
    maxWidth: 470,
  },
  featureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(4),
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(17, 25, 35, 0.72)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  featureText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(17, 25, 35, 0.94)',
    padding: spacing(5),
    ...shadows.card,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.pill,
    padding: spacing(1),
    marginBottom: spacing(5),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    paddingVertical: spacing(2.5),
  },
  tabActive: {
    backgroundColor: colors.surfaceRaised,
  },
  tabText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.textPrimary,
  },
  cardTitle: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  cardHint: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: spacing(1),
    marginBottom: spacing(4),
  },
  field: {
    marginBottom: spacing(3),
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: spacing(1.5),
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing(3),
    minHeight: 50,
  },
  inputWrapFocused: {
    borderColor: colors.accent,
    backgroundColor: '#101A24',
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    ...typography.body,
    paddingVertical: spacing(3),
    outlineStyle: 'none',
  } as object,
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(2),
    backgroundColor: 'rgba(251, 113, 133, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.30)',
    borderRadius: radii.md,
    padding: spacing(3),
    marginBottom: spacing(3),
  },
  errorText: {
    ...typography.caption,
    color: '#FFB4C0',
    flex: 1,
    lineHeight: 18,
  },
  submit: {
    marginTop: spacing(1),
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(2),
    marginTop: spacing(4),
  },
  privacyText: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 17,
    flex: 1,
  },
  footer: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing(5),
  },
});
