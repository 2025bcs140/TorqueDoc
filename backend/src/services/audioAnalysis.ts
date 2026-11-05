import { config } from '../config';
import { VehicleType } from '../types';
import { AiNotConfiguredError, AiRequestError } from './aiTypes';

/**
 * Audio analysis through Cloudflare's clef-omni multimodal decision model.
 *
 * clef-omni does not produce free text. It answers a typed schema of yes/no,
 * choice and score questions against an audio clip, returning a probability
 * for each answer. That fits the app's honest "signal match, then rule engine"
 * design: the model only identifies sound patterns, and the existing
 * deterministic catalog still ranks causes.
 */

export interface AudioAnalysisResult {
  matchedSymptomIds: string[];
  detectedLabels: { label: string; confidence: number }[];
  notes: string;
}

type SoundId =
  | 'no_abnormal_sound'
  | 'brake_squeal'
  | 'brake_grind'
  | 'engine_knock'
  | 'engine_tick'
  | 'rough_idle'
  | 'starter_click'
  | 'exhaust_rasp'
  | 'belt_squeal'
  | 'cooling_hiss'
  | 'chain_slap'
  | 'other_mechanical';

const SOUND_OPTIONS: Record<SoundId, string> = {
  no_abnormal_sound:
    'No clearly abnormal vehicle mechanical sound is prominent; the clip may contain normal engine idle, speech, wind, music, or background noise.',
  brake_squeal:
    'A high-pitched, continuous squeal or chirp that is commonly heard when braking.',
  brake_grind:
    'A harsh grinding, scraping, or metal-on-metal sound, commonly heard when braking.',
  engine_knock:
    'A deep, rhythmic knocking, thumping, or hammering sound from the engine.',
  engine_tick:
    'A fast, light metallic ticking, tapping, or clicking from the engine or valve area.',
  rough_idle:
    'An uneven, lumpy, shaky, or pulsing engine idle rather than a steady hum.',
  starter_click:
    'Rapid clicking or a single heavy clack when starting, with the engine failing to turn over.',
  exhaust_rasp:
    'A loud, raspy, blowing, popping, or droning exhaust note, suggesting a leak or damaged exhaust.',
  belt_squeal:
    'A squealing or chirping sound from the accessory belt area, often changing with engine speed.',
  cooling_hiss:
    'Hissing, bubbling, gurgling, or boiling from the cooling system or near the radiator.',
  chain_slap:
    'Clunking, slapping, or grinding from a motorcycle chain, sprocket, or final-drive area.',
  other_mechanical:
    'A mechanical sound that is clearly abnormal but does not fit any other option.',
};

const SOUND_LABELS: Record<SoundId, string> = {
  no_abnormal_sound: 'No abnormal sound',
  brake_squeal: 'Brake squeal',
  brake_grind: 'Brake grinding',
  engine_knock: 'Engine knock',
  engine_tick: 'Engine ticking',
  rough_idle: 'Rough idle',
  starter_click: 'Starter clicking',
  exhaust_rasp: 'Raspy exhaust',
  belt_squeal: 'Belt squeal',
  cooling_hiss: 'Cooling-system hiss',
  chain_slap: 'Chain / sprocket noise',
  other_mechanical: 'Other mechanical noise',
};

const SOUND_TO_SYMPTOMS: Record<SoundId, string[]> = {
  no_abnormal_sound: [],
  brake_squeal: ['s_squeal_braking'],
  brake_grind: ['s_grinding_braking'],
  engine_knock: [],
  engine_tick: [],
  rough_idle: ['s_rough_idle'],
  starter_click: ['s_wont_start_click'],
  exhaust_rasp: ['s_loud_exhaust_note'],
  belt_squeal: [],
  cooling_hiss: [],
  chain_slap: ['s_chain_clunk_noise'],
  other_mechanical: [],
};

const URGENCY_LEVELS = [
  'faint, intermittent, or only present in a specific situation',
  'noticeable and worth checking soon',
  'loud, frequent, or getting worse',
  'urgent: heavy grinding, a loud knock, or a sound that makes the vehicle unsafe to drive',
] as const;

interface ClefNoulAnswer {
  type: 'noul';
  noul: number;
}

interface ClefChoiceAnswer {
  type: 'choice';
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
}

interface ClefScoreAnswer {
  type: 'score';
  score: number;
  legend: Record<string, number>;
  confidence: number;
}

type ClefAnswer = ClefNoulAnswer | ClefChoiceAnswer | ClefScoreAnswer;

interface ClefResponse {
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  messages?: string[];
  result?:
    | {
        model?: string;
        answers?: Record<string, ClefAnswer>;
      }
    | string;
}

