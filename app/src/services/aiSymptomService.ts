import { AI_TIMEOUT_MS, apiFetch } from './apiClient';
import { VehicleType } from '../types';

export interface AiSymptomResult {
  matchedSymptomIds: string[];
  summary: string;
}

/**
 * Sends a free-text description to the backend, which asks Claude to map it
 * onto the known symptom taxonomy. The API key lives only on the server — this
 * is a plain JSON request like any other service in the app.
 */
export async function interpretFreeTextSymptom(
  vehicleType: VehicleType,
  description: string
): Promise<AiSymptomResult> {
  return apiFetch<AiSymptomResult>(
    '/v1/symptoms/interpret',
    {
      method: 'POST',
      body: JSON.stringify({ vehicleType, description }),
    },
    { timeoutMs: AI_TIMEOUT_MS }
  );
}
