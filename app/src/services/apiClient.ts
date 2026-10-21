/**
 * Single HTTP entry point for the app.
 *
 * - Normalises the configured base URL (no trailing slash, no stray spaces).
 * - Adds a timeout so a wrong LAN IP fails in a useful way instead of hanging.
 * - Turns non-2xx responses into `ApiError` with the backend's message/code.
 *
 * Every request goes through here. A hosted backend can require the shared
 * `EXPO_PUBLIC_API_ACCESS_TOKEN`; see docs/ARCHITECTURE.md for why that is an
 * abuse gate rather than full user authentication.
 */

const RAW_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const API_BASE_URL = RAW_BASE_URL.trim().replace(/\/+$/, '') || 'http://localhost:3000';
const API_ACCESS_TOKEN = (process.env.EXPO_PUBLIC_API_ACCESS_TOKEN ?? '').trim();

const DEFAULT_TIMEOUT_MS = 20_000;

/** AI calls legitimately take longer than a normal CRUD request. */
export const AI_TIMEOUT_MS = 90_000;

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface ParsedError {
  message: string;
  code?: string;
}

async function parseErrorMessage(response: Response): Promise<ParsedError> {
  try {
    const body = (await response.json()) as { error?: unknown; code?: unknown };
    if (typeof body?.error === 'string') {
      return {
        message: body.error,
        code: typeof body.code === 'string' ? body.code : undefined,
      };
    }
  } catch {
    // Response wasn't JSON — fall through to the generic message.
  }
  return { message: `Request failed (${response.status})` };
}

function assertValidBaseUrl(): void {
  if (!/^https?:\/\/\S+$/i.test(API_BASE_URL)) {
    throw new ApiError(
      0,
      `EXPO_PUBLIC_API_BASE_URL is not a valid URL ("${RAW_BASE_URL}"). It should look like https://torquedoc-api.onrender.com — no spaces; include a port only if the backend uses one.`
    );
  }
}

export interface ApiFetchOptions {
  /** Override the default 20s timeout (AI endpoints use 90s). */
  timeoutMs?: number;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  options: ApiFetchOptions = {}
): Promise<T> {
  assertValidBaseUrl();

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        // Only JSON string bodies get this header; FormData must set its own
        // multipart boundary or uploads will fail.
        ...(typeof init?.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
        // Public deployments can require a shared key. This value is bundled
        // into the app, so it is an abuse gate, not user authentication.
        ...(API_ACCESS_TOKEN ? { 'X-TorqueDoc-Key': API_ACCESS_TOKEN } : {}),
        ...init?.headers,
      },
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ApiError(
        0,
        `The request to ${API_BASE_URL} timed out after ${Math.round(timeoutMs / 1000)}s. Check that the backend is running and reachable on your network.`
      );
    }
    throw new ApiError(
      0,
      `Couldn't reach the TorqueDoc server at ${API_BASE_URL}. Check that the backend is online and that EXPO_PUBLIC_API_BASE_URL points to it.`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const { message, code } = await parseErrorMessage(response);
    throw new ApiError(response.status, message, code);
  }

  // 204 No Content (used by DELETE) has no body to parse.
  if (response.status === 204) {
    return undefined as T;
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(response.status, 'The server returned an invalid JSON response.');
  }
}

export { API_BASE_URL };
