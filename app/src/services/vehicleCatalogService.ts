import { apiFetch } from './apiClient';
import { VehicleType } from '../types';

export interface MakeCatalog {
  type: VehicleType;
  makes: string[];
  source: 'nhtsa' | 'fallback' | 'builtin';
}

export interface ModelCatalog {
  type: VehicleType;
  make: string;
  year: number;
  models: string[];
  source: 'nhtsa' | 'fallback' | 'builtin';
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const TTL_MS = 10 * 60 * 1_000;
const makesCache = new Map<string, CacheEntry<MakeCatalog>>();
const modelsCache = new Map<string, CacheEntry<ModelCatalog>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

/**
 * The backend proxies NHTSA vPIC and falls back to a built-in list, so this
 * client never needs a browser CORS workaround or an API key.
 */
export async function fetchMakes(type: VehicleType): Promise<MakeCatalog> {
  const cached = getCached(makesCache, type);
  if (cached) return cached;

  const result = await apiFetch<MakeCatalog>(`/vehicle-catalog/makes?type=${type}`);
  makesCache.set(type, { value: result, expiresAt: Date.now() + TTL_MS });
  return result;
}

export async function fetchModels(
  type: VehicleType,
  make: string,
  year: number
): Promise<ModelCatalog> {
  const cleanMake = make.trim();
  const key = `${type}:${cleanMake.toLowerCase()}:${year}`;
  const cached = getCached(modelsCache, key);
  if (cached) return cached;

  const result = await apiFetch<ModelCatalog>(
    `/vehicle-catalog/models?type=${type}&make=${encodeURIComponent(cleanMake)}&year=${year}`
  );
  modelsCache.set(key, { value: result, expiresAt: Date.now() + TTL_MS });
  return result;
}
