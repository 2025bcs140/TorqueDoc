import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { VehicleProvider } from './src/store/VehicleContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { colors } from './src/theme/tokens';

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.accent,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <VehicleProvider>
          <NavigationContainer theme={navigationTheme}>
            <AppNavigator />
          </NavigationContainer>
          <StatusBar style="light" />
        </VehicleProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
