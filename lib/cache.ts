/**
 * Dual-layer Cache for ReserveIT (Upstash Redis + process-local memory Map)
 *
 * Provides sub-millisecond local reads with global cross-replica invalidation
 * via Upstash Redis when env vars are available.
 *
 * Cache key conventions:
 *   'booking:hard_rules'         — approval_constraint_rules (hard), TTL_24H
 *   'booking:soft_rules'         — approval_constraint_rules (soft), TTL_24H
 *   'booking:time_slots'         — time_slots table, TTL_24H
 *   'booking:active_term'        — academic_terms (is_active=true), engine view, TTL_12H
 *   'booking:active_term_range'  — active term date range (hard checker), TTL_24H
 *   'booking:active_term_public' — active term public payload (booking forms), 5m
 *   'ref:facilities:default'     — default facilities query, 10m
 *   'ref:settings:helpdesk'      — helpdesk phone setting, 5m
 *   'ref:departments:all'        — departments list, 1h
 *
 * All 'booking:active_term*' keys share a prefix so a single
 * cacheDeleteByPrefix('booking:active_term') invalidates the whole family
 * whenever an admin changes the active term.
 *
 * Notes:
 *   - `null` is a cacheable value (negatively cached) — see NULL_SENTINEL.
 *   - Prefix deletes use Redis SCAN, never the blocking KEYS command.
 *   - Every Redis error (read/write/delete) is surfaced to Building Admins
 *     via reportRedisError; the app keeps serving from local memory.
 */

import { redis, isRedisConfigured } from '@/lib/redis'
import { notifyBuildingAdminOfRedisFallback } from '@/lib/redis-alert'

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

export const TTL_24H = 24 * 60 * 60 * 1000  // 86_400_000 ms
export const TTL_12H = 12 * 60 * 60 * 1000  // 43_200_000 ms

/**
 * Sentinel stored in Redis to represent a cached `null` value.
 *
 * Redis' GET returns `null` both for an absent key AND for a key whose stored
 * value is `null`, so a plain `null` round-trip is indistinguishable from a
 * miss — meaning legitimately-null results (e.g. "no active term") could never
 * be negatively cached and re-hit the database on every request. We serialise
 * `null` as this sentinel so misses stay `null` and cached-null reads resolve
 * to `null`. Non-null values are stored verbatim (fully backward compatible).
 */
const NULL_SENTINEL = '__RESERVEIT_NULL__'

/**
 * Central handler for Redis errors on any cache operation.
 *
 * Read failures were already alerting Building Admins; write/delete failures
 * used to only `console.warn`, yet those are exactly the failures that leave
 * stale data on other replicas with no operator signal. Routing every path
 * through here closes that observability gap. `notifyBuildingAdminOfRedisFallback`
 * is internally rate-limited (30-min cooldown), so this stays cheap under a
 * sustained outage.
 */
function reportRedisError(op: string, key: string, err: unknown): void {
  const message = (err as { message?: string })?.message ?? String(err)
  console.warn(`[Cache] Redis ${op} failed for "${key}":`, err)
  notifyBuildingAdminOfRedisFallback(message).catch(() => {})
}

/**
 * Sync getter from process-local memory Map.
 * Returns `undefined` on miss/expiration.
 */
export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key) as CacheEntry<T> | undefined
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return undefined
  }
  return entry.value
}

/**
 * Async getter: checks local memory first; if miss and Redis is available,
 * queries Redis and populates local memory cache.
 */
export async function cacheGetAsync<T>(key: string): Promise<T | undefined> {
  const localVal = cacheGet<T>(key)
  if (localVal !== undefined) return localVal

  if (!isRedisConfigured()) return undefined

  try {
    const val = await redis.get<unknown>(key)
    // Absent key -> genuine miss.
    if (val === null || val === undefined) return undefined
    // Cached null (see NULL_SENTINEL): a real, negatively-cached value.
    const resolved = (val === NULL_SENTINEL ? null : val) as T
    // Mirror into local memory (bounded 60s horizon) for fast repeat hits.
    cacheSet(key, resolved, 60_000)
    return resolved
  } catch (err) {
    reportRedisError('read', key, err)
  }
  return undefined
}

/** Store a value with a TTL in milliseconds. Updates local Map & Redis. */
export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs })

  if (isRedisConfigured()) {
    const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000))
    redis.set(key, value === null ? NULL_SENTINEL : value, { ex: ttlSeconds }).catch(err => {
      reportRedisError('write', key, err)
    })
  }
}

/** Async variant of cacheSet */
export async function cacheSetAsync<T>(key: string, value: T, ttlMs: number): Promise<void> {
  store.set(key, { value, expiresAt: Date.now() + ttlMs })

  if (isRedisConfigured()) {
    try {
      const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000))
      await redis.set(key, value === null ? NULL_SENTINEL : value, { ex: ttlSeconds })
    } catch (err) {
      reportRedisError('write', key, err)
    }
  }
}

/** Remove a single key from local Map & Redis. */
export function cacheDelete(key: string): void {
  store.delete(key)
  if (isRedisConfigured()) {
    redis.del(key).catch(err => {
      reportRedisError('delete', key, err)
    })
  }
}

/** Async variant of cacheDelete */
export async function cacheDeleteAsync(key: string): Promise<void> {
  store.delete(key)
  if (isRedisConfigured()) {
    try {
      await redis.del(key)
    } catch (err) {
      reportRedisError('delete', key, err)
    }
  }
}

/**
 * Remove all keys that start with the given prefix, from local Map & Redis.
 *
 * Uses a cursor-based `SCAN` (see redis.scanKeys) rather than `KEYS prefix*`,
 * which would block Redis' command loop across the whole keyspace.
 */
export function cacheDeleteByPrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
  if (isRedisConfigured()) {
    redis.scanKeys(`${prefix}*`).then(keys => {
      if (keys.length > 0) {
        return redis.del(...keys)
      }
    }).catch(err => {
      reportRedisError('prefix-delete', `${prefix}*`, err)
    })
  }
}

/** Async variant of cacheDeleteByPrefix */
export async function cacheDeleteByPrefixAsync(prefix: string): Promise<void> {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
  if (isRedisConfigured()) {
    try {
      const keys = await redis.scanKeys(`${prefix}*`)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } catch (err) {
      reportRedisError('prefix-delete', `${prefix}*`, err)
    }
  }
}

