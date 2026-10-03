"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AI_FEATURES_ENABLED } from "@/lib/featureFlags";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutList, Clock, CalendarPlus, Sparkles, MessageSquarePlus } from "lucide-react";


// Split into ./chatbot/* in the deferred-splits cleanup: types, constants,
// pure helpers, and presentational cards live there; this file keeps the
// stateful chat component.
import type {
  CollectedFields,
  ResponseAction,
  LookupData,
  ChatMessage,
  AssistantCapabilities,
  HistorySession,
  RoomOption,
  PaidRateInfo,
  RoomRating,
  GradeStatus,
  GradeInfo,
  ChatResponse,
  RecentBooking,
  PreviousSession,
} from "./chatbot/types";
import { EMPTY_FIELDS, PURPOSE_LABELS, RESERVE_NOW_PROMPT, TOOL_LABELS, ROW_KEYS } from "./chatbot/constants";
import { ASSISTANT_NAME, assistantGreeting, assistantDefaultGreeting, assistantHeaderLabel } from "@/backend/ai/identity";
import { Composer, type ComposerHandle } from "./chatbot/Composer";
import { MessageContent } from "./chatbot/MessageContent";
import { timeAgo, countCollectedFields, nextWeekdays, getContextChips, estimatePaidCost, extractRows, summarizeRow, safeJson } from "./chatbot/helpers";
import { StarRating, ConfirmationCard, SessionBanner, ProgressDots, LookupCard, ActionConfirmCard, NavigateButton, HistoryPanel } from "./chatbot/cards";

