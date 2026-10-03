const { Redis } = require('@upstash/redis')

function getRedisInstance() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token || typeof url !== 'string' || url.startsWith('your_upstash') || url === '[SENSITIVE]' || url === 'disabled') {
    return null
  }
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return null
    return new Redis({ url, token })
  } catch (err) {
    console.warn('[CacheHandler] Failed to initialize Upstash Redis, using in-memory cache:', err.message)
    return null
  }
}

const redis = getRedisInstance()

const memoryCache = new Map()

// Namespaces kept separate so app-cache prefix scans (lib/cache.ts) never
// collide with Next's data cache.
const ENTRY_PREFIX = 'next_cache:'
const TAG_PREFIX = 'next_tag:'
// Bound on how long an orphaned tag-index member can linger before its next
// rewrite refreshes the TTL (7 days). Deleting an already-expired entry key is
// a no-op, so stale members only cost a little set growth, never correctness.
const TAG_INDEX_TTL = 7 * 24 * 60 * 60

/**
 * Custom Next.js cache handler backed by Upstash Redis with an in-process
 * memory fallback.
 *
 * Tag invalidation uses a Redis-set index (TAG_PREFIX + tag -> set of entry
 * keys) instead of scanning the keyspace. The previous implementation ran
 * `KEYS next_cache:*` and then a GET for every key on each revalidateTag call —
 * an O(N) blocking scan plus N round-trips that deserialised the entire data
 * cache. The index turns invalidation into one SMEMBERS + one pipelined DEL.
 */
module.exports = class CacheHandler {
  constructor(options) {
    this.options = options
  }

  async get(key) {
    if (redis) {
      try {
        const data = await redis.get(`${ENTRY_PREFIX}${key}`)
        if (data) return typeof data === 'string' ? JSON.parse(data) : data
      } catch (err) {
        console.warn(`[CacheHandler] Redis get error for key "${key}":`, err)
      }
    }
    return memoryCache.get(key) || null
  }

  async set(key, data, ctx) {
    memoryCache.set(key, data)

    if (!redis) return

    // Tags may arrive either on the context (newer Next) or embedded in the
    // cached value (legacy shape the memory fallback also reads).
    const tags = (ctx && Array.isArray(ctx.tags) && ctx.tags.length)
      ? ctx.tags
      : (data && Array.isArray(data.tags) ? data.tags : [])

    try {
      const ttl = ctx && typeof ctx.revalidate === 'number' ? ctx.revalidate : 86400
      const serialized = JSON.stringify(data)
      const entryKey = `${ENTRY_PREFIX}${key}`

      if (ttl > 0) {
        await redis.set(entryKey, serialized, { ex: ttl })
      } else {
        await redis.set(entryKey, serialized)
      }

      // Register this entry under each of its tags so revalidateTag can find it
      // without scanning. TTL on the index set keeps orphans self-cleaning.
      for (const tag of tags) {
        const tagKey = `${TAG_PREFIX}${tag}`
        await redis.sadd(tagKey, entryKey)
        await redis.expire(tagKey, TAG_INDEX_TTL)
      }
    } catch (err) {
      console.warn(`[CacheHandler] Redis set error for key "${key}":`, err)
    }
  }

  async revalidateTag(tag) {
    if (redis) {
      try {
        const tagKey = `${TAG_PREFIX}${tag}`
        const entryKeys = await redis.smembers(tagKey)
        if (entryKeys && entryKeys.length > 0) {
          await redis.del(...entryKeys)
        }
        // Drop the index set itself; it will be rebuilt on the next set().
        await redis.del(tagKey)
      } catch (err) {
        console.warn(`[CacheHandler] Redis revalidateTag error for "${tag}":`, err)
      }
    }

    // Memory fallback is small and process-local — a direct scan is fine here.
    for (const [key, value] of memoryCache.entries()) {
      if (value && Array.isArray(value.tags) && value.tags.includes(tag)) {
        memoryCache.delete(key)
      }
    }
  }
}
