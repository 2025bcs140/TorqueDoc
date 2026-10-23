import { config } from './config';
import { closeDb, initDb } from './db';
import { createApp } from './app';
import { isFfmpegAvailable } from './services/videoFrames';

/**
 * Server entry point: initialise the database, build the app, listen on all
 * interfaces (so a phone on the same Wi-Fi can reach it) and shut down
 * cleanly.
 */
initDb();

const app = createApp();
const server = app.listen(config.port, '0.0.0.0', async () => {
  console.log(`TorqueDoc backend listening on http://0.0.0.0:${config.port}`);
  console.log(`Database: ${config.dbPath}`);

  if (config.aiConfigured) {
    console.log(
      `AI features enabled (provider: ${config.aiProvider}, model: ${config.aiModel}).`
    );
  } else {
    console.warn(
      'AI features are disabled: set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in backend/.env (or on the host) to enable free-text and photo/video diagnosis.'
    );
  }

  if (!(await isFfmpegAvailable())) {
    console.warn(
      'ffmpeg/ffprobe not found on PATH: photo analysis still works, video analysis will return 503 until ffmpeg is installed.'
    );
  }

  console.log('Testing on a physical device via Expo Go? Use this computer\u2019s LAN IP, not localhost.');
});

server.on('error', (error) => {
  console.error('Failed to start the TorqueDoc backend:', error);
  closeDb();
  process.exit(1);
});

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received, shutting down…`);

  server.close(() => {
    closeDb();
    process.exit(0);
  });

  // Don't hang forever on a stuck keep-alive connection.
  setTimeout(() => {
    console.error('Shutdown timed out; exiting.');
    process.exit(1);
  }, 5_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
