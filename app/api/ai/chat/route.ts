import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getCoursesForFacultyBooking } from "@/backend/course";
import { BuildingPricingService } from "@/backend/admin/building";
import { getAuthUserWithRoles } from "@/lib/supabase/auth-helper";
import { checkRateLimitAsync, RATE_LIMITS } from "@/lib/rate-limit";
import { getRuntimeKillEnv } from "@/backend/ai/killswitch";
import { logAiEvent, usageFields } from "@/backend/ai/observability";
import {
  TERMINAL_TOOL,
  executeTool,
  buildToolDefinitions,
  LOOKUP_TOOL_NAMES,
  getRecentBookings,
  formatBookingsMemory,
  getRecentSessionSummaries,
  formatSessionMemory,
  type ToolContext,
} from "@/backend/ai/tools";
import {
  resolveCapabilities,
  applyKillSwitches,
} from "@/backend/ai/roleCapabilities";
import { resolveActionFacts } from "@/backend/ai/actions";
import {
  previewBookingScore,
  type PreviewFields,
  type PreviewUserProfile,
  type ScorePreviewResult,
} from "@/backend/booking/scorePreview";
import { rateRoom, type RoomRating } from "@/backend/booking/roomRating";

export const maxDuration = 300; // Allow up to 5 minutes

// Implementation split into ./_lib (deferred-splits cleanup): shared types,
// context fetchers, field sanitization, prompt building, envelope/LLM helpers.
import {
  type ChatRequest,
  type CollectedFields,
  type ChatMessage,
  type OAIMessage,
  type FacilityRecord,
  EMPTY_FIELDS,
  MAX_TOOL_ROUNDS,
  ACTION_HINTS,
  VALID_BOOKING_PURPOSES,
  VALID_SESSION_TYPES,
  VALID_EVENT_NAMES,
} from "./_lib/shared";
import { getPaidFacilityRates, getFacilityContext, getCoursesContext } from "./_lib/context";
import { preExtractFields, sanitizeCollectedFields, mergeFields, toPreviewFields, gradeStatus, reasoningFromPreview, callLocalLLM, isUUID } from "./_lib/fields";
import { trimHistory, buildStableSystemPrompt, buildVolatileContext } from "./_lib/prompt";
import { resolveResponseAction, coerceEnvelope, runSingleShotFallback, chatModelChain, completeWithFallback, type AssistantEnvelope } from "./_lib/llm";
import { sanitizeToolResult, wrapToolResult, validateEnvelope, gateForActor, moderateInput } from "./_lib/safety";

