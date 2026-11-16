import { Router } from 'express';
import { requireInt, requireString, requireVehicleType } from '../http';
import { getMakesForType, getModelsForType } from '../services/vehicleCatalog';

const router = Router();

function maxYear(): number {
  return new Date().getFullYear() + 1;
}

/**
 * Make/model options for the garage form. `type` accepts every
 * VehicleType, including the three industrial machine types. The response
 * includes `source` so the app can quietly show "live catalog" vs "offline
 * list" without blocking manual entry.
 */
router.get('/makes', async (req, res) => {
  const type = requireVehicleType(req.query.type, '?type=');
  const result = await getMakesForType(type);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.json(result);
});

router.get('/models', async (req, res) => {
  const type = requireVehicleType(req.query.type, '?type=');
  const make = requireString(req.query.make, '?make=', { max: 60 });
  const year = requireInt(
    req.query.year ?? new Date().getFullYear() + 1,
    '?year=',
    { min: 1886, max: maxYear() }
  );
  const result = await getModelsForType(type, make, year);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.json(result);
});

export default router;
