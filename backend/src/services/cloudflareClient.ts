import { config } from '../config';
import { extractJsonObject } from './aiJson';
import { AiContentBlock, AiNotConfiguredError, AiRequestError } from './aiTypes';

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504, 529]);

type CloudflareTextPart = { type: 'text'; text: string };
type CloudflareImagePart = {
  type: 'image_url';
  image_url: { url: string };
};
type CloudflareUserPart = CloudflareTextPart | CloudflareImagePart;

export interface CloudflareRequestPayload {
  messages: Array<{
    role: 'system' | 'user';
    content: string | CloudflareUserPart[];
  }>;
  max_tokens: number;
  temperature: number;
  stream: false;
}

export interface CloudflareResponse {
  result?: string | { response?: string; usage?: unknown };
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  messages?: string[];
}

function imageDataUrl(block: Extract<AiContentBlock, { type: 'image' }>): string {
  return `data:${block.mediaType};base64,${block.data}`;
}

function isLegacyLlamaVisionModel(model: string): boolean {
  return /llama-3\.2-(?:11b|90b)-vision/i.test(model);
}

/**
 * Build a Workers AI request.
 *
 * Both models accept OpenAI-style text/image parts inside `messages`. Mistral
 * Small 3.1 can inspect a video's three sampled frames together; Llama 3.2
 * Vision documents only one image, so that fallback receives the first frame
 * rather than pretending it saw all of them.
 */
export function buildCloudflareRequestBody(
  systemPrompt: string,
  userContent: AiContentBlock[],
  model: string
): CloudflareRequestPayload {
  const text = userContent
    .filter((block): block is Extract<AiContentBlock, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
  const images = userContent.filter(
    (block): block is Extract<AiContentBlock, { type: 'image' }> => block.type === 'image'
  );

  const base: CloudflareRequestPayload = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ],
    max_tokens: 4096,
    temperature: 0.15,
    stream: false,
  };

  if (images.length === 0) return base;

  const imagesToSend = isLegacyLlamaVisionModel(model) ? images.slice(0, 1) : images;
  const parts: CloudflareUserPart[] = [];
  if (text) parts.push({ type: 'text', text });
  for (const image of imagesToSend) {
    parts.push({ type: 'image_url', image_url: { url: imageDataUrl(image) } });
  }

  return {
    ...base,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: parts },
    ],
  };
}

function describeApiError(status: number, body: string): string {
  let detail = body.trim();
  try {
    const parsed = JSON.parse(body) as CloudflareResponse;
    const errors = (parsed.errors ?? [])
      .map((item) => item.message)
      .filter((message): message is string => typeof message === 'string' && message.length > 0);
    if (errors.length > 0) {
      detail = errors.join('; ');
    } else if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
      detail = parsed.messages.join('; ');
    }
  } catch {
    // Keep the raw text when the body isn't JSON.
  }

  const suffix = detail ? `: ${detail.slice(0, 300)}` : '';
  return `Cloudflare Workers AI request failed (${status})${suffix}`;
}

export function extractCloudflareResponseText(data: CloudflareResponse): string {
  const errors = (data.errors ?? [])
    .map((item) => item.message)
    .filter((message): message is string => typeof message === 'string' && message.length > 0);

  if (data.success === false || errors.length > 0) {
    throw new AiRequestError(
      `Cloudflare Workers AI returned an error${errors.length ? `: ${errors.join('; ')}` : ''}`
    );
  }

  const result = data.result;
  const text =
    typeof result === 'string'
      ? result
      : result && typeof result.response === 'string'
        ? result.response
        : '';

  if (!text.trim()) {
    throw new AiRequestError('Cloudflare Workers AI returned an empty response');
  }

  return text;
}

/**
 * Send one turn to Cloudflare Workers AI and parse the model's JSON reply.
 *
 * The API token and account id are read only from the server environment. The
 * app never receives either value.
 */
export async function askCloudflareForJson<T>(
  systemPrompt: string,
  userContent: AiContentBlock[]
): Promise<T> {
  if (!config.cloudflareAccountId || !config.cloudflareApiToken) {
    throw new AiNotConfiguredError();
  }

  const hasImages = userContent.some((block) => block.type === 'image');
  const model = hasImages ? config.cloudflareVisionModel : config.cloudflareModel;

  if (!/^[A-Za-z0-9@._/-]+$/.test(model)) {
    throw new AiRequestError(
      'CLOUDFLARE_MODEL/CLOUDFLARE_VISION_MODEL contains characters that are not valid in a Workers AI model id'
    );
  }

  const url = `${config.cloudflareApiBaseUrl.replace(/\/+$/, '')}/accounts/${encodeURIComponent(
    config.cloudflareAccountId
  )}/ai/run/${model}`;
  const body = JSON.stringify(buildCloudflareRequestBody(systemPrompt, userContent, model));

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
        body,
        signal: AbortSignal.timeout(config.aiTimeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new AiRequestError(
          `Cloudflare Workers AI request timed out after ${Math.round(config.aiTimeoutMs / 1000)}s`
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
      let data: CloudflareResponse;
      try {
        data = JSON.parse(raw) as CloudflareResponse;
      } catch {
        throw new AiRequestError('Cloudflare Workers AI returned a response that was not valid JSON');
      }

      const text = extractCloudflareResponseText(data);

      try {
        return extractJsonObject(text) as T;
      } catch {
        throw new AiRequestError(
          `Cloudflare Workers AI returned a response that wasn't valid JSON: ${text.slice(0, 200)}`
        );
      }
    }

    const detail = await response.text().catch(() => '');
    lastError = new AiRequestError(describeApiError(response.status, detail), response.status);

    if (!RETRYABLE_STATUS.has(response.status) || attempt === 1) {
      throw lastError;
    }

    // Back off briefly before the single retry.
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw lastError ?? new AiRequestError('Cloudflare Workers AI request failed');
}