export interface AudioAnalysisRequest {
  model: 'clef-omni';
  state: {
    vehicleType: VehicleType;
    whenHeard: string;
    instruction: string;
  };
  audio: Array<{ content_type: 'audio/wav'; base64: string }>;
  questions: {
    sound_present: {
      type: 'noul';
      instructions: string;
      criteria: { true: string; false: string };
    };
    dominant_sound: {
      type: 'choice';
      instructions: string;
      criteria: Record<SoundId, string>;
    };
    urgency: {
      type: 'score';
      instructions: string;
      criteria: string[];
    };
  };
}

/**
 * Build the exact request body separately from the network call so the schema
 * can be unit-tested offline.
 */
export function buildAudioAnalysisRequest(
  vehicleType: VehicleType,
  whenHeard: string,
  audioBase64: string
): AudioAnalysisRequest {
  return {
    model: 'clef-omni',
    state: {
      vehicleType,
      whenHeard: whenHeard.trim() || 'not specified',
      instruction:
        'Listen only to the attached audio clip. Identify the dominant abnormal mechanical, brake, engine, exhaust, chain, or cooling sound. Ignore speech, music, wind, road noise, and other background sounds. If the clip sounds like a normal vehicle, choose no_abnormal_sound.',
    },
    audio: [{ content_type: 'audio/wav', base64: audioBase64 }],
    questions: {
      sound_present: {
        type: 'noul',
        instructions:
          'Does the clip contain a clearly audible abnormal vehicle mechanical or brake sound?',
        criteria: {
          true: 'A specific abnormal vehicle sound is clearly audible.',
          false: 'Only normal engine idle, speech, wind, music, or background noise is audible.',
        },
      },
      dominant_sound: {
        type: 'choice',
        instructions:
          'Which single option best describes the dominant abnormal sound in the clip?',
        criteria: SOUND_OPTIONS,
      },
      urgency: {
        type: 'score',
        instructions:
          'How urgent does the sound seem, based only on its acoustic character and the context provided?',
        criteria: [...URGENCY_LEVELS],
      },
    },
  };
}

