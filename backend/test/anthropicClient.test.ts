import assert from 'node:assert/strict';
import test from 'node:test';

// Keep the unit test offline and independent of a developer's local .env.
process.env.ANTHROPIC_API_KEY = '';

test('Claude request omits sampling parameters rejected by current models', async () => {
  const { buildClaudeRequestBody } = await import('../src/services/anthropicClient');
  const body = buildClaudeRequestBody('system prompt', [
    { type: 'text', text: 'What is this noise?' },
  ]);

  assert.equal(typeof body.model, 'string');
  assert.ok(body.max_tokens >= 4096);
  assert.equal(body.system, 'system prompt');
  assert.equal(body.messages.length, 1);
  assert.equal(body.messages[0].role, 'user');
  assert.ok(!('temperature' in body));
  assert.ok(!('top_p' in body));
  assert.ok(!('top_k' in body));
});

test('AI endpoints fail with an actionable error when the key is absent', async () => {
  const { askClaudeForJson, MissingApiKeyError } = await import(
    '../src/services/anthropicClient'
  );

  await assert.rejects(
    () => askClaudeForJson('system prompt', [{ type: 'text', text: 'hello' }]),
    (error: unknown) =>
      error instanceof MissingApiKeyError && /ANTHROPIC_API_KEY/.test(error.message)
  );
});
