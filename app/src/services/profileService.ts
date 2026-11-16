import { apiFetch } from './apiClient';
import { DiagnosisSource, Severity, VehicleType } from '../types';

export interface ProfileUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface ProfileActivity {
  id: string;
  vehicleId: string;
  vehicleName: string;
  vehicleType: VehicleType;
  source: DiagnosisSource;
  createdAt: string;
  symptomCount: number;
  topCause: {
    label: string;
    severity: Severity;
    confidence: number;
  } | null;
}

export interface ProfileData {
  user: ProfileUser;
  status: 'new' | 'active' | 'idle';
  stats: {
    assets: number;
    vehicles: number;
    machines: number;
    diagnoses: number;
    diagnosesThisMonth: number;
    lastDiagnosisAt: string | null;
  };
  latestActivity: ProfileActivity | null;
  recentActivity: ProfileActivity[];
  referral: {
    code: string;
    url: string;
  };
  storage: 'sqlite' | 'postgres';
}

export async function fetchProfile(): Promise<ProfileData> {
  const { profile } = await apiFetch<{ profile: ProfileData }>('/profile');
  return profile;
}
