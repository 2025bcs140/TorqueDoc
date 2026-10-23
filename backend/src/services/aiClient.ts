import { config } from '../config';
import { askClaudeForJson } from './anthropicClient';
import { askCloudflareForJson } from './cloudflareClient';
import {
  AiContentBlock,
  AiNotConfiguredError,
  AiRequestError,
  AiImageMediaType,
} from './aiTypes';

export type { AiContentBlock, AiImageMediaType };
export { AiNotConfiguredError, AiRequestError };

export type AiProvider = 'cloudflare' | 'anthropic';

/**
 * Cloudflare Workers AI is preferred when configured because its free tier has
 * zero retention and does not train on submitted content. Anthropic remains a
 * supported fallback for anyone who already has credits.
 */
export function getConfiguredAiProvider(): AiProvider | null {
  return config.aiProvider;
}

export function getConfiguredAiModel(): string | null {
  return config.aiModel;
}

export async function askAiForJson<T>(
  systemPrompt: string,
  userContent: AiContentBlock[]
): Promise<T> {
  if (config.aiProvider === 'cloudflare') {
    return askCloudflareForJson<T>(systemPrompt, userContent);
  }

  if (config.aiProvider === 'anthropic') {
    return askClaudeForJson<T>(systemPrompt, userContent);
  }

  throw new AiNotConfiguredError();
}
