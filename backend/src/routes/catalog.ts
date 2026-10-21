import { Router } from 'express';
import {
  getAllRepairGuides,
  getAllSymptoms,
  getRepairGuideById,
  getRepairGuidesForVehicleType,
  getSymptomsForVehicleType,
} from '../db';
import { notFound, requireVehicleType } from '../http';

const router = Router();

router.get('/symptoms', (req, res) => {
  const vehicleType = requireVehicleType(req.query.vehicleType, '?vehicleType=');
  res.json({ symptoms: getSymptomsForVehicleType(vehicleType) });
});

router.get('/repair-guides', (req, res) => {
  const vehicleType = requireVehicleType(req.query.vehicleType, '?vehicleType=');
  res.json({ repairGuides: getRepairGuidesForVehicleType(vehicleType) });
});

router.get('/repair-guides/:id', (req, res) => {
  const guide = getRepairGuideById(req.params.id);
  if (!guide) throw notFound('Repair guide not found');
  res.json({ repairGuide: guide });
});

/**
 * Convenience endpoint for tooling and future clients: the whole catalog in
 * one response. The mobile app uses the filtered endpoints above.
 */
router.get('/catalog', (_req, res) => {
  res.json({
    symptoms: getAllSymptoms(),
    repairGuides: getAllRepairGuides(),
  });
});

export default router;
