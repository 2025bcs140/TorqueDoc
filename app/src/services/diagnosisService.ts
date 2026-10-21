import { apiFetch } from './apiClient';
import {
  DiagnosisMatch,
  DiagnosisRecord,
  DiagnosisRunResult,
  DiagnosisSource,
  VehicleType,
} from '../types';

export async function runDiagnosis(
  vehicleType: VehicleType,
  symptomIds: string[],
  options?: { vehicleId?: string; source?: DiagnosisSource }
): Promise<DiagnosisRunResult> {
  const result = await apiFetch<{ matches: DiagnosisMatch[]; diagnosisId: string | null }>(
    '/diagnose',
    {
      method: 'POST',
      body: JSON.stringify({
        vehicleType,
        symptomIds,
        vehicleId: options?.vehicleId,
        source: options?.source ?? 'checklist',
      }),
    }
  );
  return { matches: result.matches, diagnosisId: result.diagnosisId ?? null };
}

export async function fetchDiagnosis(id: string): Promise<DiagnosisRecord> {
  const { diagnosis } = await apiFetch<{ diagnosis: DiagnosisRecord }>(`/diagnoses/${id}`);
  return diagnosis;
}
