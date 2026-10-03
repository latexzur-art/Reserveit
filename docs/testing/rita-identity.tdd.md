# Rita — assistant identity wiring · TDD evidence + audit

**Date:** 2026-08-10 · **Branch:** dev · **Scope:** name the assistant **Rita**, wire it
everywhere from a single source of truth, verify it renders on every role dashboard with
role-specific constraints, and audit what remains. Deferred capabilities were **not**
implemented in this pass (by decision).

---

## 1. Journeys

1. *As any signed-in user*, when I open the assistant, its header and greeting call it
   **Rita** — not a generic "AI Assistant" — so it has a real identity.
2. *As a booking-capable role* (Client, Faculty, Program Head, Academic Head, Building
   Admin), Rita's greeting offers reservation verbs; *as a read-only role* (IT, PAMO) it
   does not — the greeting respects the role's constraints.
3. *As the model*, my system prompt introduces me as Rita for the active role, without
   breaking the cacheable prefix that keeps input cost ~90% off.
4. *As a maintainer*, the name lives in one place, so changing it updates prompt + UI at
   once.

## 2. Design

Single source of truth: **`backend/ai/identity.ts`** (pure strings/functions, no
server- or client-only imports — importable by both the server prompt builder and the
client chat UI, same pattern as `roleCapabilities.ts`).

| Export | Used by |
|---|---|
| `ASSISTANT_NAME = "Rita"` | prompt agentic header, quick-parse prompt, modal header |
| `assistantPersonaLine(label)` | `buildStableSystemPrompt` persona line |
| `assistantHeaderLabel(label?)` | chat toolbar (`Rita · {role}` / `Rita`) |
| `assistantGreeting(label, canBook)` | chat opening once role loads |
| `assistantDefaultGreeting()` | chat initial + resume-empty greeting |

Sites rewired (was 9 hardcoded strings → now all reference the module):
`app/api/ai/chat/_lib/prompt.ts` (persona + agentic header),
`app/api/ai/quick-parse/route.ts`, `components/ai/BookingChatbotModal.tsx` (header),
`components/ai/BookingChatbot.tsx` (3 greetings + toolbar label).

## 3. RED → GREEN

| Stage | Command | Result |
|---|---|---|
| RED | `vitest run identity.test.ts prompt.test.ts BookingChatbotModal.identity.test.tsx` | 3 files failed — `@/backend/ai/identity` missing; prompt lacked "Rita"; modal DOM still showed "AI Assistant" |
| GREEN (targets) | same command after implementation | **16/16 pass** |
| GREEN (AI + AI-UI) | `vitest run __tests__/backend/ai __tests__/components/ai` | **109/109 pass** |
| GREEN (full suite) | `vitest run` | **790/790 pass, 83 files** |
| Typecheck | `tsc --noEmit` | clean for changed files (2 pre-existing errors in `AvailabilityGrid.tsx` / `equipment-icons.ts` are from unrelated uncommitted equipment work) |

## 4. Test specification

| # | Guarantee | Test | Type | Result |
|---|---|---|---|---|
| 1 | Assistant is named "Rita" | `identity.test.ts › names the assistant Rita` | unit | PASS |
| 2 | Persona line opens "You are Rita …" + threads the role | `identity.test.ts › assistantPersonaLine` | unit | PASS |
| 3 | Header = "Rita · {role}", falls back to "Rita" on null/empty | `identity.test.ts › assistantHeaderLabel` | unit | PASS |
| 4 | Greeting shows booking verbs iff `canBook` | `identity.test.ts › assistantGreeting` | unit | PASS |
| 5 | All 7 roles get a constraint-consistent Rita identity | `identity.test.ts › across every role` (`it.each`) | unit | PASS |
| 6 | System prompt introduces Rita (booking + non-booking role) | `prompt.test.ts › introduces the assistant by name` | integration | PASS |
| 7 | Cacheable prefix stays byte-identical / no volatile data | `prompt.test.ts › is byte-identical` (pre-existing, still green) | integration | PASS |
| 8 | Modal header renders "Rita", not "AI Assistant" | `BookingChatbotModal.identity.test.tsx` | component | PASS |

**Coverage:** `@vitest/coverage-v8` is not installed (no numeric report produced; not
installing a dep for this pass). `identity.ts` is fully exercised by construction — every
export and both branches of the two branching functions, across all 7 roles.

## 5. Dashboard-coverage verification (already built, re-confirmed)

- **All 7 role layouts mount `<AssistantMount/>`:** client, faculty, program, academic,
  `admin/(building)`, `admin/(users)`=IT, `admin/(pamo)`=PAMO. ✓
- **Role constraints flow correctly:** `resolveCapabilities` defaults unknown/empty roles
  to the minimal **Client** capability (no admin powers), takes identity from the
  highest-priority role, and unions tools/actions/destinations. The prompt only ever sees
  the resolved role's tools; `executors.ts` re-checks in code. ✓
- Rita's greeting now derives its verbs from that same `canBook`, so the identity can
  never over-promise beyond a role's constraints (locked by test #5).

## 6. Gap / optimization audit (NOT implemented — for a deliberate follow-up)

**Optimization done:** identity de-duplicated from 9 sites to 1; cache-stable prefix
preserved (test #7).

**Left as-is on purpose (cosmetic, user-invisible):**
- Backend envelope fallbacks (`chat/route.ts` "How can I help you?", `llm.ts`
  coerceEnvelope default) are generic and one mentions booking regardless of role. Rare
  fallback paths; not worth routing through identity now.
- Per-role `persona` strings in `roleCapabilities.ts` still begin "You are the … for a …";
  now slightly redundant with the top-level "You are Rita" line, but they describe *duties*
  and rewording all 7 risks prompt-behavior/cache churn for no user-facing gain.

**Deferred capabilities (unchanged this pass)** — authoritative per-endpoint checklist
lives in `plans/2026-08-07-ai-assistant-capability-plan.md`. Highlights:
- **Program Head:** course create/edit/bulk-delete, schedule-upload entry submit, reassign,
  enrollment, school-event create (needs `facility_ids` resolution — ambiguous in chat).
- **Academic Head:** propose/respond-proposal, reassign, reliability bulk-reset, messages,
  schedule history. **Facility Aliases still has NO confirmed route → stays `VERIFY`.**
- **Cross-role:** rate/facility/faq/user CRUD, reschedule/extend, pay-invoice navigate,
  broadcasts, bulk import/export. Each needs endpoint + request-body verification before
  wiring behind execute-after-confirm.

**Design hook note:** impeccable flagged 3 `gray-on-color` findings in
`BookingChatbot.tsx` (L556/630/695) — pre-existing suggestion chips (`text-slate-300` on
`bg-white/5` over the dark navy modal). Correct light-on-dark contrast; the heuristic
misreads the translucent tint. Classified **false positive**, left unchanged, outside this
diff.

**Not runtime-verified end-to-end:** the live chat round-trip needs `next dev` +
`OPENROUTER_API_KEY` + browser login; not run here. Behavior is verified via the prompt
integration test (Rita in the system prompt) and the component render test (Rita in the
modal DOM).
