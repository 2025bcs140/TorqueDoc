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

router.get('/symptoms', async (req, res) => {
  const vehicleType = requireVehicleType(req.query.vehicleType, '?vehicleType=');
  res.json({ symptoms: await getSymptomsForVehicleType(vehicleType) });
});

router.get('/repair-guides', async (req, res) => {
  const vehicleType = requireVehicleType(req.query.vehicleType, '?vehicleType=');
  res.json({ repairGuides: await getRepairGuidesForVehicleType(vehicleType) });
});

router.get('/repair-guides/:id', async (req, res) => {
  const guide = await getRepairGuideById(req.params.id);
  if (!guide) throw notFound('Repair guide not found');
  res.json({ repairGuide: guide });
});

/**
 * Convenience endpoint for tooling and future clients: the whole catalog in
 * one response. The mobile app uses the filtered endpoints above.
 */
router.get('/catalog', async (_req, res) => {
  res.json({
    symptoms: await getAllSymptoms(),
    repairGuides: await getAllRepairGuides(),
  });
});

export default router;
