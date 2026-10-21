import { apiFetch } from './apiClient';
import { DiagnosisRecord, Vehicle, VehiclePatch, VehicleType } from '../types';

export interface NewVehicleInput {
  type: VehicleType;
  nickname?: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
}

export async function fetchVehicles(): Promise<Vehicle[]> {
  const { vehicles } = await apiFetch<{ vehicles: Vehicle[] }>('/vehicles');
  return vehicles;
}

export async function fetchVehicle(id: string): Promise<Vehicle> {
  const { vehicle } = await apiFetch<{ vehicle: Vehicle }>(`/vehicles/${id}`);
  return vehicle;
}

export async function createVehicle(input: NewVehicleInput): Promise<Vehicle> {
  const { vehicle } = await apiFetch<{ vehicle: Vehicle }>('/vehicles', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return vehicle;
}

export async function updateVehicle(id: string, patch: VehiclePatch): Promise<Vehicle> {
  const { vehicle } = await apiFetch<{ vehicle: Vehicle }>(`/vehicles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return vehicle;
}

/** Deletes the vehicle and its diagnosis history (cascade happens server-side). */
export async function deleteVehicle(id: string): Promise<void> {
  await apiFetch<void>(`/vehicles/${id}`, { method: 'DELETE' });
}

export async function fetchVehicleHistory(id: string, limit = 100): Promise<DiagnosisRecord[]> {
  const { history } = await apiFetch<{ history: DiagnosisRecord[] }>(
    `/vehicles/${id}/history?limit=${limit}`
  );
  return history;
}
