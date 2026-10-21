import { apiFetch } from './apiClient';
import { RepairGuide, Symptom, VehicleType } from '../types';

export async function fetchSymptoms(vehicleType: VehicleType): Promise<Symptom[]> {
  const { symptoms } = await apiFetch<{ symptoms: Symptom[] }>(
    `/symptoms?vehicleType=${vehicleType}`
  );
  return symptoms;
}

export async function fetchRepairGuides(vehicleType: VehicleType): Promise<RepairGuide[]> {
  const { repairGuides } = await apiFetch<{ repairGuides: RepairGuide[] }>(
    `/repair-guides?vehicleType=${vehicleType}`
  );
  return repairGuides;
}

export async function fetchRepairGuide(id: string): Promise<RepairGuide> {
  const { repairGuide } = await apiFetch<{ repairGuide: RepairGuide }>(`/repair-guides/${id}`);
  return repairGuide;
}
