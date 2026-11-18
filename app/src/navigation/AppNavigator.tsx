import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList, TabParamList } from './types';
import { colors } from '../theme/tokens';

import { GarageScreen } from '../screens/GarageScreen';
import { RepairLibraryScreen } from '../screens/RepairLibraryScreen';
import { AddVehicleScreen } from '../screens/AddVehicleScreen';
import { VehicleDetailScreen } from '../screens/VehicleDetailScreen';
import { DiagnoseHomeScreen } from '../screens/DiagnoseHomeScreen';
import { SymptomChecklistScreen } from '../screens/SymptomChecklistScreen';
import { FreeTextSymptomScreen } from '../screens/FreeTextSymptomScreen';
import { CameraCaptureScreen } from '../screens/CameraCaptureScreen';
import { AudioCaptureScreen } from '../screens/AudioCaptureScreen';
import { DiagnosisResultScreen } from '../screens/DiagnosisResultScreen';
import { RepairGuideDetailScreen } from '../screens/RepairGuideDetailScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { HistoryDetailScreen } from '../screens/HistoryDetailScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.textPrimary,
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...screenOptions,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ color, size }: { color: string; size: number }) => {
          const icon =
            route.name === 'Garage'
              ? 'car-sport-outline'
              : route.name === 'Library'
                ? 'book-outline'
                : 'person-circle-outline';
          return <Ionicons name={icon} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Garage" component={GarageScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Library" component={RepairLibraryScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="AddVehicle" component={AddVehicleScreen} options={{ title: 'Add asset' }} />
      <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} options={{ title: '' }} />
      <Stack.Screen name="DiagnoseHome" component={DiagnoseHomeScreen} options={{ title: 'Diagnose' }} />
      <Stack.Screen name="SymptomChecklist" component={SymptomChecklistScreen} options={{ title: 'Symptom checklist' }} />
      <Stack.Screen name="FreeTextSymptom" component={FreeTextSymptomScreen} options={{ title: 'Describe the problem' }} />
      <Stack.Screen name="CameraCapture" component={CameraCaptureScreen} options={{ title: 'Capture' }} />
      <Stack.Screen name="AudioCapture" component={AudioCaptureScreen} options={{ title: 'Record a sound' }} />
      <Stack.Screen name="DiagnosisResult" component={DiagnosisResultScreen} options={{ title: 'Diagnosis' }} />
      <Stack.Screen name="RepairGuideDetail" component={RepairGuideDetailScreen} options={{ title: 'Repair guide' }} />
      <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'Service history' }} />
      <Stack.Screen name="HistoryDetail" component={HistoryDetailScreen} options={{ title: 'Service record' }} />
    </Stack.Navigator>
  );
}
