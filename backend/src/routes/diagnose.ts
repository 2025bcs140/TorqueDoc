import { Router } from 'express';
import {
  getAllCauses,
  getAllSymptoms,
  getVehicleById,
  recordDiagnosis,
} from '../db';
import { badRequest, isPlainObject, notFound, requireVehicleType } from '../http';
import { diagnose, findUnknownSymptomIds } from '../services/diagnosisEngine';
import { DiagnosisSource, VehicleType } from '../types';

const router = Router();

const VALID_SOURCES: DiagnosisSource[] = ['checklist', 'free_text', 'media'];
const MAX_SYMPTOMS = 60;

function parseSymptomIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw badRequest('symptomIds must be an array of symptom ids');
  }
  if (value.length === 0) {
    throw badRequest('Select at least one symptom');
  }
  if (value.length > MAX_SYMPTOMS) {
    throw badRequest(`symptomIds may contain at most ${MAX_SYMPTOMS} entries`);
  }
  if (value.some((id) => typeof id !== 'string' || id.trim().length === 0)) {
    throw badRequest('symptomIds must contain only non-empty strings');
  }

  const unique = [...new Set(value as string[])];
  if (unique.length !== value.length) {
    throw badRequest('symptomIds contains duplicate ids');
  }
  return unique;
}

function parseSource(value: unknown): DiagnosisSource {
  if (value === undefined) return 'checklist';
  if (typeof value !== 'string' || !VALID_SOURCES.includes(value as DiagnosisSource)) {
    throw badRequest(`source must be one of: ${VALID_SOURCES.join(', ')}`);
  }
  return value as DiagnosisSource;
}

router.post('/diagnose', (req, res) => {
  if (!isPlainObject(req.body)) throw badRequest('Request body must be a JSON object');

  const vehicleType: VehicleType = requireVehicleType(req.body.vehicleType);
  const symptomIds = parseSymptomIds(req.body.symptomIds);
  const source = parseSource(req.body.source);
  const vehicleId = req.body.vehicleId;

  if (vehicleId !== undefined && (typeof vehicleId !== 'string' || vehicleId.length === 0)) {
    throw badRequest('vehicleId must be a non-empty string when provided');
  }

  const catalog = { symptoms: getAllSymptoms(), causes: getAllCauses() };

  const unknownIds = findUnknownSymptomIds(symptomIds, vehicleType, catalog);
  if (unknownIds.length > 0) {
    throw badRequest(
      `Unknown symptom id(s) for a ${vehicleType}: ${unknownIds.join(', ')}`,
      { unknownSymptomIds: unknownIds }
    );
  }

  let diagnosedVehicleId: string | undefined;
  if (typeof vehicleId === 'string') {
    const vehicle = getVehicleById(vehicleId);
    if (!vehicle) throw notFound('vehicleId provided but no matching vehicle was found');
    if (vehicle.type !== vehicleType) {
      throw badRequest(
        `vehicleId belongs to a ${vehicle.type}, but vehicleType is ${vehicleType}`,
        { vehicleType: vehicle.type }
      );
    }
    diagnosedVehicleId = vehicle.id;
  }

  const matches = diagnose(symptomIds, vehicleType, catalog);

  const record = diagnosedVehicleId
    ? recordDiagnosis(diagnosedVehicleId, source, symptomIds, matches)
    : undefined;

  res.json({
    matches,
    // Present only when the diagnosis was logged against a saved vehicle, so
    // the client can deep-link to the history entry.
    diagnosisId: record?.id ?? null,
  });
});

export default router;
