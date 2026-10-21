import { VehicleType } from './types';

/**
 * Small HTTP error type shared by every route.
 *
 * The response body intentionally keeps the original `{ "error": "..." }`
 * shape used by the mobile app, and adds an optional machine-readable
 * `code` and `details` for clients that want to react to specific failures.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code = 'HTTP_ERROR', details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message: string, details?: unknown): HttpError {
  return new HttpError(400, message, 'VALIDATION_ERROR', details);
}

export function notFound(message: string): HttpError {
  return new HttpError(404, message, 'NOT_FOUND');
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const VEHICLE_TYPES: VehicleType[] = ['car', 'motorcycle'];

export function isVehicleType(value: unknown): value is VehicleType {
  return typeof value === 'string' && VEHICLE_TYPES.includes(value as VehicleType);
}

export function requireVehicleType(value: unknown, field = 'vehicleType'): VehicleType {
  if (!isVehicleType(value)) {
    throw badRequest(`${field} must be one of: ${VEHICLE_TYPES.join(', ')}`);
  }
  return value;
}

export function requireString(
  value: unknown,
  field: string,
  options: { min?: number; max?: number } = {}
): string {
  const { min = 1, max = 200 } = options;
  if (typeof value !== 'string') {
    throw badRequest(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min) {
    throw badRequest(
      min === 1 ? `${field} is required` : `${field} must be at least ${min} characters`
    );
  }
  if (trimmed.length > max) {
    throw badRequest(`${field} must be at most ${max} characters`);
  }
  return trimmed;
}

export function optionalString(
  value: unknown,
  field: string,
  options: { max?: number } = {}
): string | undefined {
  if (value === undefined) return undefined;
  return requireString(value, field, { min: 0, ...options });
}

/** `null` clears the field; `undefined` leaves it untouched. */
export function optionalNullableString(
  value: unknown,
  field: string,
  options: { max?: number } = {}
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = requireString(value, field, { min: 0, ...options });
  return trimmed.length === 0 ? null : trimmed;
}

export function requireInt(
  value: unknown,
  field: string,
  options: { min: number; max: number }
): number {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isInteger(number)) {
    throw badRequest(`${field} must be an integer`);
  }
  if (number < options.min || number > options.max) {
    throw badRequest(`${field} must be between ${options.min} and ${options.max}`);
  }
  return number;
}

export function optionalInt(
  value: unknown,
  field: string,
  options: { min: number; max: number }
): number | undefined {
  if (value === undefined) return undefined;
  return requireInt(value, field, options);
}

export function parseLimit(value: unknown, fallback = 100, max = 200): number {
  if (value === undefined) return fallback;
  return requireInt(value, 'limit', { min: 1, max });
}
