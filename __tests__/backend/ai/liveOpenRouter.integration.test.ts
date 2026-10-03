// @vitest-environment node
/**
 * LIVE integration probe (opt-in): hits OpenRouter with the REAL prompt builder
 * to verify (1) connectivity + model id, (2) the fallback envelope parses, and
 * (3) the cache-friendly prompt structure actually earns a cache hit on a repeat
 * request (HIGH #2). Run with: npx vitest run --config vitest.integration.config.ts
 * __tests__/backend/ai/liveOpenRouter.integration.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fetch as undiciFetch } from 'undici'
import { OpenAI } from 'openai'
import { buildStableSystemPrompt, buildVolatileContext } from '@/app/api/ai/chat/_lib/prompt'
import { ROLE_CAPABILITIES } from '@/backend/ai/roleCapabilities'
import { EMPTY_FIELDS } from '@/app/api/ai/chat/_lib/shared'

function loadEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* ignore */ }
  return out
}

const env = loadEnvLocal()
const KEY = env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || ''
const MODEL = env.AI_MODEL || 'deepseek/deepseek-v4-flash'

const stable = buildStableSystemPrompt(ROLE_CAPABILITIES.academic_head, 'agentic')
const volatile = buildVolatileContext({
  facilityContext: '', coursesContext: '', bookingsMemory: '',
  collectedFields: EMPTY_FIELDS, bookingFlow: 'standard', speculativeFields: {},
  paidRatesResult: { configured: [], unconfigured: [] }, canBook: true, actorStatus: 'active',
})

describe.skipIf(!KEY)('live OpenRouter probe', () => {
  let openai: OpenAI
  beforeAll(() => {
    // setup.ts stubs global.fetch with a vi.fn() — hand the client a real fetch.
    openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: KEY,
      dangerouslyAllowBrowser: true,
      fetch: undiciFetch as unknown as typeof fetch,
    })
  })

  it('connects, runs the model, and returns a parseable JSON envelope', async () => {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.3,
      messages: [
        { role: 'system', content: `${stable}\n\nReply as ONLY JSON: {"message": string, "intent": "question"}` },
        { role: 'user', content: `${volatile}\n\n---\n\nWhat can you help me with?` },
      ],
    })
    const text = completion.choices[0]?.message?.content ?? ''
    // eslint-disable-next-line no-console
    console.log('[live] model=%s usage=%o', MODEL, completion.usage)
    const parsed = JSON.parse(text)
    expect(typeof parsed.message).toBe('string')
  }, 60_000)

  it('earns a prompt-cache hit on an identical stable prefix (HIGH #2)', async () => {
    const messages = [
      { role: 'system' as const, content: stable },
      { role: 'user' as const, content: `${volatile}\n\n---\n\nList three things you can do for me.` },
    ]
    const call = () => openai.chat.completions.create({ model: MODEL, temperature: 0, messages })

    const first = await call()
    const second = await call()

    const cachedOf = (u: unknown): number => {
      const usage = u as { prompt_tokens_details?: { cached_tokens?: number }; prompt_cache_hit_tokens?: number } | undefined
      return usage?.prompt_tokens_details?.cached_tokens ?? usage?.prompt_cache_hit_tokens ?? 0
    }
    // eslint-disable-next-line no-console
    console.log('[live] cache — first=%o second=%o', first.usage, second.usage)
    // Soft signal: the repeat should reuse at least part of the stable prefix.
    expect(cachedOf(second.usage)).toBeGreaterThan(0)
  }, 90_000)
})
