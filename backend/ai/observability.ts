/**
 * Structured, low-cardinality logging for the AI assistant so degradation and
 * abuse are visible (OWASP LLM06 "monitor", LLM10). One JSON line per event —
 * cheap to grep, ship, or wire to a metrics pipeline later. No PII beyond the
 * user id already present in logs.
 *
 * @module backend/ai/observability
 */

export interface AiEventFields {
  role?: string;
  userId?: string | null;
  rounds?: number;
  toolCalls?: number;
  toolErrors?: number;
  cacheHitTokens?: number;
  cacheMissTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  model?: string;
  intent?: string;
  actorBlocked?: boolean;
  fallbackUsed?: boolean;
  durationMs?: number;
  [k: string]: unknown;
}

/** Emit one structured AI telemetry line. Never throws. */
export function logAiEvent(event: string, fields: AiEventFields = {}): void {
  try {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ai_event: event, ts: new Date().toISOString(), ...fields }));
  } catch {
    /* logging must never break the request */
  }
}

/** Extract OpenRouter/DeepSeek cache + token usage into flat fields. */
export function usageFields(usage: unknown): Pick<AiEventFields, "promptTokens" | "completionTokens" | "cacheHitTokens" | "cacheMissTokens"> {
  const u = usage as
    | {
        prompt_tokens?: number;
        completion_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
        prompt_cache_hit_tokens?: number;
        prompt_cache_miss_tokens?: number;
      }
    | undefined;
  const hit = u?.prompt_tokens_details?.cached_tokens ?? u?.prompt_cache_hit_tokens ?? 0;
  const prompt = u?.prompt_tokens ?? 0;
  return {
    promptTokens: prompt,
    completionTokens: u?.completion_tokens ?? 0,
    cacheHitTokens: hit,
    cacheMissTokens: u?.prompt_cache_miss_tokens ?? Math.max(0, prompt - hit),
  };
}
