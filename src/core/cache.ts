/**
 * In-memory TTL cache with pattern-based invalidation
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

const store = new Map<string, CacheEntry<unknown>>();

/**
 * Get a cached value. Returns null if missing or expired.
 */
export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

/**
 * Store a value with optional TTL override (default 5 min).
 */
export function setCache<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Clear cache entries. If pattern provided, clears matching keys (substring match).
 * If no pattern, clears everything.
 */
export function clearCache(pattern?: string): number {
  if (!pattern) {
    const count = store.size;
    store.clear();
    return count;
  }

  let count = 0;
  for (const key of store.keys()) {
    if (key.includes(pattern)) {
      store.delete(key);
      count++;
    }
  }
  return count;
}

/**
 * Remove all expired entries (housekeeping).
 */
export function purgeExpired(): number {
  const now = Date.now();
  let count = 0;
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) {
      store.delete(key);
      count++;
    }
  }
  return count;
}

/**
 * Current cache size (including expired entries).
 */
export function cacheSize(): number {
  return store.size;
}
