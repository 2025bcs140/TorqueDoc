import { Router } from 'express';
import { getSymptomsForVehicleType } from '../db';
import { badRequest, isPlainObject, requireString, requireVehicleType } from '../http';
import {
  AnthropicRequestError,
  askClaudeForJson,
  MissingApiKeyError,
} from '../services/anthropicClient';

const router = Router();

interface InterpretResult {
  matchedSymptomIds: string[];
  summary: string;
}

const SYSTEM_PROMPT = `You are the symptom-interpretation layer of a vehicle repair app called TorqueDoc.
You are given a fixed taxonomy of known symptom ids and a person's free-text description of a
problem with their car or motorcycle. Map their description onto the symptom ids it genuinely
matches. Don't force a match if nothing fits well — it's fine to return an empty list.
Only use ids from the provided taxonomy. Never invent an id.

Respond with ONLY a JSON object, no other text, matching exactly this shape:
{"matchedSymptomIds": string[], "summary": string}

"summary" is one short, plain-language sentence restating what they described, to show back to them.`;

router.post('/interpret', async (req, res) => {
  if (!isPlainObject(req.body)) throw badRequest('Request body must be a JSON object');

  const vehicleType = requireVehicleType(req.body.vehicleType);
  const description = requireString(req.body.description, 'description', { min: 3, max: 2_000 });

  const relevantSymptoms = getSymptomsForVehicleType(vehicleType).map((symptom) => ({
    id: symptom.id,
    label: symptom.label,
    category: symptom.category,
  }));

  const userPrompt = `Vehicle type: ${vehicleType}

Known symptoms:
${JSON.stringify(relevantSymptoms, null, 2)}

Description from the person:
"""
${description}
"""`;

  try {
    const result = await askClaudeForJson<InterpretResult>(SYSTEM_PROMPT, [
      { type: 'text', text: userPrompt },
    ]);

    const knownIds = new Set(relevantSymptoms.map((symptom) => symptom.id));
    const matchedSymptomIds = Array.isArray(result.matchedSymptomIds)
      ? result.matchedSymptomIds.filter(
          (id): id is string => typeof id === 'string' && knownIds.has(id)
        )
      : [];

    res.json({
      matchedSymptomIds: [...new Set(matchedSymptomIds)],
      summary: typeof result.summary === 'string' ? result.summary.slice(0, 500) : '',
    });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return res.status(503).json({ error: error.message, code: 'AI_NOT_CONFIGURED' });
    }
    console.error('Symptom interpretation failed:', error);
    const message =
      error instanceof AnthropicRequestError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'AI symptom interpretation failed';
    res.status(502).json({ error: message, code: 'AI_REQUEST_FAILED' });
  }
});

export default router;