// ─── Route Handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_AI_FEATURES_ENABLED !== "true") {
    return NextResponse.json({ error: "AI features disabled" }, { status: 403 });
  }

  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterApiKey) {
    console.error("[chat] OPENROUTER_API_KEY not set");
    return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.message || typeof body.message !== "string" || !Array.isArray(body.history)) {
    return NextResponse.json({ error: "Missing required fields: message, history" }, { status: 400 });
  }

  const { message, history, collected_fields } = body;
  const bookingFlow: "standard" | "paid" = body.booking_flow === "paid" ? "paid" : "standard";

  // Input moderation — block obvious prompt injection before auth/LLM work.
  const moderation = moderateInput(message);
  if (moderation.blocked) {
    return NextResponse.json({ message: moderation.reason, intent: "question" }, { status: 400 });
  }

  const startedAt = Date.now();

  // STEP 1: Verify session identity, then resolve capability (gates tools,
  // actions, navigation + prompt) with any kill-switches applied.
  const authResult = await getAuthUserWithRoles();
  const authenticatedUserId = authResult.user?.id ?? null;
  const actorStatus = authResult.user?.account_status ?? null;

  // Rate limit (OWASP LLM10 unbounded consumption) — a single message can trigger
  // preExtract + up to 5 tool rounds. Key by user when authed, else by client IP
  // so the unauthenticated fallback path can't be spammed either.
  const rlIp = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const rlKey = authenticatedUserId ? `ai-chat:${authenticatedUserId}` : `ai-chat-ip:${rlIp}`;
  const limited = await checkRateLimitAsync(rlKey, RATE_LIMITS.AI_CHAT);
  if (limited) {
    logAiEvent("chat_rate_limited", { userId: authenticatedUserId });
    return limited;
  }

  // Capability + kill-switches (static env lists merged with runtime Redis flags).
  const killEnv = await getRuntimeKillEnv();
  const caps = applyKillSwitches(resolveCapabilities(authResult.user?.roles ?? []), killEnv);
  const cookie = req.headers.get("cookie");

  // Pre-extraction is booking-only — skip the extra LLM round-trip for
  // non-booking roles (IT Admin / PAMO) where it can never do anything.
  const speculativeFields = caps.canBook
    ? await preExtractFields(message, openRouterApiKey)
    : {};

  const mergedForContext = {
    booking_date: speculativeFields.booking_date ?? collected_fields?.booking_date ?? null,
    start_time: speculativeFields.start_time ?? collected_fields?.start_time ?? null,
    end_time: speculativeFields.end_time ?? collected_fields?.end_time ?? null,
  };

  const supabase = createAdminClient();
  // RLS-scoped (cookie/JWT) client for USER-OWNED reads — least-privilege /
  // execute-in-user's-context (OWASP LLM06). Own-row SELECT policies exist for
  // bookings + ai_chat_sessions, so RLS enforces the boundary as a backstop to
  // the manual user_id filter. Facility/availability/scoring stay on the admin
  // client (they legitimately need cross-user data).
  const supabaseUser = await createClient();
  const baseUrl = req.nextUrl.origin;

  // Booking context (facilities + courses) is only relevant when the role can book.
  const [{ contextText: facilityContext, facilities: availableFacilities }, coursesContext, recentBookings, recentSessions] =
    await Promise.all([
      caps.canBook
        ? getFacilityContext(mergedForContext.booking_date, mergedForContext.start_time, mergedForContext.end_time, baseUrl)
        : Promise.resolve({ contextText: "", facilities: [] as FacilityRecord[] }),
      caps.canBook ? getCoursesContext(authenticatedUserId) : Promise.resolve(""),
      authenticatedUserId ? getRecentBookings(supabaseUser, authenticatedUserId, "all", 8) : Promise.resolve([]),
      authenticatedUserId ? getRecentSessionSummaries(supabaseUser, authenticatedUserId, 3) : Promise.resolve([]),
    ]);

  const paidRates = await getPaidFacilityRates(availableFacilities);
  const currentFields = collected_fields ?? EMPTY_FIELDS;
  // Combined memory: real past reservations + summaries of earlier completed chats.
  const bookingsMemory = [formatBookingsMemory(recentBookings), formatSessionMemory(recentSessions)]
    .filter(Boolean)
    .join("\n\n");

  const userProfile: PreviewUserProfile | null = authResult.user
    ? {
        id: authResult.user.id,
        user_type: authResult.user.user_type,
        account_status: authResult.user.account_status,
        roles: authResult.user.roles ?? [],
        department: authResult.user.department ?? null,
      }
    : null;

  const trimmedHistory = trimHistory(history);
  const openai = new OpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey: openRouterApiKey });

  // Tool context — overlay pre-extracted values onto the known fields baseline.
  const baselineFields: PreviewFields = {
    ...toPreviewFields(currentFields),
    booking_date: mergedForContext.booking_date,
    start_time: mergedForContext.start_time,
    end_time: mergedForContext.end_time,
    expected_attendees: speculativeFields.expected_attendees ?? currentFields.expected_attendees ?? null,
  };

  // Cache-friendly prompt split: a stable per-role system message (the cacheable
  // prefix) + a volatile context block folded into the trailing user message so
  // per-request data never pollutes the prefix. See _lib/prompt.ts.
  const volatileContext = buildVolatileContext({
    facilityContext,
    coursesContext,
    bookingsMemory,
    collectedFields: currentFields,
    bookingFlow,
    speculativeFields,
    paidRatesResult: paidRates,
    canBook: caps.canBook,
    actorStatus,
  });
  const trailingUserMessage = `${volatileContext}\n\n---\n\n${message}`;

  let envelope: AssistantEnvelope | null = null;
  // Last role-lookup result, surfaced to the UI for rich rendering.
  let lastLookupData: { tool: string; result: unknown } | null = null;
  // Telemetry + budgets.
  let rounds = 0;
  let toolCallCount = 0;
  let toolErrorCount = 0;
  let fallbackUsed = false;
  let usedModel = "";
  let lastUsage: unknown = null;
  const MAX_TOOL_CALLS = 12; // hard ceiling across all rounds (LLM10)

  try {
    // ─── Agentic tool-calling loop (only when we have an authenticated user for tools) ───
    if (userProfile) {
      const toolCtx: ToolContext = { supabase, supabaseUser, userProfile, currentFields: baselineFields, caps, cookie, origin: baseUrl };
      const toolDefs = buildToolDefinitions(caps);
      const messages: OAIMessage[] = [
        { role: "system", content: buildStableSystemPrompt(caps, "agentic") },
        ...trimmedHistory.map((t) => ({
          role: (t.role === "user" ? "user" : "assistant") as "user" | "assistant",
          content: t.content,
        })),
        { role: "user", content: trailingUserMessage },
      ];

      for (let round = 0; round < MAX_TOOL_ROUNDS && !envelope; round++) {
        rounds = round + 1;
        const forceEmit = round === MAX_TOOL_ROUNDS - 1 || toolCallCount >= MAX_TOOL_CALLS;
        const { completion, model: mdl, fallbackUsed: fb } = await completeWithFallback(
          openai,
          chatModelChain(process.env, { emitRound: forceEmit }),
          {
            temperature: 0.3,
            tools: toolDefs as unknown as OpenAI.Chat.Completions.ChatCompletionTool[],
            tool_choice: forceEmit
              ? ({ type: "function", function: { name: TERMINAL_TOOL } } as OpenAI.Chat.Completions.ChatCompletionToolChoiceOption)
              : "auto",
            messages,
          }
        );
        usedModel = mdl;
        fallbackUsed = fallbackUsed || fb;
        lastUsage = completion.usage;

        const choice = completion.choices[0];
        const msg = choice?.message;
        const toolCalls = msg?.tool_calls ?? [];

        if (toolCalls.length === 0) {
          envelope = coerceEnvelope(msg?.content);
          break;
        }

        // Assistant turn carrying the tool_calls must precede tool results.
        messages.push(msg as OAIMessage);

        // Terminal tool wins immediately.
        const terminal = toolCalls.find((tc) => tc.type === "function" && tc.function?.name === TERMINAL_TOOL);
        if (terminal && terminal.type === "function") {
          try {
            envelope = JSON.parse(terminal.function.arguments || "{}") as AssistantEnvelope;
            if (typeof envelope.message !== "string") envelope.message = "Here's what I found.";
          } catch {
            envelope = { message: "Let me try that again — could you rephrase?", intent: "question" };
          }
          break;
        }

        // Execute data tools, append results.
        for (const tc of toolCalls) {
          if (tc.type !== "function") continue;
          let result: unknown;
          if (toolCallCount >= MAX_TOOL_CALLS) {
            result = { error: "tool-call budget reached for this turn — summarize with what you have and call emit_result." };
          } else {
            toolCallCount++;
            try {
              const args = JSON.parse(tc.function.arguments || "{}");
              result = await executeTool(tc.function.name, args, toolCtx);
              if (result && typeof result === "object" && "error" in (result as Record<string, unknown>)) toolErrorCount++;
            } catch (e) {
              toolErrorCount++;
              result = { error: e instanceof Error ? e.message : "tool failed" };
            }
          }
          // Surface the most recent role-lookup result to the UI for rich rendering.
          if (LOOKUP_TOOL_NAMES.has(tc.function.name)) {
            lastLookupData = { tool: tc.function.name, result };
          }
          // Sanitize + wrap: retrieved data is UNTRUSTED — clamp size, strip
          // control chars/override lead-ins, and fence it so it can't pose as
          // instructions (OWASP LLM01 indirect prompt injection).
          const safe = sanitizeToolResult(result);
          messages.push({ role: "tool", tool_call_id: tc.id, content: wrapToolResult(JSON.stringify(safe)) });
        }
      }
    }

    // ─── Fallback: no user, or loop produced nothing ───
    if (!envelope) {
      envelope = await runSingleShotFallback(openai, chatModelChain(process.env, { emitRound: true }).at(-1)!, buildStableSystemPrompt(caps, "fallback"), volatileContext, trimmedHistory, message);
    }
  } catch (error) {
    console.error("[chat] agentic loop error, attempting single-shot fallback:", error);
    try {
      envelope = await runSingleShotFallback(openai, chatModelChain(process.env, { emitRound: true }).at(-1)!, buildStableSystemPrompt(caps, "fallback"), volatileContext, trimmedHistory, message);
    } catch (err2) {
      console.error("[chat] fallback also failed:", err2);
      return NextResponse.json({ error: "AI service temporarily unavailable" }, { status: 503 });
    }
  }

  // Structural validation of the model output (OWASP LLM05) — normalizes the
  // envelope and DROPS a malformed action instead of surfacing it.
  const validated = validateEnvelope(envelope);
  if (validated) envelope = validated;

  // ─── Post-process the envelope ──────────────────────────────────────────────
  const sanitizedAI = sanitizeCollectedFields((envelope.collected_fields as Record<string, unknown>) ?? {});
  let mergedFields = mergeFields(currentFields, sanitizedAI);

  const returnedFlow: "standard" | "paid" = envelope.booking_flow === "paid" ? "paid" : bookingFlow;
  const intent = envelope.intent ?? (envelope.ready_to_confirm ? "booking" : "question");

  // Validate any model-proposed action against the caller's capability (navigate
  // is restricted to their own pages; mutate is surfaced for confirmation only),
  // then apply the actor-status gate: a restricted/suspended/inactive actor may
  // not confirm a booking or run a write-action (drops mutate + ready_to_confirm).
  const gated = gateForActor(
    actorStatus,
    resolveResponseAction(envelope.action, caps),
    envelope.ready_to_confirm === true
  );
  let responseAction = gated.responseAction;
  const readyToConfirm = gated.readyToConfirm;
  const actorBlocked = gated.blocked;

  // Confirm card renders SERVER-resolved facts (id + name + status), not the
  // model's sentence (HIGH #1).
  if (responseAction?.kind === "mutate") {
    const facts = await resolveActionFacts(
      responseAction.action_type,
      responseAction.params,
      { cookie, origin: baseUrl }
    );
    responseAction = { ...responseAction, facts };
  }

  // Resolve a name-as-id mistake into a real UUID.
  if (mergedFields.facility_id && !isUUID(mergedFields.facility_id) && availableFacilities.length > 0) {
    const nameToMatch = (mergedFields.facility_name ?? mergedFields.facility_id).toLowerCase();
    const resolved = availableFacilities.find((r) => r.name.toLowerCase() === nameToMatch);
    mergedFields = resolved
      ? { ...mergedFields, facility_id: resolved.id, facility_name: resolved.name }
      : { ...mergedFields, facility_id: null };
  }

  // When confirming a standard booking with no room yet, auto-pick the best-fit (non-paid) room.
  if (readyToConfirm && returnedFlow === "standard" && !mergedFields.facility_id) {
    const candidates = availableFacilities.filter((f) => f.is_available && !f.is_paid_facility);
    if (candidates.length > 0) {
      const ratingFields = {
        booking_purpose: mergedFields.booking_purpose,
        expected_attendees: mergedFields.expected_attendees,
        session_type: (mergedFields.session_type === "lecture" || mergedFields.session_type === "lab" ? mergedFields.session_type : null) as "lecture" | "lab" | null,
        booking_course_code: mergedFields.booking_course_code,
      };
      const best = candidates
        .map((f) => ({ f, r: rateRoom({ id: f.id, name: f.name, facility_type_name: f.facility_type_name, capacity: f.capacity, is_paid_facility: f.is_paid_facility, specialized_tag: f.specialized_tag }, ratingFields) }))
        .sort((a, b) => b.r.rating - a.r.rating)[0];
      mergedFields = { ...mergedFields, facility_id: best.f.id, facility_name: best.f.name };
    }
  }

  // ─── Authoritative grade + room rating (server is the source of truth) ───────
  let realScore: number | null = null;
  let willAutoApprove = false;
  let grade: ReturnType<typeof gradeStatus> = null;
  let scoreReasoning: string | null = null;
  let hardFail: { code: string; message: string } | null = null;
  let roomRating: RoomRating | null = null;
  let suggestedRoom: Record<string, unknown> | null = null;

  if (mergedFields.facility_id) {
    const facility = availableFacilities.find((f) => f.id === mergedFields.facility_id);
    if (facility) {
      suggestedRoom = {
        id: facility.id,
        name: facility.name,
        facility_type_name: facility.facility_type_name,
        capacity: facility.capacity,
        floor_name: facility.floor_name,
        is_paid_facility: facility.is_paid_facility,
      };
      roomRating = rateRoom(
        { id: facility.id, name: facility.name, facility_type_name: facility.facility_type_name, capacity: facility.capacity, is_paid_facility: facility.is_paid_facility, specialized_tag: facility.specialized_tag },
        {
          booking_purpose: mergedFields.booking_purpose,
          expected_attendees: mergedFields.expected_attendees,
          session_type: (mergedFields.session_type === "lecture" || mergedFields.session_type === "lab" ? mergedFields.session_type : null) as "lecture" | "lab" | null,
          booking_course_code: mergedFields.booking_course_code,
        }
      );
    }
  }

  // Standard bookings get a real grade; paid bookings do not (Building Head + payment).
  if (readyToConfirm && returnedFlow === "standard" && userProfile) {
    const preview = await previewBookingScore(supabase, userProfile, toPreviewFields(mergedFields));
    grade = gradeStatus(preview);
    scoreReasoning = reasoningFromPreview(preview);
    if (preview.status === "scored") {
      realScore = preview.score;
      willAutoApprove = preview.willAutoApprove;
    } else if (preview.status === "hard_fail") {
      hardFail = { code: preview.failedCode, message: preview.message };
    }
  }

  // Structured telemetry: cache hits (the cost win), tool health, rounds,
  // gate blocks, fallback usage (OWASP LLM06 monitor / LLM10).
  logAiEvent("chat_turn", {
    role: caps.role,
    userId: authenticatedUserId,
    rounds,
    toolCalls: toolCallCount,
    toolErrors: toolErrorCount,
    model: usedModel,
    fallbackUsed,
    intent,
    actorBlocked,
    durationMs: Date.now() - startedAt,
    ...usageFields(lastUsage),
  });

  return NextResponse.json({
    message: typeof envelope.message === "string" ? envelope.message : "How can I help you?",
    intent,
    collected_fields: mergedFields,
    booking_flow: returnedFlow,
    next_question: null,
    ready_to_confirm: readyToConfirm,
    // Role-aware additions:
    action: responseAction,
    data: lastLookupData,
    role: { label: caps.label, can_book: caps.canBook },
    // Authoritative grade (new):
    real_score: realScore,
    will_auto_approve: willAutoApprove,
    grade_status: grade,
    hard_fail: hardFail,
    suggested_room: suggestedRoom,
    room_rating: roomRating,
    // Back-compat with the existing confirmation card:
    estimated_score: realScore,
    score_reasoning: scoreReasoning,
    available_rooms: availableFacilities
      .filter((f) => f.is_available)
      .map((f) => ({
        id: f.id,
        name: f.name,
        facility_type_name: f.facility_type_name,
        capacity: f.capacity,
        floor_name: f.floor_name,
        is_paid_facility: f.is_paid_facility,
        specialized_tag: f.specialized_tag,
      })),
    paid_facility_rates: paidRates.configured,
  });
}

