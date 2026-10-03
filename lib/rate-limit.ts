/**
 * Sliding-window rate limiter for Next.js API routes.
 * Supports Upstash Redis (@upstash/ratelimit) with automatic in-memory fallback.
 */

import { NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { getRedisClient, isRedisConfigured } from '@/lib/redis'
import { notifyBuildingAdminOfRedisFallback } from '@/lib/redis-alert'

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Cleanup stale entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanupStaleEntries(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now
  const cutoff = now - windowMs * 2
  for (const [key, entry] of store) {
    if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < cutoff) {
      store.delete(key)
    }
  }
}

interface RateLimitConfig {
  /** Max requests allowed within the window */
  maxRequests: number
  /** Window size in milliseconds */
  windowMs: number
}

// Map of created Ratelimit instances for Redis
const ratelimiters = new Map<string, Ratelimit>()

function getRedisRatelimiter(config: RateLimitConfig): Ratelimit | null {
  const redisClient = getRedisClient()
  if (!redisClient) return null

  const key = `${config.maxRequests}:${config.windowMs}`
  if (!ratelimiters.has(key)) {
    const windowSec = Math.max(1, Math.ceil(config.windowMs / 1000))
    ratelimiters.set(
      key,
      new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(config.maxRequests, `${windowSec} s`),
        analytics: true,
        prefix: 'ratelimit',
      })
    )
  }
  return ratelimiters.get(key) || null
}

/**
 * Check rate limit for a given key (typically user ID or IP).
 * Synchronous in-memory check (for backward compatibility).
 * Returns null if allowed, or a 429 NextResponse if rate-limited.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): NextResponse | null {
  const now = Date.now()
  cleanupStaleEntries(config.windowMs)

  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Remove timestamps outside the current window
  const windowStart = now - config.windowMs
  entry.timestamps = entry.timestamps.filter(t => t > windowStart)

  if (entry.timestamps.length >= config.maxRequests) {
    const retryAfterMs = entry.timestamps[0] + config.windowMs - now
    const retryAfterSec = Math.ceil(retryAfterMs / 1000)
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSec) },
      }
    )
  }

  entry.timestamps.push(now)
  return null
}

/**
 * Async rate limit check. Uses Upstash Redis when configured,
 * falling back to local memory if unconfigured or on error.
 */
export async function checkRateLimitAsync(
  key: string,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  if (isRedisConfigured()) {
    const limiter = getRedisRatelimiter(config)
    if (limiter) {
      try {
        const { success, reset } = await limiter.limit(key)
        if (!success) {
          const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
          return NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            {
              status: 429,
              headers: { 'Retry-After': String(retryAfterSec) },
            }
          )
        }
        return null
      } catch (err: any) {
        console.warn('[RateLimit] Error checking Redis ratelimit, falling back to memory:', err)
        notifyBuildingAdminOfRedisFallback(err?.message ?? String(err)).catch(() => {})
      }
    }
  }

  return checkRateLimit(key, config)
}

/** Pre-configured rate limits for common endpoints */
export const RATE_LIMITS = {
  /** POST /api/bookings — 10 per minute per user */
  BOOKING_CREATE: { maxRequests: 10, windowMs: 60 * 1000 },
  /** POST /api/auth/* — 15 per minute per IP/user */
  AUTH: { maxRequests: 15, windowMs: 60 * 1000 },
  /** POST /api/schedules/upload — 5 per 10 minutes per user */
  SCHEDULE_UPLOAD: { maxRequests: 5, windowMs: 10 * 60 * 1000 },
  /** General write operations — 30 per minute per user */
  GENERAL_WRITE: { maxRequests: 30, windowMs: 60 * 1000 },
  /** POST /api/ai/chat — 20 messages per minute per user (LLM cost control) */
  AI_CHAT: { maxRequests: 20, windowMs: 60 * 1000 },
  /** POST /api/ai/action — 15 confirmed write-actions per minute per user */
  AI_ACTION: { maxRequests: 15, windowMs: 60 * 1000 },
  /** POST /api/payments/[id]/qr-submit — 10 per 10 minutes per user */
  QR_SUBMIT: { maxRequests: 10, windowMs: 10 * 60 * 1000 },
} as const

