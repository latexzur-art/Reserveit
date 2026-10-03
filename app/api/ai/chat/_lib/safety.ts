/**
 * Input/output safety for the AI chat route.
 *
 *  - sanitizeToolResult: defense-in-depth against INDIRECT prompt injection
 *    (OWASP LLM01). Tool results contain user-authored data (facility names,
 *    booking purposes, notes) that flows back into the model context — this
 *    clamps size, strips control chars, redacts obvious override lead-ins, and
 *    prevents data from breaking out of its TOOL_RESULT wrapper.
 *  - validateEnvelope: structural validation of the model's emit_result output
 *    before we act on it (OWASP LLM05 improper output handling).
 *
 * @module app/api/ai/chat/_lib/safety
 */

import { z } from "zod";
import { isActorBlocked } from "@/backend/ai/roleCapabilities";
import type { AssistantEnvelope } from "./llm";

// Delimiter the route wraps every tool result in so the model can tell live DATA
// from instructions. sanitizeToolResult guarantees data can't contain either.
export const TOOL_RESULT_OPEN = "[TOOL_DATA]";
export const TOOL_RESULT_CLOSE = "[/TOOL_DATA]";

const DEFAULT_MAX_STR = 2000;
const MAX_DEPTH = 6;

/** Truncate an over-long string with an explicit, model-visible marker. */
export function clampText(s: string, max = DEFAULT_MAX_STR): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)} …[truncated ${s.length - max} chars]`;
}

const OVERRIDE_LEADIN =
  /\b(ignore|disregard|forget|override)\s+(all\s+|any\s+|the\s+)?(previous|prior|earlier|above|following|system)\s+(instructions?|prompts?|context|messages?|rules?)/gi;

function scrubString(s: string, maxStr: number): string {
  return clampText(
    s
      // strip ASCII control chars except tab/newline
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
      // neutralize obvious instruction-override lead-ins embedded in data
      .replace(OVERRIDE_LEADIN, "[redacted-instruction]")
      // never let retrieved data spoof the DATA wrapper
      .split(TOOL_RESULT_CLOSE).join("")
      .split(TOOL_RESULT_OPEN).join(""),
    maxStr
  );
}

/**
 * Recursively sanitize a tool result: clamp every string, strip control chars,
 * redact override lead-ins, and remove wrapper-delimiter spoofing.
 */
export function sanitizeToolResult(value: unknown, maxStr = DEFAULT_MAX_STR, depth = 0): unknown {
  if (depth > MAX_DEPTH) return null;
  if (typeof value === "string") return scrubString(value, maxStr);
  if (Array.isArray(value)) return value.map((v) => sanitizeToolResult(v, maxStr, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeToolResult(v, maxStr, depth + 1);
    }
    return out;
  }
  return value;
}

/** Wrap a (already sanitized) tool result so the model reads it as data, not orders. */
export function wrapToolResult(jsonString: string): string {
  return `${TOOL_RESULT_OPEN}\n${jsonString}\n${TOOL_RESULT_CLOSE}`;
}

// ─── Actor-status gate (OWASP LLM06 — deny privileged action to a blocked user) ──
/**
 * A restricted/suspended/inactive actor may not confirm a booking or run a
 * write-action. Drops any proposed `mutate` and forces `ready_to_confirm=false`.
 * Navigation and reads are left intact. Pure — the single source of truth for the
 * server-side actor gate the chat route applies.
 */
export function gateForActor<A extends { kind?: string }>(
  actorStatus: string | null | undefined,
  responseAction: A | null,
  proposedReadyToConfirm: boolean
): { responseAction: A | null; readyToConfirm: boolean; blocked: boolean } {
  const blocked = isActorBlocked(actorStatus);
  return {
    responseAction: blocked && responseAction?.kind === "mutate" ? null : responseAction,
    readyToConfirm: !blocked && proposedReadyToConfirm,
    blocked,
  };
}

// ─── Input moderation (defense-in-depth before the LLM sees the message) ───────
const INJECTION_PATTERNS = [
  /\bignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)\b/gi,
  /\byou\s+are\s+now\s+(a|an)\s+\w+/gi,
  /\bsystem\s*:\s*/gi,
  /\bforget\s+(everything|all)\b/gi,
  /\bnew\s+instructions?\s*:/gi,
  /\bjailbreak\b/gi,
  /\bDAN\s+mode\b/gi,
  /\bpretend\s+you\s+(are|have\s+no)\b/gi,
];

/**
 * Lightweight input moderation — blocks obvious prompt injection attempts
 * before they reach the LLM. Returns null if the message is acceptable,
 * or a rejection message if it's blocked.
 *
 * This is defense-in-depth; the system prompt's scope boundary is the
 * primary guard against out-of-scope requests.
 */
export function moderateInput(message: string): { blocked: boolean; reason?: string } {
  const trimmed = message.trim();
  if (trimmed.length === 0) return { blocked: false };
  if (trimmed.length > 5000) {
    return { blocked: true, reason: "Message too long. Please keep your question under 5000 characters." };
  }
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { blocked: true, reason: "I can't process that request. Is there something related to ReserveIT I can help you with?" };
    }
  }
  return { blocked: false }
}

// ─── Envelope validation (LLM05) ────────────────────────────────────────────────
const ActionSchema = z
  .object({
    kind: z.enum(["navigate", "mutate"]).optional(),
    destination_id: z.string().optional(),
    href: z.string().optional(),
    label: z.string().optional(),
    prefill: z.record(z.string(), z.unknown()).optional(),
    action_type: z.string().optional(),
    params: z.record(z.string(), z.unknown()).optional(),
    summary: z.string().optional(),
  })
  .passthrough();

const EnvelopeSchema = z
  .object({
    message: z.string(),
    intent: z.enum(["booking", "question", "reserve_now", "lookup", "action"]).optional(),
    booking_flow: z.enum(["standard", "paid"]).optional(),
    ready_to_confirm: z.boolean().optional(),
    collected_fields: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

/**
 * Validate the model's envelope. Returns a normalized envelope, or null when it
 * is structurally unusable. A malformed `action` is DROPPED (not surfaced)
 * rather than failing the whole turn.
 */
export function validateEnvelope(raw: unknown): AssistantEnvelope | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = { ...(raw as Record<string, unknown>) };
  const action = obj.action;
  delete obj.action;

  const base = EnvelopeSchema.safeParse(obj);
  if (!base.success) return null;

  const env = base.data as AssistantEnvelope;
  if (action !== undefined) {
    const parsed = ActionSchema.safeParse(action);
    if (parsed.success) env.action = parsed.data as AssistantEnvelope["action"];
  }
  return env;
}

// ─── PII scrubbing for stored conversations ─────────────────────────────────────
const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Philippine mobile numbers: 09XX XXX XXXX or +63 9XX XXX XXXX
  { pattern: /(\+?63|0)\s?9\d{2}\s?\d{3}\s?\d{4}/g, replacement: "[phone redacted]" },
  // International phone numbers: +NNN NNNNNNNN or similar
  { pattern: /\+\d{1,3}[\s-]?\d{4,14}/g, replacement: "[phone redacted]" },
  // Email addresses
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: "[email redacted]" },
  // Student IDs: common patterns like 20XX-XXXXX or alphanumeric IDs with 8+ chars
  { pattern: /\b20\d{2}-\d{4,6}\b/g, replacement: "[student ID redacted]" },
];

/**
 * Scrub PII from a text string before storing in ai_chat_sessions.
 * Redacts phone numbers, email addresses, and student ID patterns.
 */
export function scrubPII(text: string): string {
  let result = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
