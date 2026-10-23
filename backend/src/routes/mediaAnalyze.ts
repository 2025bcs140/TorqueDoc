import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { MAX_UPLOAD_BYTES } from '../config';
import { getSymptomsForVehicleType } from '../db';
import { badRequest, isPlainObject, requireVehicleType } from '../http';
import {
  AiImageMediaType,
  AiNotConfiguredError,
  AiRequestError,
  askAiForJson,
} from '../services/aiClient';
import { extractVideoFramesBase64, FfmpegNotFoundError } from '../services/videoFrames';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

const VALID_KINDS = ['photo', 'video'] as const;
type MediaKind = (typeof VALID_KINDS)[number];

/** The app and the vision-model upload path both cap each photo at 5 MB. */
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const PHOTO_MIME_TYPES: Record<string, AiImageMediaType> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
  'image/gif': 'image/gif',
};

const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'video/3gpp',
  'video/x-matroska',
  'application/octet-stream', // some React Native uploads don't set a precise type
]);

interface MediaAnalysisResult {
  matchedSymptomIds: string[];
  detectedLabels: { label: string; confidence: number }[];
  notes: string;
}

const SYSTEM_PROMPT = `You are the visual-inspection layer of a vehicle repair app called TorqueDoc.
Look at the provided vehicle photo or video frame(s) and identify anything diagnostically relevant:
visible leaks, warning lights, smoke, worn or damaged parts, corrosion, loose components, etc.
Map what you see onto the given known symptom ids where there's a genuine visual match. If the
image doesn't show anything diagnostically useful, say so plainly and return empty arrays — don't
force a match. Only use ids from the provided taxonomy. Never invent an id or a confidence value
outside 0–1.

Respond with ONLY a JSON object, no other text, matching exactly this shape:
{"matchedSymptomIds": string[], "detectedLabels": [{"label": string, "confidence": number}], "notes": string}`;

function parseKind(value: unknown): MediaKind {
  if (typeof value !== 'string' || !VALID_KINDS.includes(value as MediaKind)) {
    throw badRequest(`kind must be one of: ${VALID_KINDS.join(', ')}`);
  }
  return value as MediaKind;
}

function validateFileForKind(kind: MediaKind, file: Express.Multer.File): void {
  if (kind === 'photo') {
    if (file.mimetype.startsWith('video/')) {
      throw badRequest('kind is "photo" but the uploaded file is a video');
    }
    if (!PHOTO_MIME_TYPES[file.mimetype]) {
      throw badRequest(
        `Unsupported photo type "${file.mimetype}". Use JPEG, PNG, WebP or GIF.`,
        { supported: Object.keys(PHOTO_MIME_TYPES) }
      );
    }
    return;
  }

  if (file.mimetype.startsWith('image/')) {
    throw badRequest('kind is "video" but the uploaded file is an image');
  }
  if (!VIDEO_MIME_TYPES.has(file.mimetype)) {
    throw badRequest(
      `Unsupported video type "${file.mimetype}". Use MP4, MOV, WebM, AVI, 3GP or MKV.`,
      { supported: [...VIDEO_MIME_TYPES] }
    );
  }
}

function uploadSingleFile(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (error: unknown) => {
    if (error) return next(error);
    next();
  });
}

router.post('/analyze', uploadSingleFile, async (req, res) => {
  if (!isPlainObject(req.body)) throw badRequest('Expected a multipart form body');

  const vehicleType = requireVehicleType(req.body.vehicleType);
  const kind = parseKind(req.body.kind);

  if (!req.file) {
    throw badRequest('No file uploaded (expected multipart field "file")');
  }
  validateFileForKind(kind, req.file);

  if (kind === 'photo' && req.file.size > MAX_PHOTO_BYTES) {
    return res.status(413).json({
      error:
        'That photo is larger than 5 MB, which is the vision API limit. Choose a smaller image or lower the camera resolution.',
      code: 'PHOTO_TOO_LARGE',
    });
  }

  let base64Frames: { data: string; mediaType: AiImageMediaType }[];
  let frameNote: string;

  if (kind === 'photo') {
    base64Frames = [
      {
        data: req.file.buffer.toString('base64'),
        mediaType: PHOTO_MIME_TYPES[req.file.mimetype],
      },
    ];
    frameNote = 'This is a single photo.';
  } else {
    let frames: string[];
    try {
      frames = await extractVideoFramesBase64(req.file.buffer);
    } catch (error) {
      if (error instanceof FfmpegNotFoundError) {
        return res.status(503).json({ error: error.message, code: 'FFMPEG_NOT_FOUND' });
      }
      return res.status(422).json({
        error:
          'Could not read frames from that video. Try a shorter MP4/MOV clip, or use a photo instead.',
        code: 'VIDEO_UNREADABLE',
      });
    }

    if (frames.length === 0) {
      return res.status(422).json({
        error:
          'Could not read any usable frames from that video. Try a photo instead, or a shorter clip.',
        code: 'VIDEO_NO_FRAMES',
      });
    }

    base64Frames = frames.map((data) => ({ data, mediaType: 'image/jpeg' as const }));
    frameNote = `These ${frames.length} images are frames sampled across a few seconds of video — look for visible change across them (e.g. smoke, a wobbling part, fluid dripping). Audio was not captured, so don't guess at sounds.`;
  }

  const relevantSymptoms = getSymptomsForVehicleType(vehicleType).map((symptom) => ({
    id: symptom.id,
    label: symptom.label,
    category: symptom.category,
  }));

  const content = [
    {
      type: 'text' as const,
      text: `Vehicle type: ${vehicleType}
${frameNote}

Known symptoms:
${JSON.stringify(relevantSymptoms, null, 2)}`,
    },
    ...base64Frames.map((frame) => ({
      type: 'image' as const,
      mediaType: frame.mediaType,
      data: frame.data,
    })),
  ];

  try {
    const result = await askAiForJson<MediaAnalysisResult>(SYSTEM_PROMPT, content);

    const knownIds = new Set(relevantSymptoms.map((symptom) => symptom.id));
    const matchedSymptomIds = Array.isArray(result.matchedSymptomIds)
      ? [
          ...new Set(
            result.matchedSymptomIds.filter(
              (id): id is string => typeof id === 'string' && knownIds.has(id)
            )
          ),
        ]
      : [];

    const detectedLabels = Array.isArray(result.detectedLabels)
      ? result.detectedLabels
          .filter(
            (item): item is { label: string; confidence: number } =>
              isPlainObject(item) &&
              typeof item.label === 'string' &&
              typeof item.confidence === 'number' &&
              Number.isFinite(item.confidence)
          )
          .slice(0, 20)
          .map((item) => ({
            label: item.label.slice(0, 120),
            confidence:
              item.confidence > 1
                ? Math.min(1, item.confidence / 100)
                : Math.max(0, item.confidence),
          }))
      : [];

    res.json({
      matchedSymptomIds,
      detectedLabels,
      notes: typeof result.notes === 'string' ? result.notes.slice(0, 1_000) : '',
    });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return res.status(503).json({ error: error.message, code: 'AI_NOT_CONFIGURED' });
    }
    console.error('Media analysis failed:', error);
    const message =
      error instanceof AiRequestError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'AI media analysis failed';
    res.status(502).json({ error: message, code: 'AI_REQUEST_FAILED' });
  }
});

export default router;
