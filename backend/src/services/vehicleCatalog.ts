import {
  CAR_FALLBACK_MAKES,
  FALLBACK_CAR_MODELS,
  FALLBACK_MOTORCYCLE_MODELS,
  MACHINE_CATALOG,
  MOTORCYCLE_FALLBACK_MAKES,
} from '../data/vehicleCatalog';
import { VehicleType, isMachineType } from '../types';

/**
 * Make/model lookup for the garage form.
 *
 * NHTSA vPIC is free, has no API key, and publishes current model-year
 * vehicles. We query it server-side (so the mobile app never needs a browser
 * CORS workaround) and cache responses in memory for a day. If NHTSA is down
 * or slow, a curated offline list keeps the picker useful and the user can
 * always type a value manually.
 */

const NHTSA_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles';
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const FAILURE_TTL_MS = 2 * 60 * 1_000;
const REQUEST_TIMEOUT_MS = 7_000;

export type CatalogSource = 'nhtsa' | 'fallback' | 'builtin';

export interface MakeCatalog {
  type: VehicleType;
  makes: string[];
  source: CatalogSource;
}

export interface ModelCatalog {
  type: VehicleType;
  make: string;
  year: number;
  models: string[];
  source: CatalogSource;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const makesCache = new Map<string, CacheEntry<MakeCatalog>>();
const modelsCache = new Map<string, CacheEntry<ModelCatalog>>();

interface NhtsaMakesResponse {
  Results?: Array<{ MakeName?: unknown }>;
}

interface NhtsaModelsResponse {
  Results?: Array<{ ModelName?: unknown }>;
}

const ACRONYM_MAKES = new Set([
  'BMW',
  'BYD',
  'DS',
  'GMC',
  'MG',
  'MINI',
  'RAM',
  'SRT',
  'TVR',
  'VPG',
]);

function titleCaseWord(word: string): string {
  if (ACRONYM_MAKES.has(word.toUpperCase())) return word.toUpperCase();
  return word
    .toLowerCase()
    .replace(/(^|[-'])([a-z])/g, (_match, separator: string, letter: string) => {
      return `${separator}${letter.toUpperCase()}`;
    });
}

/** NHTSA returns makes in all caps; give the picker a clean display value. */
export function formatMakeName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(titleCaseWord)
    .join(' ');
}

export function cleanModelNames(values: unknown[]): string[] {
  const seen = new Set<string>();
  const models: string[] = [];

  for (const value of values) {
    if (typeof value !== 'string') continue;
    const cleaned = value.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    models.push(cleaned);
  }

  return models.sort((a, b) => a.localeCompare(b));
}

function readCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function writeCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttl = CACHE_TTL_MS
): T {
  cache.set(key, { value, expiresAt: Date.now() + ttl });
  return value;
}

async function fetchNhtsa<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`NHTSA returned HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

function fallbackMakes(type: 'car' | 'motorcycle'): string[] {
  return type === 'car' ? CAR_FALLBACK_MAKES : MOTORCYCLE_FALLBACK_MAKES;
}

function fallbackModels(type: 'car' | 'motorcycle', make: string): string[] {
  const source = type === 'car' ? FALLBACK_CAR_MODELS : FALLBACK_MOTORCYCLE_MODELS;
  const match = Object.keys(source).find(
    (candidate) => candidate.toLowerCase() === make.trim().toLowerCase()
  );
  return match ? source[match] : [];
}

export async function getMakesForType(type: VehicleType): Promise<MakeCatalog> {
  if (isMachineType(type)) {
    const key = `machine:${type}`;
    const cached = readCache(makesCache, key);
    if (cached) return cached;
    return writeCache(makesCache, key, {
      type,
      makes: MACHINE_CATALOG[type].makes,
      source: 'builtin',
    });
  }

  const cacheKey = `nhtsa:${type}`;
  const cached = readCache(makesCache, cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchNhtsa<NhtsaMakesResponse>(
      `${NHTSA_BASE}/GetMakesForVehicleType/${type}?format=json`
    );
    const makes = Array.from(
      new Set(
        (data.Results ?? [])
          .map((item) => (typeof item.MakeName === 'string' ? formatMakeName(item.MakeName) : ''))
          .filter((make) => make.length > 0)
      )
    ).sort((a, b) => a.localeCompare(b));

    if (makes.length === 0) throw new Error('NHTSA returned no makes');
    return writeCache(makesCache, cacheKey, { type, makes, source: 'nhtsa' });
  } catch (error) {
    console.warn(
      `Vehicle catalog: NHTSA makes unavailable for ${type}; using the offline list (${
        error instanceof Error ? error.message : 'unknown error'
      }).`
    );
    return writeCache(
      makesCache,
      cacheKey,
      { type, makes: fallbackMakes(type), source: 'fallback' },
      FAILURE_TTL_MS
    );
  }
}

export async function getModelsForType(
  type: VehicleType,
  make: string,
  year: number
): Promise<ModelCatalog> {
  const cleanMake = make.trim().replace(/\s+/g, ' ').slice(0, 60);

  if (isMachineType(type)) {
    const key = `machine:${type}:${cleanMake.toLowerCase()}`;
    const cached = readCache(modelsCache, key);
    if (cached) return cached;

    const catalog = MACHINE_CATALOG[type];
    const match = catalog.makes.find(
      (candidate) => candidate.toLowerCase() === cleanMake.toLowerCase()
    );
    return writeCache(modelsCache, key, {
      type,
      make: match ?? cleanMake,
      year,
      models: match ? catalog.models[match] ?? [] : [],
      source: 'builtin',
    });
  }

  const cacheKey = `nhtsa:${type}:${cleanMake.toLowerCase()}:${year}`;
  const cached = readCache(modelsCache, cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchNhtsa<NhtsaModelsResponse>(
      `${NHTSA_BASE}/GetModelsForMakeYear/make/${encodeURIComponent(
        cleanMake
      )}/modelyear/${year}?format=json&vehicleType=${type}`
    );
    const models = cleanModelNames((data.Results ?? []).map((item) => item.ModelName));

    if (models.length === 0) {
      const fallback = fallbackModels(type, cleanMake);
      if (fallback.length > 0) {
        return writeCache(
          modelsCache,
          cacheKey,
          { type, make: cleanMake, year, models: fallback, source: 'fallback' },
          FAILURE_TTL_MS
        );
      }
      return writeCache(
        modelsCache,
        cacheKey,
        { type, make: cleanMake, year, models: [], source: 'fallback' },
        FAILURE_TTL_MS
      );
    }

    return writeCache(modelsCache, cacheKey, {
      type,
      make: cleanMake,
      year,
      models,
      source: 'nhtsa',
    });
  } catch (error) {
    const fallback = fallbackModels(type, cleanMake);
    console.warn(
      `Vehicle catalog: NHTSA models unavailable for ${cleanMake} ${year}; using ${
        fallback.length > 0 ? 'the offline list' : 'manual entry'
      } (${error instanceof Error ? error.message : 'unknown error'}).`
    );
    return writeCache(
      modelsCache,
      cacheKey,
      { type, make: cleanMake, year, models: fallback, source: 'fallback' },
      FAILURE_TTL_MS
    );
  }
}
