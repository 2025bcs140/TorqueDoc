import assert from 'node:assert/strict';
import test from 'node:test';

// Keep unit tests offline and independent of a developer's local .env.
process.env.CLOUDFLARE_ACCOUNT_ID = '';
process.env.CLOUDFLARE_API_TOKEN = '';
process.env.ANTHROPIC_API_KEY = '';

test('Cloudflare request maps text and image blocks to Workers AI messages', async () => {
  const { buildCloudflareRequestBody } = await import('../src/services/cloudflareClient');
  const body = buildCloudflareRequestBody(
    'system prompt',
    [
      { type: 'text', text: 'What is this leak?' },
      { type: 'image', mediaType: 'image/jpeg', data: 'abc123' },
    ],
    '@cf/mistralai/mistral-small-3.1-24b-instruct'
  );

  assert.equal(body.messages[0].role, 'system');
  assert.equal(body.messages[0].content, 'system prompt');
  assert.equal(body.messages[1].role, 'user');
  assert.ok(Array.isArray(body.messages[1].content));
  assert.deepEqual(body.messages[1].content, [
    { type: 'text', text: 'What is this leak?' },
    { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,abc123' } },
  ]);
  assert.equal(body.max_tokens, 4096);
  assert.equal(body.stream, false);
});

test('Cloudflare request uses the documented top-level image for Llama 3.2 Vision', async () => {
  const { buildCloudflareRequestBody } = await import('../src/services/cloudflareClient');
  const body = buildCloudflareRequestBody(
    'system prompt',
    [
      { type: 'text', text: 'Inspect the frame' },
      { type: 'image', mediaType: 'image/png', data: 'frame1' },
      { type: 'image', mediaType: 'image/png', data: 'frame2' },
    ],
    '@cf/meta/llama-3.2-11b-vision-instruct'
  );

  assert.equal(body.image, 'data:image/png;base64,frame1');
  assert.equal(body.messages[1].content, 'Inspect the frame');
});

test('Cloudflare response parser accepts the Workers AI result shape', async () => {
  const { extractCloudflareResponseText } = await import('../src/services/cloudflareClient');
  assert.equal(
    extractCloudflareResponseText({
      success: true,
      result: { response: '{"matchedSymptomIds":[],"summary":"ok"}' },
    }),
    '{"matchedSymptomIds":[],"summary":"ok"}'
  );
  assert.equal(
    extractCloudflareResponseText({ success: true, result: 'plain text result' }),
    'plain text result'
  );
});

test('Cloudflare adapter fails with an actionable error when credentials are absent', async () => {
  const { askCloudflareForJson } = await import('../src/services/cloudflareClient');
  const { AiNotConfiguredError } = await import('../src/services/aiTypes');

  await assert.rejects(
    () => askCloudflareForJson('system prompt', [{ type: 'text', text: 'hello' }]),
    (error: unknown) =>
      error instanceof AiNotConfiguredError &&
      /CLOUDFLARE_ACCOUNT_ID/.test(error.message) &&
      /CLOUDFLARE_API_TOKEN/.test(error.message)
  );
});
