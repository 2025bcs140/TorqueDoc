import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FfmpegNotFoundError, isFfmpegAvailable } from './videoFrames';

const execFileAsync = promisify(execFile);

/** Keep clips short: 30 seconds is enough for a repeating mechanical noise. */
export const MAX_AUDIO_SECONDS = 30;

export class AudioUnreadableError extends Error {
  constructor() {
    super(
      'Could not read an audio track from that file. Try a WAV, MP3, M4A or WebM recording, and make sure the microphone captured sound.'
    );
    this.name = 'AudioUnreadableError';
  }
}

function isMissingBinary(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}

/**
 * Normalise any browser/phone audio container to a small mono WAV that
 * clef-omni accepts. Transcoding also strips video streams if a video file is
 * uploaded by mistake, and trimming keeps the request under the model's
 * 8 MiB / 300 second per-clip limits.
 */
export async function extractAudioClipBase64(audioBuffer: Buffer): Promise<string> {
  if (!(await isFfmpegAvailable())) {
    throw new FfmpegNotFoundError();
  }

  const dir = await mkdtemp(path.join(tmpdir(), 'torquedoc-audio-'));
  const inputPath = path.join(dir, 'input.audio');
  const outputPath = path.join(dir, 'clip.wav');

  try {
    await writeFile(inputPath, audioBuffer);

    try {
      await execFileAsync(
        'ffmpeg',
        [
          '-nostdin',
          '-loglevel',
          'error',
          '-i',
          inputPath,
          '-t',
          String(MAX_AUDIO_SECONDS),
          '-vn',
          '-ac',
          '1',
          '-ar',
          '16000',
          '-sample_fmt',
          's16',
          '-f',
          'wav',
          '-y',
          outputPath,
        ],
        { timeout: 30_000, maxBuffer: 8 * 1024 * 1024 }
      );
    } catch (error) {
      if (isMissingBinary(error)) throw new FfmpegNotFoundError();
      throw new AudioUnreadableError();
    }

    const wav = await readFile(outputPath);
    if (wav.length === 0) throw new AudioUnreadableError();
    return wav.toString('base64');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
