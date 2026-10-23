/**
 * Provider-neutral types shared by the Anthropic and Cloudflare adapters.
 *
 * Routes only describe what they want to ask the model (text and/or images).
 * Each adapter translates that into its provider's wire format.
 */

export type AiImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export type AiContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: AiImageMediaType; data: string };

export class AiNotConfiguredError extends Error {
  constructor(
    message = 'AI features are not configured on this server. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (Workers AI) in the backend environment and restart or redeploy the API.'
  ) {
    super(message);
    this.name = 'AiNotConfiguredError';
  }
}

export class AiRequestError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AiRequestError';
    this.status = status;
  }
}
