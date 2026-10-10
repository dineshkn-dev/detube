interface Entry {
  value: unknown;
  expiresAt: number;
}

export interface TtlCache {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs: number): void;
  clear(): void;
}

/**
 * A tiny TTL cache. Kept in-memory (and therefore ephemeral) to respect the
 * YouTube API terms around not retaining API data — nothing is written to disk.
 */
export function createTtlCache(now: () => number = Date.now): TtlCache {
  const entries = new Map<string, Entry>();
  return {
    get<T>(key: string): T | undefined {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return undefined;
      }
      return entry.value as T;
    },
    set<T>(key: string, value: T, ttlMs: number): void {
      entries.set(key, { value, expiresAt: now() + ttlMs });
    },
    clear(): void {
      entries.clear();
    },
  };
}

/** Returns the cached value or runs `producer`, caching a non-null result. */
export async function cached<T>(
  cache: TtlCache,
  key: string,
  ttlMs: number,
  producer: () => Promise<T>,
): Promise<T> {
  const hit = cache.get<T>(key);
  if (hit !== undefined) return hit;
  const value = await producer();
  if (value !== null && value !== undefined) cache.set(key, value, ttlMs);
  return value;
}