function clampProbability(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function isSoundId(value: string): value is SoundId {
  return Object.prototype.hasOwnProperty.call(SOUND_OPTIONS, value);
}

function extractAnswers(data: ClefResponse): Record<string, ClefAnswer> {
  const errors = (data.errors ?? [])
    .map((item) => item.message)
    .filter((message): message is string => typeof message === 'string' && message.length > 0);
  if (data.success === false || errors.length > 0) {
    throw new AiRequestError(
      `Cloudflare audio model returned an error${errors.length ? `: ${errors.join('; ')}` : ''}`
    );
  }

  let result = data.result;
  if (typeof result === 'string') {
    try {
      result = JSON.parse(result) as { model?: string; answers?: Record<string, ClefAnswer> };
    } catch {
      throw new AiRequestError('Cloudflare audio model returned a response that was not valid JSON');
    }
  }

  if (!result || typeof result !== 'object' || !result.answers) {
    throw new AiRequestError('Cloudflare audio model returned no answers');
  }
  return result.answers;
}

function describeApiError(status: number, body: string): string {
  let detail = body.trim();
  try {
    const parsed = JSON.parse(body) as ClefResponse;
    const errors = (parsed.errors ?? [])
      .map((item) => item.message)
      .filter((message): message is string => typeof message === 'string' && message.length > 0);
    if (errors.length > 0) detail = errors.join('; ');
  } catch {
    // Keep the raw text when the body isn't JSON.
  }
  return `Cloudflare audio analysis failed (${status})${detail ? `: ${detail.slice(0, 300)}` : ''}`;
}

async function runClef(body: AudioAnalysisRequest): Promise<Record<string, ClefAnswer>> {
  if (!config.cloudflareAccountId || !config.cloudflareApiToken) {
    throw new AiNotConfiguredError();
  }

  const model = config.cloudflareAudioModel;
  if (!/^[A-Za-z0-9@._/-]+$/.test(model)) {
    throw new AiRequestError(
      'CLOUDFLARE_AUDIO_MODEL contains characters that are not valid in a Workers AI model id'
    );
  }

  const url = `${config.cloudflareApiBaseUrl.replace(/\/+$/, '')}/accounts/${encodeURIComponent(
    config.cloudflareAccountId
  )}/ai/run/${model}`;
  const serialized = JSON.stringify(body);

  let lastError: AiRequestError | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.cloudflareApiToken}`,
          'content-type': 'application/json',
        },
        body: serialized,
        signal: AbortSignal.timeout(config.aiTimeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new AiRequestError(
          `Cloudflare audio analysis timed out after ${Math.round(config.aiTimeoutMs / 1000)}s`
        );
      }
      throw new AiRequestError(
        `Could not reach Cloudflare Workers AI: ${
          error instanceof Error ? error.message : 'network error'
        }`
      );
    }

    if (response.ok) {
      const raw = await response.text();
      let data: ClefResponse;
      try {
        data = JSON.parse(raw) as ClefResponse;
      } catch {
        throw new AiRequestError('Cloudflare audio model returned a response that was not valid JSON');
      }
      return extractAnswers(data);
    }

    const detail = await response.text().catch(() => '');
    lastError = new AiRequestError(describeApiError(response.status, detail), response.status);
    if (![408, 429, 500, 502, 503, 504, 529].includes(response.status) || attempt === 1) {
      throw lastError;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw lastError ?? new AiRequestError('Cloudflare audio analysis failed');
}

/**
 * Convert the model's structured answer into the same result shape used by
 * photo/video analysis. Only sound patterns with a genuine catalog symptom are
 * passed to the deterministic engine; other sounds are still reported in
 * detectedLabels and notes so the user gets useful, non-fabricated feedback.
 */
export function interpretAudioAnswers(
  answers: Record<string, ClefAnswer>,
  allowedSymptomIds: Set<string>
): AudioAnalysisResult {
  const soundPresent = answers.sound_present?.type === 'noul' ? clampProbability(answers.sound_present.noul) : 0;
  const choiceAnswer = answers.dominant_sound;
  const chosen =
    choiceAnswer?.type === 'choice' && isSoundId(choiceAnswer.choice)
      ? choiceAnswer.choice
      : 'other_mechanical';
  const probabilities =
    choiceAnswer?.type === 'choice' ? choiceAnswer.probabilities ?? {} : {};
  const topProbability = clampProbability(probabilities[chosen]);
  const rawUrgency = answers.urgency?.type === 'score' ? answers.urgency.score : null;
  const urgency =
    typeof rawUrgency === 'number' && Number.isFinite(rawUrgency) ? rawUrgency : null;

  const detectedLabels = Object.entries(probabilities)
    .filter(([soundId, probability]) => isSoundId(soundId) && soundId !== 'no_abnormal_sound' && clampProbability(probability) > 0.05)
    .sort((a, b) => clampProbability(b[1]) - clampProbability(a[1]))
    .slice(0, 4)
    .map(([soundId, probability]) => ({
      label: SOUND_LABELS[soundId as SoundId],
      confidence: clampProbability(probability),
    }));

  if (soundPresent < 0.5 || chosen === 'no_abnormal_sound') {
    return {
      matchedSymptomIds: [],
      detectedLabels,
      notes:
        "The clip didn't contain a clearly abnormal vehicle sound. Try recording 10–20 seconds closer to the suspected area while the engine or affected part is making the noise.",
    };
  }

  const mapped = SOUND_TO_SYMPTOMS[chosen].filter((id) => allowedSymptomIds.has(id));
  const bestLabel = SOUND_LABELS[chosen];
  const confidenceText =
    topProbability > 0 ? ` (${Math.round(topProbability * 100)}% sound-match confidence)` : '';
  const urgencyText =
    urgency !== null
      ? ` Urgency estimate: ${URGENCY_LEVELS[Math.max(0, Math.min(URGENCY_LEVELS.length - 1, Math.round(urgency)))]}.`
      : '';

  let notes = `Audio model's best match: ${bestLabel}${confidenceText}.${urgencyText} This is a sound-pattern match, not a confirmed mechanical diagnosis.`;

  if (chosen === 'brake_grind') {
    notes += ' Grinding brakes can mean metal-on-metal contact — avoid driving until they are inspected.';
  } else if (chosen === 'engine_knock') {
    notes +=
      ' A heavy engine knock is not in the current checklist; have it inspected before driving further.';
  } else if (chosen === 'engine_tick' || chosen === 'belt_squeal') {
    notes +=
      ' This sound is not in the current checklist, so the result below will be empty. Try the symptom checklist for related signs.';
  } else if (mapped.length === 0) {
    notes +=
      ' This sound is not in the current checklist, so the result below will be empty. Try the symptom checklist for related signs.';
  }

  return {
    matchedSymptomIds: [...new Set(mapped)],
    detectedLabels,
    notes,
  };
}

export async function analyzeVehicleAudio(
  vehicleType: VehicleType,
  whenHeard: string,
  audioBase64: string,
  allowedSymptomIds: Set<string>
): Promise<AudioAnalysisResult> {
  const answers = await runClef(buildAudioAnalysisRequest(vehicleType, whenHeard, audioBase64));
  return interpretAudioAnswers(answers, allowedSymptomIds);
}

// Exported for unit tests and for the health/capability UI.
export const AUDIO_SOUND_IDS = Object.keys(SOUND_OPTIONS) as SoundId[];
export { SOUND_TO_SYMPTOMS };
