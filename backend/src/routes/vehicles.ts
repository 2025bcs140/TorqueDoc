import { Router } from 'express';
import {
  createVehicle,
  deleteVehicle,
  getDiagnosisHistoryForVehicle,
  getVehicleById,
  listVehicles,
  updateVehicle,
  VehiclePatch,
} from '../db';
import {
  badRequest,
  isPlainObject,
  notFound,
  optionalInt,
  optionalNullableString,
  optionalString,
  parseLimit,
  requireInt,
  requireString,
  requireVehicleType,
} from '../http';
import { VehicleType } from '../types';

const router = Router();

const MIN_YEAR = 1886; // the first practical automobile
const MAX_MILEAGE = 2_000_000;

function maxYear(): number {
  return new Date().getFullYear() + 1;
}

interface CreateVehicleBody {
  type: VehicleType;
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
}

function parseCreateBody(body: unknown): CreateVehicleBody {
  if (!isPlainObject(body)) throw badRequest('Request body must be a JSON object');

  const allowed = new Set(['type', 'nickname', 'make', 'model', 'year', 'mileage']);
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw badRequest(`Unknown field(s): ${unknown.join(', ')}`, { allowed: [...allowed] });
  }

  return {
    type: requireVehicleType(body.type, 'type'),
    nickname: optionalNullableString(body.nickname, 'nickname', { max: 60 }) ?? null,
    make: requireString(body.make, 'make', { max: 60 }),
    model: requireString(body.model, 'model', { max: 60 }),
    year: requireInt(body.year, 'year', { min: MIN_YEAR, max: maxYear() }),
    mileage: requireInt(body.mileage, 'mileage', { min: 0, max: MAX_MILEAGE }),
  };
}

function parsePatchBody(body: unknown): VehiclePatch {
  if (!isPlainObject(body)) throw badRequest('Request body must be a JSON object');

  const patch: VehiclePatch = {
    type: body.type === undefined ? undefined : requireVehicleType(body.type, 'type'),
    nickname: optionalNullableString(body.nickname, 'nickname', { max: 60 }),
    make: optionalString(body.make, 'make', { max: 60 }),
    model: optionalString(body.model, 'model', { max: 60 }),
    year: optionalInt(body.year, 'year', { min: MIN_YEAR, max: maxYear() }),
    mileage: optionalInt(body.mileage, 'mileage', { min: 0, max: MAX_MILEAGE }),
  };

  const hasChange = Object.values(patch).some((value) => value !== undefined);

  // Reject unknown keys instead of silently ignoring a typo like "milage".
  const allowed = new Set(['type', 'nickname', 'make', 'model', 'year', 'mileage']);
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw badRequest(`Unknown field(s): ${unknown.join(', ')}`, { allowed: [...allowed] });
  }

  if (!hasChange) {
    throw badRequest(
      'Provide at least one field to update: type, nickname, make, model, year or mileage'
    );
  }

  return patch;
}

router.get('/', (_req, res) => {
  res.json({ vehicles: listVehicles() });
});

router.post('/', (req, res) => {
  const input = parseCreateBody(req.body);
  const vehicle = createVehicle(input);
  res.status(201).json({ vehicle });
});

router.get('/:id', (req, res) => {
  const vehicle = getVehicleById(req.params.id);
  if (!vehicle) throw notFound('Vehicle not found');
  res.json({ vehicle });
});

router.patch('/:id', (req, res) => {
  const existing = getVehicleById(req.params.id);
  if (!existing) throw notFound('Vehicle not found');

  const patch = parsePatchBody(req.body);
  const merged = {
    type: patch.type ?? existing.type,
    nickname: patch.nickname === undefined ? existing.nickname : patch.nickname,
    make: patch.make ?? existing.make,
    model: patch.model ?? existing.model,
    year: patch.year ?? existing.year,
    mileage: patch.mileage ?? existing.mileage,
  };

  // Re-validate the merged object so a partial update can never produce a
  // vehicle that would have been rejected at creation time.
  if (merged.make.trim().length === 0) throw badRequest('make is required');
  if (merged.model.trim().length === 0) throw badRequest('model is required');
  if (merged.year < MIN_YEAR || merged.year > maxYear()) {
    throw badRequest(`year must be between ${MIN_YEAR} and ${maxYear()}`);
  }
  if (merged.mileage < 0 || merged.mileage > MAX_MILEAGE) {
    throw badRequest(`mileage must be between 0 and ${MAX_MILEAGE}`);
  }

  const vehicle = updateVehicle(req.params.id, patch);
  if (!vehicle) throw notFound('Vehicle not found');
  res.json({ vehicle });
});

router.delete('/:id', (req, res) => {
  const deleted = deleteVehicle(req.params.id);
  if (!deleted) throw notFound('Vehicle not found');
  res.status(204).end();
});

router.get('/:id/history', (req, res) => {
  const vehicle = getVehicleById(req.params.id);
  if (!vehicle) throw notFound('Vehicle not found');

  const limit = parseLimit(req.query.limit);
  res.json({ history: getDiagnosisHistoryForVehicle(vehicle.id, limit) });
});

export default router;
