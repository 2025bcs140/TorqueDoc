import assert from 'node:assert/strict';
import test from 'node:test';

process.env.CLOUDFLARE_ACCOUNT_ID = '';
process.env.CLOUDFLARE_API_TOKEN = '';
process.env.ANTHROPIC_API_KEY = '';

test('clef-omni request embeds a WAV clip and typed sound questions', async () => {
  const { buildAudioAnalysisRequest } = await import('../src/services/audioAnalysis');
  const body = buildAudioAnalysisRequest('car', 'When braking', 'd2F2');

  assert.equal(body.model, 'clef-omni');
  assert.equal(body.state.vehicleType, 'car');
  assert.equal(body.state.whenHeard, 'When braking');
  assert.deepEqual(body.audio, [{ content_type: 'audio/wav', base64: 'd2F2' }]);
  assert.equal(body.questions.sound_present.type, 'noul');
  assert.equal(body.questions.dominant_sound.type, 'choice');
  assert.equal(body.questions.urgency.type, 'score');
  assert.match(body.questions.dominant_sound.criteria.brake_squeal, /squeal/i);
  assert.match(body.questions.dominant_sound.criteria.engine_knock, /knock/i);
});

test('audio interpretation maps only genuine catalog sounds to symptoms', async () => {
  const { interpretAudioAnswers } = await import('../src/services/audioAnalysis');
  const allowed = new Set(['s_squeal_braking', 's_grinding_braking', 's_chain_clunk_noise']);

  const squeal = interpretAudioAnswers(
    {
      sound_present: { type: 'noul', noul: 0.94 },
      dominant_sound: {
        type: 'choice',
        choice: 'brake_squeal',
        confidence: 0.88,
        probabilities: { brake_squeal: 0.88, brake_grind: 0.07, no_abnormal_sound: 0.02 },
      },
      urgency: { type: 'score', score: 1, legend: {}, confidence: 0.8 },
    },
    allowed
  );
  assert.deepEqual(squeal.matchedSymptomIds, ['s_squeal_braking']);
  assert.equal(squeal.detectedLabels[0].label, 'Brake squeal');
  assert.match(squeal.notes, /sound-pattern match/i);
  assert.match(squeal.notes, /not a confirmed/i);

  const chain = interpretAudioAnswers(
    {
      sound_present: { type: 'noul', noul: 0.91 },
      dominant_sound: {
        type: 'choice',
        choice: 'chain_slap',
        confidence: 0.8,
        probabilities: { chain_slap: 0.8, other_mechanical: 0.1 },
      },
      urgency: { type: 'score', score: 2, legend: {}, confidence: 0.7 },
    },
    allowed
  );
  assert.deepEqual(chain.matchedSymptomIds, ['s_chain_clunk_noise']);
});

test('engine knock is reported honestly without inventing a catalog diagnosis', async () => {
  const { interpretAudioAnswers } = await import('../src/services/audioAnalysis');
  const result = interpretAudioAnswers(
    {
      sound_present: { type: 'noul', noul: 0.96 },
      dominant_sound: {
        type: 'choice',
        choice: 'engine_knock',
        confidence: 0.9,
        probabilities: { engine_knock: 0.9, engine_tick: 0.05 },
      },
      urgency: { type: 'score', score: 3, legend: {}, confidence: 0.85 },
    },
    new Set(['s_rough_idle'])
  );

  assert.deepEqual(result.matchedSymptomIds, []);
  assert.equal(result.detectedLabels[0].label, 'Engine knock');
  assert.match(result.notes, /not in the current checklist/i);
  assert.match(result.notes, /inspected/i);
});

test('silent or normal clips return no symptom match', async () => {
  const { interpretAudioAnswers } = await import('../src/services/audioAnalysis');
  const result = interpretAudioAnswers(
    {
      sound_present: { type: 'noul', noul: 0.12 },
      dominant_sound: {
        type: 'choice',
        choice: 'no_abnormal_sound',
        confidence: 0.9,
        probabilities: { no_abnormal_sound: 0.9, rough_idle: 0.04 },
      },
      urgency: { type: 'score', score: 0, legend: {}, confidence: 0.9 },
    },
    new Set(['s_rough_idle'])
  );

  assert.deepEqual(result.matchedSymptomIds, []);
  assert.match(result.notes, /didn't contain a clearly abnormal/i);
});
