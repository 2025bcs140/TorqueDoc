import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';

/**
 * Exercises the real `fetch` path against a local mock of the Workers AI REST
 * endpoint. The live provider still needs a real Cloudflare token; this test
 * catches request-shape, header, URL and response-parsing regressions offline.
 */
test('Cloudflare adapter sends the documented request and parses the reply', async (t) => {
  let request:
    | { url?: string; authorization?: string; body: string }
    | undefined;

  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      request = {
        url: req.url,
        authorization: req.headers.authorization,
        body,
      };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          result: {
            response:
              '{"matchedSymptomIds":["s_brake_squeal"],"summary":"A squeal when braking."}',
          },
        })
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const address = server.address() as AddressInfo;
  process.env.CLOUDFLARE_ACCOUNT_ID = 'a'.repeat(32);
  process.env.CLOUDFLARE_API_TOKEN = `test-token-${'b'.repeat(30)}`;
  process.env.CLOUDFLARE_API_BASE_URL = `http://127.0.0.1:${address.port}`;

  const { askCloudflareForJson } = await import('../src/services/cloudflareClient');
  const result = await askCloudflareForJson<{
    matchedSymptomIds: string[];
    summary: string;
  }>('system prompt', [{ type: 'text', text: 'Squeal when braking' }]);

  assert.deepEqual(result, {
    matchedSymptomIds: ['s_brake_squeal'],
    summary: 'A squeal when braking.',
  });
  assert.ok(request);
  assert.match(request!.url ?? '', /\/accounts\/a{32}\/ai\/run\/@cf\/mistralai\//);
  assert.equal(request!.authorization, `Bearer test-token-${'b'.repeat(30)}`);

  const body = JSON.parse(request!.body) as {
    messages: { role: string; content: unknown }[];
    max_tokens: number;
  };
  assert.equal(body.messages[0].role, 'system');
  assert.equal(body.messages[1].role, 'user');
  assert.equal(body.max_tokens, 4096);
});
