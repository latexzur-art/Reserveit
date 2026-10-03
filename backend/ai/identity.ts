/**
 * Single source of truth for the assistant's user-facing identity.
 *
 * Pure strings and functions only — no server-only or client-only imports — so
 * this module is safe to import from BOTH the server-side prompt builder and the
 * client-side chat UI (same pattern as roleCapabilities.ts). Change the name in
 * one place and it updates the system prompt, the quick-parse prompt, the modal
 * header, the toolbar label, and every greeting at once.
 */

/** The assistant's name, shown to users and used in prompts. */
export const ASSISTANT_NAME = 'Rita'

/**
 * The persona sentence that opens the system prompt — names Rita and the role
 * she is currently helping. Deterministic per role, so it stays inside the
 * cacheable prompt prefix.
 */
export function assistantPersonaLine(roleLabel: string): string {
  return `You are ${ASSISTANT_NAME}, the ReserveIT AI assistant — a smart, friendly agent for a university facility & academic management system, currently helping a ${roleLabel}.`
}

/**
 * Header / toolbar label: "Rita · Program Head", or just "Rita" before the
 * user's role capabilities have loaded.
 */
export function assistantHeaderLabel(roleLabel?: string | null): string {
  return roleLabel ? `${ASSISTANT_NAME} · ${roleLabel}` : ASSISTANT_NAME
}

/**
 * Capability-aware opening greeting shown once the user's role is known. The
 * verbs mirror what the role can actually do (booking-capable roles get the
 * reservation verbs; read-only roles do not).
 */
export function assistantGreeting(roleLabel: string, canBook: boolean): string {
  const verb = canBook
    ? 'reserve rooms, check availability, look things up, and take you where you need to go'
    : 'look things up, answer questions, and take you where you need to go'
  return `Hi, I'm ${ASSISTANT_NAME} — your ReserveIT assistant for ${roleLabel}. I can ${verb}. Try one of the suggestions below, or just ask me anything!`
}

/** Friendly opening shown before role capabilities load (or after a reset). */
export function assistantDefaultGreeting(): string {
  return `Hi, I'm ${ASSISTANT_NAME} — your ReserveIT assistant. I'm getting ready — one moment!`
}
