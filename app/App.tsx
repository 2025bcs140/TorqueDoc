import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { VehicleProvider } from './src/store/VehicleContext';
import { AuthProvider, useAuth } from './src/store/AuthContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { colors, gradients, radii, spacing, typography } from './src/theme/tokens';

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.accent,
    notification: colors.accent,
  },
};

function Root() {
  const { user, bootstrapping } = useAuth();

  if (bootstrapping) {
    return (
      <LinearGradient colors={gradients.app} style={styles.splash}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>TD</Text>
        </View>
        <Text style={styles.splashTitle}>TORQUEDOC</Text>
        <Text style={styles.splashText}>Opening your garage…</Text>
        <ActivityIndicator color={colors.accent} style={styles.spinner} />
      </LinearGradient>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <VehicleProvider>
      <NavigationContainer theme={navigationTheme}>
        <AppNavigator />
      </NavigationContainer>
      <StatusBar style="light" />
    </VehicleProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(8),
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    marginBottom: spacing(4),
  },
  logoText: {
    color: colors.background,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -1,
  },
  splashTitle: {
    ...typography.eyebrow,
    color: colors.textPrimary,
    fontSize: 14,
    letterSpacing: 3,
  },
  splashText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing(2),
  },
  spinner: {
    marginTop: spacing(5),
  },
});
