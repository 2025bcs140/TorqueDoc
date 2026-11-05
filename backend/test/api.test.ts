import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/**
 * Integration tests against the real Express app and a throwaway SQLite file.
 *
 * Environment variables must be set *before* importing app/db, because the
 * database connection and config are created at module load time.
 */
test('TorqueDoc API', async (t) => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'torquedoc-api-test-'));
  process.env.DB_PATH = path.join(tempDir, 'test.db');
  process.env.ANTHROPIC_API_KEY = '';
  process.env.CLOUDFLARE_ACCOUNT_ID = '';
  process.env.CLOUDFLARE_API_TOKEN = '';
  process.env.LOG_REQUESTS = 'false';
  process.env.NODE_ENV = 'test';
  process.env.MAX_UPLOAD_MB = '10';

  const { initDb, closeDb } = await import('../src/db');
  const { createApp } = await import('../src/app');

  initDb();

  const server: Server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
    closeDb();
    await rm(tempDir, { recursive: true, force: true });
  });

  let sessionToken = '';

  async function rawApi(
    route: string,
    init?: RequestInit,
    token = sessionToken
  ): Promise<{ status: number; body: any }> {
    const headers = new Headers(init?.headers);
    if (token) headers.set('authorization', `Bearer ${token}`);
    const response = await fetch(`${baseUrl}${route}`, { ...init, headers });
    const text = await response.text();
    let body: any = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    return { status: response.status, body };
  }

  async function api(
    route: string,
    init?: RequestInit
  ): Promise<{ status: number; body: any }> {
    return rawApi(route, init);
  }

  let carId = '';
  let carDiagnosisId = '';
  let motorcycleId = '';

  await t.test('health reports database and optional capabilities', async () => {
    const { status, body } = await api('/health');
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.database, 'ok');
    assert.equal(body.ai.configured, false);
    assert.equal(body.ai.provider, null);
    assert.equal(body.ai.model, null);
    assert.ok(['available', 'unavailable'].includes(body.videoAnalysis));
  });

  await t.test('API index lists the main routes', async () => {
    const { status, body } = await api('/');
    assert.equal(status, 200);
    assert.equal(body.name, 'TorqueDoc API');
    assert.ok(body.endpoints.diagnose);
  });

  await t.test('browser dashboard and root redirect work without the API key', async () => {
    const dashboard = await fetch(`${baseUrl}/dashboard`, {
      headers: { accept: 'text/html' },
    });
    assert.equal(dashboard.status, 200);
    assert.match(dashboard.headers.get('content-type') ?? '', /text\/html/);
    assert.match(await dashboard.text(), /Garage dashboard/);

    const root = await fetch(`${baseUrl}/`, {
      headers: { accept: 'text/html' },
      redirect: 'manual',
    });
    assert.equal(root.status, 302);
    assert.ok(['/app', '/dashboard'].includes(root.headers.get('location') ?? ''));

    const web = await fetch(`${baseUrl}/app`, { headers: { accept: 'text/html' } });
    if (web.status === 200) {
      assert.match(await web.text(), /__TORQUEDOC_CONFIG__/);
    } else {
      assert.equal(web.status, 404);
    }
  });

  await t.test('garage routes require a signed-in account', async () => {
    const anonymous = await rawApi('/vehicles', undefined, '');
    assert.equal(anonymous.status, 401);
    assert.equal(anonymous.body.code, 'AUTH_REQUIRED');
  });

  await t.test('registration creates a private account and seeds its garage', async () => {
    const invalid = await api('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'longenough' }),
    });
    assert.equal(invalid.status, 400);

    const registered = await api('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: 'API Tester',
        email: 'tester@example.com',
        password: 'correct-horse-battery',
      }),
    });
    assert.equal(registered.status, 201);
    assert.match(registered.body.token, /^tds_/);
    assert.equal(registered.body.user.email, 'tester@example.com');
    assert.equal(registered.body.user.displayName, 'API Tester');
    assert.equal(registered.body.user.passwordHash, undefined);
    sessionToken = registered.body.token;

    const duplicate = await api('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'TESTER@example.com',
        password: 'another-long-password',
      }),
    });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.code, 'EMAIL_TAKEN');
  });

  await t.test('session lookup and login validate credentials', async () => {
    const me = await api('/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, 'tester@example.com');

    const wrong = await api('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'tester@example.com', password: 'wrong-password' }),
    });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.code, 'INVALID_CREDENTIALS');

    const unknown = await api('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'wrong-password' }),
    });
    assert.equal(unknown.status, 401);
    assert.equal(unknown.body.code, 'INVALID_CREDENTIALS');

    const login = await api('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'tester@example.com', password: 'correct-horse-battery' }),
    });
    assert.equal(login.status, 200);
    assert.match(login.body.token, /^tds_/);
  });

  await t.test('catalog filters by vehicle type', async () => {
    const car = await api('/symptoms?vehicleType=car');
    assert.equal(car.status, 200);
    assert.ok(car.body.symptoms.length > 0);
    assert.ok(
      car.body.symptoms.every((symptom: { vehicleTypes: string[] }) =>
        symptom.vehicleTypes.includes('car')
      )
    );

    const motorcycle = await api('/symptoms?vehicleType=motorcycle');
    assert.equal(motorcycle.status, 200);
    assert.ok(
      motorcycle.body.symptoms.every((symptom: { vehicleTypes: string[] }) =>
        symptom.vehicleTypes.includes('motorcycle')
      )
    );

    const missing = await api('/symptoms');
    assert.equal(missing.status, 400);
    assert.equal(missing.body.code, 'VALIDATION_ERROR');
  });

  await t.test('vehicle list includes exactly the seeded examples on a fresh database', async () => {
    const { status, body } = await api('/vehicles');
    assert.equal(status, 200);
    assert.equal(body.vehicles.length, 2);

    const motorcycle = body.vehicles.find((vehicle: { type: string }) => vehicle.type === 'motorcycle');
    assert.ok(motorcycle);
    motorcycleId = motorcycle.id;
  });

  await t.test('vehicle creation validates input', async () => {
    const invalid = await api('/vehicles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'truck', make: 'Ford', model: 'F-150', year: 2020, mileage: 1 }),
    });
    assert.equal(invalid.status, 400);
    assert.match(invalid.body.error, /type must be one of/);

    const created = await api('/vehicles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'car',
        nickname: 'Test Car',
        make: 'Mazda',
        model: '3',
        year: 2019,
        mileage: 42_000,
      }),
    });
    assert.equal(created.status, 201);
    assert.ok(created.body.vehicle.id);
    assert.equal(created.body.vehicle.nickname, 'Test Car');
    carId = created.body.vehicle.id;
  });

  await t.test("accounts cannot see each other's vehicles or history", async () => {
    const second = await api('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Other Tester',
        email: 'other@example.com',
        password: 'correct-horse-battery',
      }),
    });
    assert.equal(second.status, 201);
    const otherToken = second.body.token as string;

    const own = await rawApi('/vehicles', undefined, otherToken);
    assert.equal(own.status, 200);
    assert.equal(own.body.vehicles.length, 2);

    const foreign = await rawApi(`/vehicles/${carId}`, undefined, otherToken);
    assert.equal(foreign.status, 404);

    const foreignHistory = await rawApi(`/vehicles/${carId}/history`, undefined, otherToken);
    assert.equal(foreignHistory.status, 404);
  });

  await t.test('vehicle patch merges and re-validates', async () => {
    const patched = await api(`/vehicles/${carId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mileage: 43_500, nickname: null }),
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.vehicle.mileage, 43_500);
    assert.equal(patched.body.vehicle.nickname, null);
    assert.equal(patched.body.vehicle.make, 'Mazda');

    const unknownField = await api(`/vehicles/${carId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ milage: 1 }),
    });
    assert.equal(unknownField.status, 400);
    assert.match(unknownField.body.error, /Unknown field/);
  });

  await t.test('diagnose rejects bad or cross-vehicle symptom ids', async () => {
    const empty = await api('/diagnose', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vehicleType: 'car', symptomIds: [] }),
    });
    assert.equal(empty.status, 400);

    const duplicate = await api('/diagnose', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vehicleType: 'car', symptomIds: ['s_rough_idle', 's_rough_idle'] }),
    });
    assert.equal(duplicate.status, 400);

    const wrongType = await api('/diagnose', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vehicleType: 'motorcycle', symptomIds: ['s_check_engine_steady'] }),
    });
    assert.equal(wrongType.status, 400);
    assert.ok(wrongType.body.details.unknownSymptomIds.includes('s_check_engine_steady'));
  });

  await t.test('diagnose returns explainable matches and logs history', async () => {
    const result = await api('/diagnose', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        vehicleType: 'car',
        symptomIds: ['s_rough_idle', 's_engine_stalls_idle'],
        vehicleId: carId,
        source: 'checklist',
      }),
    });

    assert.equal(result.status, 200);
    assert.ok(result.body.matches.length > 0);
    assert.ok(result.body.diagnosisId);
    carDiagnosisId = result.body.diagnosisId;

    for (const match of result.body.matches) {
      assert.ok(match.confidence > 0 && match.confidence <= 1);
      assert.ok(Array.isArray(match.matchedSymptoms));
      assert.ok(match.totalLinkedSymptoms >= match.matchedSymptomIds.length);
      assert.equal(match.matchedSymptoms.length, match.matchedSymptomIds.length);
    }

    const history = await api(`/vehicles/${carId}/history`);
    assert.equal(history.status, 200);
    assert.equal(history.body.history.length, 1);
    assert.equal(history.body.history[0].id, carDiagnosisId);

    const single = await api(`/diagnoses/${carDiagnosisId}`);
    assert.equal(single.status, 200);
    assert.equal(single.body.diagnosis.vehicleId, carId);
  });

  await t.test('diagnose rejects a vehicle of the wrong type', async () => {
    const { status, body } = await api('/diagnose', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        vehicleType: 'car',
        symptomIds: ['s_rough_idle'],
        vehicleId: motorcycleId,
      }),
    });
    assert.equal(status, 400);
    assert.match(body.error, /belongs to a motorcycle/);
  });

  await t.test('AI endpoints degrade with a clear 503 when no key is configured', async () => {
    const interpret = await api('/v1/symptoms/interpret', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vehicleType: 'car', description: 'Loud squeal when braking' }),
    });
    assert.equal(interpret.status, 503);
    assert.equal(interpret.body.code, 'AI_NOT_CONFIGURED');

    const form = new FormData();
    form.append('vehicleType', 'car');
    form.append('kind', 'photo');
    form.append('file', new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), 'photo.jpg');

    const analyze = await api('/v1/media/analyze', { method: 'POST', body: form });
    assert.equal(analyze.status, 503);
    assert.equal(analyze.body.code, 'AI_NOT_CONFIGURED');
  });

  await t.test('media endpoint validates kind and file type before calling AI', async () => {
    const mismatch = new FormData();
    mismatch.append('vehicleType', 'car');
    mismatch.append('kind', 'photo');
    mismatch.append('file', new Blob([new Uint8Array([0, 0, 0])], { type: 'video/mp4' }), 'clip.mp4');

    const result = await api('/v1/media/analyze', { method: 'POST', body: mismatch });
    assert.equal(result.status, 400);
    assert.match(result.body.error, /is a video/);

    const missingFile = new FormData();
    missingFile.append('vehicleType', 'car');
    missingFile.append('kind', 'photo');
    const missing = await api('/v1/media/analyze', { method: 'POST', body: missingFile });
    assert.equal(missing.status, 400);
  });

  await t.test('photo analysis enforces the 5 MB vision limit', async () => {
    const form = new FormData();
    form.append('vehicleType', 'car');
    form.append('kind', 'photo');
    form.append(
      'file',
      new Blob([Buffer.alloc(6 * 1024 * 1024)], { type: 'image/jpeg' }),
      'large.jpg'
    );

    const result = await api('/v1/media/analyze', { method: 'POST', body: form });
    assert.equal(result.status, 413);
    assert.equal(result.body.code, 'PHOTO_TOO_LARGE');
  });

  await t.test('audio analysis validates file type and degrades cleanly', async (t) => {
    const mismatch = new FormData();
    mismatch.append('vehicleType', 'car');
    mismatch.append('kind', 'audio');
    mismatch.append('file', new Blob([new Uint8Array([0, 0, 0])], { type: 'video/mp4' }), 'clip.mp4');

    const rejected = await api('/v1/media/analyze', { method: 'POST', body: mismatch });
    assert.equal(rejected.status, 400);
    assert.match(rejected.body.error, /is a video/);

    const unsupported = new FormData();
    unsupported.append('vehicleType', 'car');
    unsupported.append('kind', 'audio');
    unsupported.append('file', new Blob(['hello'], { type: 'text/plain' }), 'notes.txt');

    const badType = await api('/v1/media/analyze', { method: 'POST', body: unsupported });
    assert.equal(badType.status, 400);
    assert.match(badType.body.error, /Unsupported audio type/);

    // A valid one-second mono PCM WAV lets the route reach the ffmpeg/AI
    // boundary. Without ffmpeg it fails there; with ffmpeg it reaches the
    // unconfigured AI provider. Either way it must be a clear 503.
    const sampleRate = 16_000;
    const sampleCount = sampleRate;
    const dataSize = sampleCount * 2;
    const wav = Buffer.alloc(44 + dataSize);
    wav.write('RIFF', 0);
    wav.writeUInt32LE(36 + dataSize, 4);
    wav.write('WAVE', 8);
    wav.write('fmt ', 12);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(sampleRate, 24);
    wav.writeUInt32LE(sampleRate * 2, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(dataSize, 40);

    const form = new FormData();
    form.append('vehicleType', 'car');
    form.append('kind', 'audio');
    form.append('context', 'When braking');
    form.append('file', new Blob([wav], { type: 'audio/wav' }), 'brake.wav');

    const result = await api('/v1/media/analyze', { method: 'POST', body: form });
    assert.equal(result.status, 503);
    assert.ok(['AI_NOT_CONFIGURED', 'FFMPEG_NOT_FOUND'].includes(result.body.code));
  });

  await t.test('video analysis reports missing ffmpeg clearly when unavailable', async (t) => {
    const health = await api('/health');
    if (health.body.videoAnalysis !== 'unavailable') {
      t.skip('ffmpeg is available on this machine');
      return;
    }

    const form = new FormData();
    form.append('vehicleType', 'car');
    form.append('kind', 'video');
    form.append(
      'file',
      new Blob([new Uint8Array([0, 0, 0, 0])], { type: 'video/mp4' }),
      'clip.mp4'
    );

    const result = await api('/v1/media/analyze', { method: 'POST', body: form });
    assert.equal(result.status, 503);
    assert.equal(result.body.code, 'FFMPEG_NOT_FOUND');
    assert.match(result.body.error, /ffmpeg/i);
  });

  await t.test('malformed JSON and unknown routes return JSON errors', async () => {
    const malformed = await api('/vehicles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"oops":',
    });
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.code, 'INVALID_JSON');

    const missing = await api('/nope');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.code, 'NOT_FOUND');
  });

  await t.test('deleting a vehicle removes its history', async () => {
    const deleted = await api(`/vehicles/${carId}`, { method: 'DELETE' });
    assert.equal(deleted.status, 204);

    const vehicle = await api(`/vehicles/${carId}`);
    assert.equal(vehicle.status, 404);

    const history = await api(`/vehicles/${carId}/history`);
    assert.equal(history.status, 404);

    const diagnosis = await api(`/diagnoses/${carDiagnosisId}`);
    assert.equal(diagnosis.status, 404);
  });

  await t.test('logout revokes the session', async () => {
    const loggedOut = await api('/auth/logout', { method: 'POST' });
    assert.equal(loggedOut.status, 204);

    const after = await api('/vehicles');
    assert.equal(after.status, 401);
    assert.equal(after.body.code, 'AUTH_REQUIRED');
  });
});
