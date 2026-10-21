import { Router } from 'express';
import { getDiagnosisById } from '../db';
import { notFound } from '../http';

const router = Router();

/**
 * Fetches one saved diagnosis. The mobile app uses this for the history
 * detail screen so a record can be opened directly without re-running the
 * diagnosis or relying on navigation params.
 */
router.get('/:id', (req, res) => {
  const record = getDiagnosisById(req.params.id);
  if (!record) throw notFound('Diagnosis not found');
  res.json({ diagnosis: record });
});

export default router;
