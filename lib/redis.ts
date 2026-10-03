import { Redis } from '@upstash/redis';

let redisInstance: Redis | null = null;

export function isRedisConfigured(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || typeof url !== 'string' || url.startsWith('your_upstash') || url === '[SENSITIVE]' || url === 'disabled') {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Lazy-initializes Upstash Redis client instance if configured.
 * Returns null if environment variables are not set.
 */
export function getRedisClient(): Redis | null {
  if (!isRedisConfigured()) {
    return null;
  }
  if (!redisInstance) {
    try {
      redisInstance = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
    } catch (err) {
      console.warn('[Redis] Failed to initialize Upstash Redis:', err);
      return null;
    }
  }
  return redisInstance;
}

export const redis = {
  get: async <T>(key: string) => getRedisClient()?.get<T>(key) ?? null,
  set: async (key: string, value: unknown, opts?: { ex?: number }) => {
    const client = getRedisClient()
    if (!client) return null
    if (opts?.ex !== undefined) {
      return client.set(key, value, { ex: opts.ex })
    }
    return client.set(key, value)
  },
  del: async (...keys: string[]) => getRedisClient()?.del(...keys),
  keys: async (pattern: string) => getRedisClient()?.keys(pattern) ?? [],
  // Set operations backing the tag/prefix indexes (see lib/cache.ts).
  sadd: async (key: string, ...members: string[]) =>
    members.length ? (getRedisClient()?.sadd(key, members[0], ...members.slice(1)) ?? 0) : 0,
  smembers: async (key: string) => getRedisClient()?.smembers(key) ?? [],

  /**
   * Cursor-based, non-blocking replacement for `KEYS`.
   *
   * `KEYS` is O(N) over the entire keyspace and blocks Redis' single command
   * loop for the duration — on Upstash it is also billed and rate-limited as a
   * single heavy command. `SCAN` walks the keyspace incrementally in bounded
   * batches, so it never stalls other traffic. This helper drives the cursor to
   * completion and returns the full match set.
   */
  scanKeys: async (pattern: string, batch = 200): Promise<string[]> => {
    const client = getRedisClient()
    if (!client) return []
    const found: string[] = []
    let cursor = '0'
    do {
      const [next, keys] = await client.scan(cursor, { match: pattern, count: batch })
      cursor = String(next)
      if (keys.length) found.push(...keys)
    } while (cursor !== '0')
    return found
  },
};

