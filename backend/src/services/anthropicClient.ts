import { config } from '../config';

const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 529]);

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      'AI features are not configured on this server. Set ANTHROPIC_API_KEY in the backend environment and restart or redeploy the API.'
    );
    this.name = 'MissingApiKeyError';
  }
}

export class AnthropicRequestError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AnthropicRequestError';
    this.status = status;
  }
}

export type AnthropicImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: { type: 'base64'; media_type: AnthropicImageMediaType; data: string };
    };

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  stop_reason?: string;
  error?: { type?: string; message?: string };
}

interface AnthropicRequestPayload {
  model: string;
  max_tokens: number;
  system: string;
  messages: { role: 'user'; content: AnthropicContentBlock[] }[];
}

/**
 * Build the Messages API request body.
 *
 * Current Claude models (including the default `claude-sonnet-5-5`) reject
 * `temperature`, `top_p` and `top_k` with a 400, so this integration
 * deliberately does not send sampling parameters. JSON discipline comes from
 * the system prompt instead.
 */
export function buildClaudeRequestBody(
  systemPrompt: string,
  userContent: AnthropicContentBlock[]
): AnthropicRequestPayload {
  return {
    model: config.anthropicModel,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  };
}

function describeApiError(status: number, body: string): string {
  let detail = body.trim();
  try {
    const parsed = JSON.parse(body) as AnthropicResponse;
    if (parsed.error?.message) detail = parsed.error.message;
  } catch {
    // Keep the raw text when the response isn't JSON.
  }
  const suffix = detail ? `: ${detail.slice(0, 300)}` : '';
  return `Claude API request failed (${status})${suffix}`;
}

function extractJson(text: string): unknown {
  // Models occasionally wrap JSON in a markdown fence despite instructions.
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const candidate =
    firstBrace !== -1 && lastBrace > firstBrace
      ? cleaned.slice(firstBrace, lastBrace + 1)
      : cleaned;

  try {
    return JSON.parse(candidate);
  } catch {
    throw new AnthropicRequestError(
      `Claude returned a response that wasn't valid JSON: ${candidate.slice(0, 200)}`
    );
  }
}

/**
 * Sends a single-turn message to the Claude Messages API and returns the
 * parsed JSON object from its reply. Every caller asks Claude to respond with
 * JSON only, so the fence-stripping, retry and timeout logic lives here once.
 *
 * Retries once on rate-limit / overload responses. The API key is only ever
 * read from the server environment and is never sent to the mobile app.
 */
export async function askClaudeForJson<T>(
  systemPrompt: string,
  userContent: AnthropicContentBlock[]
): Promise<T> {
  if (!config.anthropicApiKey) {
    throw new MissingApiKeyError();
  }

  const body = JSON.stringify(buildClaudeRequestBody(systemPrompt, userContent));

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'anthropic-version': ANTHROPIC_VERSION,
          'x-api-key': config.anthropicApiKey,
        },
        body,
        signal: AbortSignal.timeout(config.aiTimeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new AnthropicRequestError(
          `Claude API request timed out after ${Math.round(config.aiTimeoutMs / 1000)}s`
        );
      }
      throw new AnthropicRequestError(
        `Could not reach the Claude API: ${error instanceof Error ? error.message : 'network error'}`
      );
    }

    if (response.ok) {
      const data = (await response.json()) as AnthropicResponse;

      if (data.stop_reason === 'max_tokens') {
        throw new AnthropicRequestError(
          'Claude hit the output token limit before returning a complete result. Try a shorter prompt or a smaller image.'
        );
      }

      const text = (data.content ?? [])
        .filter((block) => block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('\n')
        .trim();

      if (!text) {
        throw new AnthropicRequestError('Claude returned an empty response');
      }

      return extractJson(text) as T;
    }

    const detail = await response.text().catch(() => '');
    lastError = new AnthropicRequestError(describeApiError(response.status, detail), response.status);

    if (!RETRYABLE_STATUS.has(response.status) || attempt === 1) {
      throw lastError;
    }

    // Back off briefly before the single retry.
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw lastError ?? new AnthropicRequestError('Claude API request failed');
}
