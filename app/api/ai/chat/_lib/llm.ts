/** Assistant envelope parsing, response-action resolution, single-shot fallback. */

import { OpenAI } from "openai";
import { missingActionParams, describeAction, getActionMeta, type ActionFact } from "@/backend/ai/actions";
import type { AssistantActionType, RoleCapability } from "@/backend/ai/roleCapabilities";
import { callLocalLLM } from "./fields";
import { type CollectedFields, type ChatMessage, type OAIMessage } from "./shared";

const DEFAULT_MODEL = "deepseek/deepseek-v4-flash";

/**
 * Pick the chat model for a round. Base model is `AI_MODEL` (default flash).
 * The committing "emit" round can be routed to a stronger `AI_STRONG_MODEL` for
 * better write-action param accuracy — opt-in; with no strong model configured
 * this is a no-op that returns the base model.
 */
export function pickChatModel(
  env: Record<string, string | undefined>,
  opts: { emitRound: boolean }
): string {
  const base = env.AI_MODEL || DEFAULT_MODEL;
  if (opts.emitRound && env.AI_STRONG_MODEL) return env.AI_STRONG_MODEL;
  return base;
}

/**
 * The model chain to try in order: the chosen model first, then `AI_FALLBACK_MODEL`
 * if configured and different. Lets the route survive a provider/model outage
 * (resilience) — with no fallback set it is just `[chosen]`.
 */
export function chatModelChain(
  env: Record<string, string | undefined>,
  opts: { emitRound: boolean }
): string[] {
  const primary = pickChatModel(env, opts);
  const fb = env.AI_FALLBACK_MODEL;
  return fb && fb !== primary ? [primary, fb] : [primary];
}

// ─── Envelope shape returned by emit_result (and the single-shot fallback) ─────
export interface EnvelopeAction {
  kind?: "navigate" | "mutate";
  destination_id?: string;
  href?: string;
  label?: string;
  prefill?: Record<string, unknown>;
  action_type?: string;
  params?: Record<string, unknown>;
  summary?: string;
}

export interface AssistantEnvelope {
  message: string;
  intent?: "booking" | "question" | "reserve_now" | "lookup" | "action";
  booking_flow?: "standard" | "paid";
  ready_to_confirm?: boolean;
  collected_fields?: Record<string, unknown>;
  action?: EnvelopeAction;
}

// Action the server hands back to the UI to render (navigate button or confirm card).
export type ResponseAction =
  | { kind: "navigate"; href: string; label: string; prefill?: Record<string, unknown> }
  | {
      kind: "mutate";
      action_type: AssistantActionType;
      params: Record<string, unknown>;
      summary: string;
      requires_confirm: true;
      missing: string[];
      risk: "normal" | "high";
      confirm_phrase: string | null;
      /** Server-resolved facts (id + name + status) for the confirm card. */
      facts?: ActionFact[] | null;
    };

/**
 * Validate + normalize a model-proposed action against the caller's capability.
 * Navigation is restricted to the role's own destinations; mutations are only
 * surfaced (never executed) and only for action types the role is allowed.
 */
export function resolveResponseAction(
  action: EnvelopeAction | undefined,
  caps: RoleCapability
): ResponseAction | null {
  if (!action || typeof action !== "object") return null;

  if (action.kind === "navigate") {
    const dest =
      caps.destinations.find((d) => d.id === action.destination_id) ??
      caps.destinations.find((d) => d.href === action.href);
    const href =
      dest?.href ??
      (typeof action.href === "string" && action.href === caps.defaultFormRoute
        ? caps.defaultFormRoute
        : null);
    if (!href) return null;
    return {
      kind: "navigate",
      href,
      label: (typeof action.label === "string" && action.label) || dest?.label || "Open",
      prefill:
        action.prefill && typeof action.prefill === "object" ? action.prefill : undefined,
    };
  }

  if (action.kind === "mutate") {
    const type = typeof action.action_type === "string" ? action.action_type : "";
    if (!type || !caps.actions.includes(type as AssistantActionType)) return null;
    const params =
      action.params && typeof action.params === "object" ? action.params : {};
    const meta = getActionMeta(type, params); // server-decided risk (+ blast-radius escalation)
    return {
      kind: "mutate",
      action_type: type as AssistantActionType,
      params,
      summary:
        (typeof action.summary === "string" && action.summary) ||
        describeAction(type, params) ||
        "Confirm this action?",
      requires_confirm: true,
      missing: missingActionParams(type, params),
      risk: meta.risk,
      confirm_phrase: meta.confirmPhrase,
      facts: null,
    };
  }

  return null;
}

/**
 * Run a completion trying each model in order; fall through to the next on error
 * (provider/model outage resilience). Reports which model answered + whether a
 * fallback was used. Throws only if every model fails.
 */
export async function completeWithFallback(
  openai: OpenAI,
  models: string[],
  params: Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, "model">
): Promise<{ completion: OpenAI.Chat.Completions.ChatCompletion; model: string; fallbackUsed: boolean }> {
  let lastErr: unknown;
  for (let i = 0; i < models.length; i++) {
    try {
      const completion = await openai.chat.completions.create({ ...params, model: models[i] });
      return { completion, model: models[i], fallbackUsed: i > 0 };
    } catch (e) {
      lastErr = e;
      console.warn(`[chat] model ${models[i]} failed, ${i + 1 < models.length ? "trying fallback" : "no more models"}:`, (e as Error)?.message);
    }
  }
  throw lastErr;
}

export function coerceEnvelope(content: string | null | undefined): AssistantEnvelope {
  if (content) {
    const t = content.trim();
    if (t.startsWith("{")) {
      try {
        const parsed = JSON.parse(t) as AssistantEnvelope;
        if (parsed && typeof parsed.message === "string") return parsed;
      } catch {
        /* fall through */
      }
    }
    return { message: content, intent: "question", ready_to_confirm: false };
  }
  return { message: "How can I help you book a room?", intent: "question", ready_to_confirm: false };
}

// ─── Single-shot fallback (no tools) ───────────────────────────────────────────
// Same cache-friendly shape as the agentic path: stable system prefix + the
// volatile context folded into the trailing user message.
export async function runSingleShotFallback(
  openai: OpenAI,
  model: string,
  stablePrompt: string,
  volatileContext: string,
  trimmedHistory: ChatMessage[],
  message: string
): Promise<AssistantEnvelope> {
  const openaiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: stablePrompt },
    ...trimmedHistory.map((t) => ({ role: (t.role === "user" ? "user" : "assistant") as "user" | "assistant", content: t.content })),
    { role: "user", content: `${volatileContext}\n\n---\n\n${message}` },
  ];

  const localResult = await callLocalLLM(openaiMessages);
  let rawText: string;
  if (localResult) {
    rawText = localResult;
  } else {
    const completion = await openai.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      temperature: 0.3,
      messages: openaiMessages,
    });
    rawText = completion.choices[0]?.message?.content || "{}";
  }
  return coerceEnvelope(rawText);
}

