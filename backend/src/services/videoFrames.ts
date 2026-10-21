import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export class FfmpegNotFoundError extends Error {
  constructor() {
    super(
      "ffmpeg/ffprobe were not found on this system's PATH. Install ffmpeg (for example `brew install ffmpeg`, `apt install ffmpeg`, or `winget install Gyan.FFmpeg`) to enable video analysis. Photo analysis does not need it."
    );
    this.name = 'FfmpegNotFoundError';
  }
}

let availabilityCheck: Promise<boolean> | undefined;

/**
 * Checks once per process whether both ffmpeg and ffprobe are on PATH.
 * Used by /health and the startup log; the actual extraction still reports a
 * friendly error if the binaries disappear later.
 */
export function isFfmpegAvailable(): Promise<boolean> {
  availabilityCheck ??= (async () => {
    try {
      await Promise.all([
        execFileAsync('ffmpeg', ['-version'], { timeout: 5_000 }),
        execFileAsync('ffprobe', ['-version'], { timeout: 5_000 }),
      ]);
      return true;
    } catch {
      return false;
    }
  })();

  return availabilityCheck;
}

function isMissingBinary(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}

async function getDurationSeconds(videoPath: string): Promise<number> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        videoPath,
      ],
      { timeout: 10_000 }
    ));
  } catch (error) {
    if (isMissingBinary(error)) throw new FfmpegNotFoundError();
    throw error;
  }

  const duration = Number.parseFloat(stdout.trim());
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

async function extractFrameAt(
  videoPath: string,
  timeSeconds: number,
  outPath: string
): Promise<void> {
  await execFileAsync(
    'ffmpeg',
    [
      '-nostdin',
      '-loglevel',
      'error',
      // Seek before the input for speed; -frames:v 1 writes a single still.
      '-ss',
      timeSeconds.toFixed(2),
      '-i',
      videoPath,
      '-frames:v',
      '1',
      // Keep frames small enough for fast uploads and predictable token cost.
      '-vf',
      'scale=min(1280,iw):-2',
      '-q:v',
      '3',
      '-y',
      outPath,
    ],
    { timeout: 20_000 }
  );
}

/**
 * Samples up to three frames spread across a short video clip and returns
 * them as base64 JPEG strings.
 *
 * A still frame cannot capture sound, so this is only useful for things that
 * show up visually (smoke, a leak, a wobbling part). The prompt built in
 * routes/mediaAnalyze.ts says so explicitly.
 */
export async function extractVideoFramesBase64(videoBuffer: Buffer): Promise<string[]> {
  if (!(await isFfmpegAvailable())) {
    throw new FfmpegNotFoundError();
  }

  const dir = await mkdtemp(path.join(tmpdir(), 'torquedoc-video-'));
  const videoPath = path.join(dir, 'input.mp4');

  try {
    await writeFile(videoPath, videoBuffer);

    const duration = await getDurationSeconds(videoPath);
    const offsets =
      duration > 0
        ? [duration * 0.2, duration * 0.5, duration * 0.8]
        : [0]; // fall back to the first frame when duration is unreadable

    const frames: string[] = [];
    const readFrame = async (timeSeconds: number): Promise<void> => {
      const framePath = path.join(dir, `frame_${frames.length}.jpg`);
      try {
        await extractFrameAt(videoPath, timeSeconds, framePath);
        frames.push((await readFile(framePath)).toString('base64'));
      } catch (error) {
        if (isMissingBinary(error)) throw new FfmpegNotFoundError();
        // A particular offset can fail on very short or variable-frame-rate
        // clips. Skip that frame rather than failing the whole request.
      }
    };

    for (const offset of offsets) {
      await readFrame(offset);
    }

    // Some codecs refuse mid-stream seeks. Reading the opening frame is a
    // useful last resort and still gives the vision model something to see.
    if (frames.length === 0 && duration > 0) {
      await readFrame(0);
    }

    return frames;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