export function BookingChatbot({
  formRoute,
  onClose,
  initialAction,
  expanded = false,
}: {
  formRoute: string;
  onClose?: () => void;
  initialAction?: "reserve_now";
  expanded?: boolean;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: assistantDefaultGreeting() },
  ]);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [collectedFields, setCollectedFields] = useState<CollectedFields>(EMPTY_FIELDS);
  const [bookingFlow, setBookingFlow] = useState<"standard" | "paid">("standard");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(0);
  const [phase, setPhase] = useState<"chatting" | "confirming">("chatting");
  const [grade, setGrade] = useState<GradeInfo | null>(null);
  const [roomRating, setRoomRating] = useState<RoomRating | null>(null);
  const [availableRooms, setAvailableRooms] = useState<RoomOption[]>([]);
  const [paidRates, setPaidRates] = useState<PaidRateInfo[]>([]);

  // Memory: recent bookings for rebook chips
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);

  // Role-aware capabilities + past-conversation recall
  const [capabilities, setCapabilities] = useState<AssistantCapabilities | null>(null);
  const [historySessions, setHistorySessions] = useState<HistorySession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showPages, setShowPages] = useState(false);
  const [showSuggestionsOverride, setShowSuggestionsOverride] = useState(false);

  // Session persistence state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [previousSession, setPreviousSession] = useState<PreviousSession | null>(null);
  const [sessionBannerVisible, setSessionBannerVisible] = useState(false);
  const sessionCreating = useRef(false);

  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const initialActionFired = useRef(false);

  // Refresh the past-conversations list (called on mount and after archival).
  const loadHistory = useCallback(() => {
    fetch("/api/ai/sessions/history")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data.sessions)) setHistorySessions(data.sessions); })
      .catch(() => {});
  }, []);

  // Load previous session + recent bookings on mount
  useEffect(() => {
    if (!user?.id) return;
    fetch("/api/ai/sessions")
      .then((r) => r.json())
      .then((data) => {
        if (data.session) {
          setPreviousSession(data.session);
          setSessionBannerVisible(true);
        }
      })
      .catch(() => {});
    fetch("/api/ai/user-context")
      .then((r) => r.json())
      .then((data) => {
        const combined = [...(data.upcoming ?? []), ...(data.past ?? [])];
        setRecentBookings(combined.slice(0, 6));
      })
      .catch(() => {});
    fetch("/api/ai/capabilities")
      .then((r) => r.json())
      .then((data) => { if (data.capabilities) setCapabilities(data.capabilities); })
      .catch(() => {});
    loadHistory();
  }, [user?.id, loadHistory]);

  // Personalize the opening line once we know the user's role.
  const greetedRole = useRef(false);
  useEffect(() => {
    if (!capabilities || greetedRole.current) return;
    greetedRole.current = true;
    setMessages((prev) => {
      if (prev.length !== 1 || prev[0].role !== "assistant") return prev;
      return [{ role: "assistant", content: assistantGreeting(capabilities.label, capabilities.canBook) }];
    });
  }, [capabilities]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);


  useEffect(() => {
    if (cooldownTime <= 0) return;
    const timer = setInterval(() => setCooldownTime((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldownTime]);

  // ─── Session helpers ──────────────────────────────────────────────────────
  const createSession = useCallback(
    async (msgs: ChatMessage[], fields: CollectedFields, flow: "standard" | "paid") => {
      if (sessionCreating.current || sessionId) return;
      sessionCreating.current = true;
      try {
        const res = await fetch("/api/ai/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: msgs, collected_fields: fields, booking_flow: flow }),
        });
        const { id } = await res.json();
        if (id) {
          sessionIdRef.current = id;
          setSessionId(id);
        }
      } catch {
        // non-critical
      } finally {
        sessionCreating.current = false;
      }
    },
    [sessionId]
  );

  const updateSession = useCallback(
    (msgs: ChatMessage[], fields: CollectedFields, flow: "standard" | "paid", status?: string) => {
      if (!sessionIdRef.current) return Promise.resolve();
      return fetch(`/api/ai/sessions/${sessionIdRef.current}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: msgs,
          collected_fields: fields,
          booking_flow: flow,
          ...(status ? { session_status: status } : {}),
        }),
      }).catch(() => {});
    },
    [sessionId]
  );

  // ─── New chat: archive the current conversation, open a blank one ───────────
  const startNewChat = useCallback(async () => {
    setShowHistory(false);
    // Archive the current conversation (with a title) only if it has real user
    // turns; an empty/greeting-only session isn't worth keeping.
    const archiving =
      sessionIdRef.current && history.some((m) => m.role === "user")
        ? updateSession(history, collectedFields, bookingFlow, "completed")
        : Promise.resolve();

    sessionIdRef.current = null;
    setSessionId(null);
    sessionCreating.current = false;
    setMessages([
      {
        role: "assistant",
        content: capabilities
          ? assistantGreeting(capabilities.label, capabilities.canBook)
          : assistantDefaultGreeting(),
      },
    ]);
    setHistory([]);
    setCollectedFields(EMPTY_FIELDS);
    setBookingFlow("standard");
    setPhase("chatting");
    setGrade(null);
    setRoomRating(null);
    setAvailableRooms([]);

    await archiving;
    loadHistory();
  }, [history, collectedFields, bookingFlow, capabilities, updateSession, loadHistory]);

  // ─── Continue previous session ────────────────────────────────────────────
  const handleContinueSession = useCallback(async () => {
    if (!previousSession) return;
    setSessionBannerVisible(false);

    const loadedMessages = Array.isArray(previousSession.messages) ? previousSession.messages : [];
    const loadedFields = previousSession.collected_fields ?? EMPTY_FIELDS;
    const loadedFlow = previousSession.booking_flow ?? "standard";

    const displayMessages =
      loadedMessages.length > 0
        ? loadedMessages
        : [{ role: "assistant" as const, content: assistantDefaultGreeting() }];

    setMessages(displayMessages);
    setHistory(loadedMessages);
    setCollectedFields(loadedFields);
    setBookingFlow(loadedFlow);

    sessionCreating.current = false;
    await createSession(loadedMessages, loadedFields, loadedFlow);
  }, [previousSession, createSession]);

  // ─── Affirmative detection ────────────────────────────────────────────────
  const isAffirmative = (t: string) =>
    /^(yes|yep|yeah|correct|ok|okay|sure|confirm|proceed|go ahead|just book it|book it|do it|sounds good|that.?s right|right|absolutely|definitely|let.?s go|go for it|please|y|si|of course|why not)[\s!.]*$/i.test(t.trim());

  const coreFieldsReady = (f: CollectedFields) =>
    !!(f.booking_purpose && f.booking_date && f.start_time && f.end_time && f.expected_attendees);

  // ─── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading || cooldownTime > 0) return;

    if (isAffirmative(trimmed) && coreFieldsReady(collectedFields) && collectedFields.facility_id) {
      const userMsg: ChatMessage = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setHistory((prev) => {
        const next = [...prev, userMsg];
        updateSession(next, collectedFields, bookingFlow);
        return next;
      });
      setPhase("confirming");
      return;
    }

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMsg];
    const nextHistory = [...history, userMsg];

    setMessages(nextMessages);
    setHistory(nextHistory);
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history,
          collected_fields: collectedFields,
          booking_flow: bookingFlow,
          user_id: user?.id ?? null,
        }),
      });

      if (!res.ok) {
        if (res.status === 429 || res.status === 503) {
          setCooldownTime(60);
          const msg: ChatMessage = {
            role: "assistant",
            content: "I'm handling a lot of requests right now. I'll be ready again in about a minute — or you can open the booking form directly while you wait.",
          };
          setMessages([...nextMessages, msg]);
          setHistory([...nextHistory, msg]);
          return;
        }
        const fallback: ChatMessage = {
          role: "assistant",
          content: "Something went wrong on my end. Please try again in a moment, or head straight to the booking form if it's urgent.",
        };
        setMessages([...nextMessages, fallback]);
        setHistory([...nextHistory, fallback]);
        return;
      }

      const data: ChatResponse = await res.json();
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.message,
        data: data.data ?? null,
        action: data.action ?? null,
      };
      const finalMessages = [...nextMessages, assistantMsg];
      // History only carries the text (keeps the model's context clean).
      const finalHistory = [...nextHistory, { role: "assistant" as const, content: data.message }];

      setMessages(finalMessages);
      setHistory(finalHistory);

      const rooms = data.available_rooms ?? [];
      if (rooms.length) setAvailableRooms(rooms);
      if (data.paid_facility_rates?.length) setPaidRates(data.paid_facility_rates);

      const returnedFlow = data.booking_flow ?? bookingFlow;
      setBookingFlow(returnedFlow);

      // Server returns fully-merged + resolved fields (incl. auto-picked room).
      const mergedFields = data.collected_fields ?? collectedFields;
      setCollectedFields(mergedFields);

      // Capture the authoritative grade + room rating from the server.
      setGrade({
        realScore: data.real_score ?? null,
        willAutoApprove: data.will_auto_approve ?? false,
        gradeStatus: data.grade_status ?? null,
        hardFail: data.hard_fail ?? null,
        reasoning: data.score_reasoning ?? null,
      });
      setRoomRating(data.room_rating ?? null);

      // Persist session
      if (!sessionId) createSession(finalHistory, mergedFields, returnedFlow);
      else updateSession(finalHistory, mergedFields, returnedFlow);

      // Only enter the booking confirmation card for booking-type turns.
      const intent = data.intent ?? (data.ready_to_confirm ? "booking" : "question");
      if (data.ready_to_confirm && (intent === "booking" || intent === "reserve_now")) {
        setPhase("confirming");
      }
    } catch {
      const fallback: ChatMessage = {
        role: "assistant",
        content: "I couldn't reach the server — might be a connection issue. Try again in a moment, or use the booking form if you need to get something done now.",
      };
      setMessages([...nextMessages, fallback]);
      setHistory([...nextHistory, fallback]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, history, collectedFields, bookingFlow, isLoading, cooldownTime, user?.id, sessionId, createSession, updateSession]);

  // ─── Reserve a room now (one-tap) ───────────────────────────────────────────
  const handleReserveNow = useCallback(() => {
    if (isLoading || cooldownTime > 0) return;
    sendMessage(RESERVE_NOW_PROMPT);
  }, [isLoading, cooldownTime, sendMessage]);

  // Auto-fire reserve-now when the modal opened via that entry.
  useEffect(() => {
    if (initialAction === "reserve_now" && user?.id && !initialActionFired.current) {
      initialActionFired.current = true;
      handleReserveNow();
    }
  }, [initialAction, user?.id, handleReserveNow]);

  // ─── Live re-grade when the user swaps the room in the card ─────────────────
  const handleRoomChange = useCallback(async (room: RoomOption) => {
    const nextFields = { ...collectedFields, facility_id: room.id, facility_name: room.name };
    setCollectedFields(nextFields);
    if (bookingFlow === "paid") return; // paid bookings aren't graded
    try {
      const res = await fetch("/api/ai/score-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collected_fields: nextFields,
          candidate_room: {
            id: room.id,
            name: room.name,
            facility_type_name: room.facility_type_name,
            capacity: room.capacity,
            is_paid_facility: room.is_paid_facility,
            specialized_tag: room.specialized_tag,
          },
        }),
      });
      if (!res.ok) return;
      const d = await res.json();
      if (d.room_rating) setRoomRating(d.room_rating);
      const p = d.preview;
      if (p?.status === "scored") {
        setGrade({
          realScore: p.score,
          willAutoApprove: p.willAutoApprove,
          gradeStatus: p.willAutoApprove ? "auto_approve" : p.willDecline ? "declined" : "review",
          hardFail: null,
          reasoning: grade?.reasoning ?? null,
        });
      } else if (p?.status === "hard_fail") {
        setGrade({ realScore: null, willAutoApprove: false, gradeStatus: "hard_fail", hardFail: { code: p.failedCode, message: p.message }, reasoning: null });
      }
    } catch {
      // keep prior grade
    }
  }, [collectedFields, bookingFlow, grade?.reasoning]);

  // ─── Confirm handlers ─────────────────────────────────────────────────────
  const handleConfirmStandard = useCallback(() => {
    const f = collectedFields;
    const prefill: Record<string, unknown> = {};

    if (f.facility_id)          prefill.facility_id          = f.facility_id;
    if (f.facility_name)        prefill.facility_search_term = f.facility_name;
    if (f.booking_date)         prefill.booking_date         = f.booking_date;
    if (f.start_time)           prefill.start_time           = f.start_time;
    if (f.end_time)             prefill.end_time             = f.end_time;
    if (f.booking_purpose)      prefill.booking_purpose      = f.booking_purpose;
    if (f.expected_attendees != null) prefill.expected_attendees = f.expected_attendees;
    if (f.booking_department_code) prefill.department        = f.booking_department_code;
    if (f.booking_course_code)  prefill.course               = f.booking_course_code;
    if (f.session_type)         prefill.session_type         = f.session_type;
    if (f.event_name)                  prefill.event_name                  = f.event_name;
    if (f.facility_purpose_category)   prefill.facility_purpose_category   = f.facility_purpose_category;
    if (f.purpose)                     prefill.purpose_statement           = f.purpose;
    if (f.special_requests)     prefill.special_requests     = f.special_requests;
    if (grade?.realScore != null) prefill.estimated_score    = grade.realScore;
    if (grade?.willAutoApprove)  prefill.will_auto_approve   = true;
    if (grade?.reasoning)       prefill.notes               = grade.reasoning;

    updateSession(history, f, "standard", "completed");
    onClose?.();
    router.push(`${formRoute}?prefill=${encodeURIComponent(JSON.stringify(prefill))}`);
  }, [collectedFields, grade, formRoute, history, router, onClose, updateSession]);

  const handleConfirmPaid = useCallback(() => {
    const f = collectedFields;
    const prefill: Record<string, unknown> = {};

    if (f.booking_date)          prefill.booking_date        = f.booking_date;
    if (f.start_time)            prefill.start_time          = f.start_time;
    if (f.end_time)              prefill.end_time            = f.end_time;
    if (f.booking_purpose)       prefill.booking_purpose     = f.booking_purpose;
    if (f.expected_attendees != null) prefill.expected_attendees = f.expected_attendees;
    if (f.purpose)               prefill.event_name          = f.purpose;
    if (f.purpose)               prefill.purpose             = f.purpose;
    if (f.special_requests)      prefill.special_requests    = f.special_requests;

    updateSession(history, f, "paid", "completed");
    onClose?.();
    router.push(
      `/internal/personal-gym-booking?facility_id=${f.facility_id}&prefill=${encodeURIComponent(JSON.stringify(prefill))}`
    );
  }, [collectedFields, history, router, onClose, updateSession]);

  const handleConfirm = bookingFlow === "paid" ? handleConfirmPaid : handleConfirmStandard;

  const handleOpenBlankForm = useCallback(() => {
    onClose?.();
    router.push(formRoute);
  }, [formRoute, router, onClose]);

  // ─── Quick-jump to a role page ──────────────────────────────────────────────
  const goTo = useCallback((href: string) => { onClose?.(); router.push(href); }, [router, onClose]);

  // ─── Navigate (automation: open the right page, optionally pre-filled) ──────
  const handleNavigate = useCallback(
    (action: Extract<ResponseAction, { kind: "navigate" }>) => {
      const href =
        action.prefill && Object.keys(action.prefill).length
          ? `${action.href}?prefill=${encodeURIComponent(JSON.stringify(action.prefill))}`
          : action.href;
      onClose?.();
      router.push(href);
    },
    [router, onClose]
  );

  // ─── Confirm a guarded write-action (the ONLY mutation path) ────────────────
  const handleConfirmAction = useCallback(
    async (index: number, action: Extract<ResponseAction, { kind: "mutate" }>) => {
      try {
        const res = await fetch("/api/ai/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action_type: action.action_type, params: action.params }),
        });
        const result = await res.json().catch(() => ({ ok: false, message: "Action failed." }));
        setMessages((prev) => {
          const next = prev.map((m, i) => (i === index ? { ...m, actionResolved: true } : m));
          return [
            ...next,
            { role: "assistant" as const, content: result.ok ? `✓ ${result.message}` : `⚠ ${result.message}` },
          ];
        });
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "That didn't go through — you can try again here, or do it directly from the page." },
        ]);
      }
    },
    []
  );

  const handleDismissAction = useCallback((index: number) => {
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, actionResolved: true } : m)));
  }, []);

  // ─── Resume a past conversation (restores the full transcript) ──────────────
  const handleResumeHistory = useCallback(async (s: HistorySession) => {
    setShowHistory(false);

    // Archive the current conversation first (if it has content) so switching
    // away from it doesn't lose it. updateSession reads sessionIdRef synchronously,
    // so this captures the OLD session before we point at the resumed one.
    const archivingPrev =
      sessionIdRef.current && sessionIdRef.current !== s.id && history.some((m) => m.role === "user")
        ? updateSession(history, collectedFields, bookingFlow, "completed")
        : Promise.resolve();

    const loaded = Array.isArray(s.messages) ? s.messages : [];
    const loadedFields = s.collected_fields ?? EMPTY_FIELDS;
    const loadedFlow = s.booking_flow ?? "standard";
    const displayMessages =
      loaded.length > 0
        ? loaded
        : [{ role: "assistant" as const, content: `Resuming: ${s.title || s.summary || "your previous conversation"}. What would you like to do next?` }];

    setMessages(displayMessages);
    setHistory(loaded);
    setCollectedFields(loadedFields);
    setBookingFlow(loadedFlow);
    setPhase("chatting");
    setGrade(null);

    // Reactivate the selected session as the current one (moves it out of the
    // completed history list; future turns write back to the same record).
    sessionIdRef.current = s.id;
    setSessionId(s.id);
    sessionCreating.current = false;
    fetch(`/api/ai/sessions/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: loaded,
        collected_fields: loadedFields,
        booking_flow: loadedFlow,
        session_status: "active",
      }),
    }).catch(() => {});

    await archivingPrev;
    loadHistory();
  }, [history, collectedFields, bookingFlow, updateSession, loadHistory]);

  if (!AI_FEATURES_ENABLED) return null;

  // Default to booking-capable until capabilities load (most roles can book).
  const canBook = capabilities ? capabilities.canBook : true;
  const chips = canBook ? getContextChips(collectedFields, bookingFlow, phase) : [];
  const filledCount = countCollectedFields(collectedFields);
  const showRebookChips = canBook && phase === "chatting" && messages.length <= 1 && recentBookings.length > 0;

  return (
    <div className="relative flex flex-col h-full">
      {/* Past-conversation recall overlay */}
      {showHistory && (
        <HistoryPanel
          sessions={historySessions}
          onResume={handleResumeHistory}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Toolbar: role label + Pages launcher + History */}
      <div className="flex items-center justify-between px-4 pt-2.5 pb-1.5 shrink-0 border-b border-white/10 bg-slate-900/60">
        <span className="text-xs font-semibold text-slate-300">
          {assistantHeaderLabel(capabilities?.label)}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSuggestionsOverride((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-accent-brand/40"
            title="Show suggested prompts"
          >
            <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
            Suggestions
          </button>
          {capabilities && capabilities.destinations.length > 0 && (
            <button
              onClick={() => setShowPages((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-accent-brand/40"
              title="Jump to a page"
            >
              <LayoutList className="h-3.5 w-3.5 text-blue-400" />
              Pages
            </button>
          )}
          <button
            onClick={startNewChat}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-accent-brand/40"
            title="Start a new conversation (the current one is saved to History)"
          >
            <MessageSquarePlus className="h-3.5 w-3.5 text-emerald-400" />
            New chat
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-accent-brand/40"
            title="Past conversations"
          >
            <Clock className="h-3.5 w-3.5 text-indigo-400" />
            History
          </button>
        </div>
      </div>

      {/* Role page quick-jump (launcher) — toggleable page shortcuts */}
      {capabilities && capabilities.destinations.length > 0 && showPages && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 overflow-x-auto no-scrollbar shrink-0 border-b border-white/10 bg-slate-900/40">
          {capabilities.destinations.map((d) => (
            <button
              key={d.id}
              onClick={() => goTo(d.href)}
              className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300 hover:border-blue-500/50 hover:bg-blue-500/20 shrink-0 transition-all"
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

      {/* Progress bar */}
      {phase === "chatting" && filledCount > 0 && (
        <div className="flex items-center justify-between px-4 pb-1 shrink-0">
          <ProgressDots count={filledCount} total={5} />
          {bookingFlow === "paid" && (
            <span className="text-xs text-amber-400 font-medium">Paid Rental</span>
          )}
        </div>
      )}

      {/* Session resume banner */}
      {sessionBannerVisible && previousSession && (
        <SessionBanner
          session={previousSession}
          onContinue={handleContinueSession}
          onDismiss={() => setSessionBannerVisible(false)}
        />
      )}

      {/* Messages area */}
      <div className={`flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0 w-full ${expanded ? "mx-auto max-w-4xl" : ""}`}>
        {messages.map((msg, i) => (
          <div key={i} className="space-y-2">
            <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm shadow-md"
                  : "bg-slate-800/90 text-slate-100 border border-slate-700/60 rounded-bl-sm shadow-xs"
              }`}>
                <MessageContent content={msg.content} />
              </div>
            </div>
            {msg.role === "assistant" && msg.data && (
              <div className="pl-1">
                <LookupCard data={msg.data} />
              </div>
            )}
            {msg.role === "assistant" && msg.action?.kind === "navigate" && (
              <div className="pl-1">
                <NavigateButton
                  action={msg.action}
                  onGo={() => handleNavigate(msg.action as Extract<ResponseAction, { kind: "navigate" }>)}
                />
              </div>
            )}
            {msg.role === "assistant" && msg.action?.kind === "mutate" && (
              <div className="pl-1">
                <ActionConfirmCard
                  action={msg.action}
                  resolved={!!msg.actionResolved}
                  onConfirm={() => handleConfirmAction(i, msg.action as Extract<ResponseAction, { kind: "mutate" }>)}
                  onDismiss={() => handleDismissAction(i)}
                />
              </div>
            )}
          </div>
        ))}

        {/* Role-aware starter chips — chunked to max 4 items for cognitive restraint unless expanded */}
        {capabilities && capabilities.quickActions.length > 0 && (showSuggestionsOverride || (messages.length <= 3 && phase === "chatting" && !isLoading)) && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5 mt-2">
            {(showSuggestionsOverride ? capabilities.quickActions : capabilities.quickActions.slice(0, 4)).map((qa) => (
              <button
                key={qa.label}
                onClick={() => { sendMessage(qa.prompt); setShowSuggestionsOverride(false); }}
                disabled={cooldownTime > 0}
                className="rounded-full border border-slate-700 bg-slate-800/80 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-accent-brand/60 hover:bg-slate-800 hover:text-white disabled:opacity-40 transition-all shadow-xs"
              >
                {qa.label}
              </button>
            ))}
            {!showSuggestionsOverride && capabilities.quickActions.length > 4 && (
              <button
                onClick={() => setShowSuggestionsOverride(true)}
                className="rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 transition-all"
              >
                +{capabilities.quickActions.length - 4} more suggestions
              </button>
            )}
          </div>
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 bg-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse [animation-delay:300ms]" />
              </div>
              <span className="text-xs text-slate-400">{ASSISTANT_NAME} is working on it…</span>
            </div>
          </div>
        )}

        {phase === "confirming" && !isLoading && (
          <ConfirmationCard
            fields={collectedFields}
            grade={grade}
            roomRating={roomRating}
            availableRooms={availableRooms}
            bookingFlow={bookingFlow}
            paidRates={paidRates}
            onRoomChange={handleRoomChange}
            onConfirm={handleConfirm}
            onEdit={handleOpenBlankForm}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {phase === "chatting" && (
        <div className={`border-t border-white/10 px-4 py-3 space-y-2 shrink-0 w-full ${expanded ? "mx-auto max-w-3xl" : ""}`}>
          {cooldownTime > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              <svg className="h-4 w-4 text-amber-400 shrink-0 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs text-amber-300">
                Rate limit reached — resuming in <strong>{cooldownTime}s</strong>
              </span>
            </div>
          )}

          {/* Rebook chips from history */}
          {showRebookChips && (
            <div className="flex flex-wrap gap-1.5">
              {recentBookings.slice(0, 3).map((b, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const what = b.event_name || b.booking_purpose || "booking";
                    composerRef.current?.setText(`Book ${b.facility_name ?? "a room"} again for a ${what}`);
                  }}
                  disabled={isLoading || cooldownTime > 0}
                  title={`${b.facility_name ?? "Room"} · ${b.date} ${b.start_time}–${b.end_time}`}
                  className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:border-blue-500/40 hover:bg-blue-500/10 disabled:opacity-40 transition-all"
                >
                  ↻ {b.facility_name ?? "Room"}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Suggested prompts dropdown */}
            {chips.length > 0 && (
              <div className="relative" ref={suggestionsRef}>
                <button
                  onClick={() => setSuggestionsOpen((v) => !v)}
                  disabled={isLoading || cooldownTime > 0}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:border-white/20 hover:text-slate-200 disabled:opacity-40 transition-all"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Suggested
                  <svg className={`h-3 w-3 transition-transform ${suggestionsOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {suggestionsOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setSuggestionsOpen(false)} />
                    <div className="absolute bottom-full left-0 mb-1 z-20 w-80 rounded-xl border border-white/10 bg-[#1e2436] shadow-xl overflow-hidden">
                      <div className="max-h-56 overflow-y-auto scrollbar-thin">
                        {chips.map((chip) => (
                          <button
                            key={chip}
                            onClick={() => { composerRef.current?.setText(chip); setSuggestionsOpen(false); }}
                            className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Reserve a room now — one-tap (booking roles only) */}
            {canBook && (
              <button
                onClick={handleReserveNow}
                disabled={isLoading || cooldownTime > 0}
                className="flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-500/20 disabled:opacity-40 transition-all"
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                Reserve a room now
              </button>
            )}
          </div>

          <Composer
            ref={composerRef}
            disabled={isLoading}
            cooldownTime={cooldownTime}
            canBook={canBook}
            onSend={sendMessage}
          />
        </div>
      )}
    </div>
  );
}

