"use client";

/** Presentational sub-components for the booking chatbot. */

import { useState } from "react";
import { Star, X, Check, AlertTriangle } from "lucide-react";
import type { CollectedFields, ResponseAction, LookupData, GradeInfo, RoomOption, PaidRateInfo, RoomRating, HistorySession, PreviousSession } from "./types";
import { PURPOSE_LABELS, TOOL_LABELS, ROW_KEYS } from "./constants";
import { timeAgo, countCollectedFields, estimatePaidCost, buildLookupView, formatCell, humanizeEnumValue } from "./helpers";
import type { LookupView } from "./helpers";

export function StarRating({ stars }: { stars: number }) {
  const s = Math.max(0, Math.min(5, stars));
  return (
    <span className="inline-flex items-center gap-px" aria-label={`${s} of 5 stars`}>
      {Array.from({ length: s }, (_, i) => (
        <Star key={`filled-${i}`} className="w-3 h-3 fill-amber-400 text-amber-400" />
      ))}
      {Array.from({ length: 5 - s }, (_, i) => (
        <Star key={`empty-${i}`} className="w-3 h-3 text-slate-600" />
      ))}
    </span>
  );
}

// ─── Confirmation Card ────────────────────────────────────────────────────────

export function ConfirmationCard({
  fields,
  grade,
  roomRating,
  availableRooms,
  bookingFlow,
  paidRates,
  onRoomChange,
  onConfirm,
  onEdit,
}: {
  fields: CollectedFields;
  grade: GradeInfo | null;
  roomRating: RoomRating | null;
  availableRooms: RoomOption[];
  bookingFlow: "standard" | "paid";
  paidRates: PaidRateInfo[];
  onRoomChange: (room: RoomOption) => void;
  onConfirm: () => void;
  onEdit: () => void;
}) {
  const [showRooms, setShowRooms] = useState(false);
  const alternatives = availableRooms.filter((r) => r.id !== fields.facility_id);
  const facilityRate = paidRates.find((r) => r.facilityId === fields.facility_id) ?? paidRates[0] ?? null;
  const estimatedCost = estimatePaidCost(fields.start_time, fields.end_time, facilityRate);

  const score = grade?.realScore ?? null;
  const status = grade?.gradeStatus ?? null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <svg className="h-4 w-4 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm font-semibold text-slate-200">
          {bookingFlow === "paid" ? "Ready for Paid Booking" : "Ready to Book"}
        </span>
        {bookingFlow === "paid" && (
          <span className="ml-auto text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
            Paid Facility
          </span>
        )}
      </div>

      {/* Room selection */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Suggested Room</span>
          {alternatives.length > 0 && (
            <button
              onClick={() => setShowRooms((v) => !v)}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              {showRooms ? "Hide options" : `${alternatives.length} other${alternatives.length > 1 ? "s" : ""} available`}
            </button>
          )}
        </div>

        <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-blue-200">{fields.facility_name ?? "—"}</p>
            {roomRating && (
              <span className="text-xs shrink-0">
                <StarRating stars={roomRating.stars} />
                <span className="ml-1 text-slate-400">{roomRating.rating}% match</span>
              </span>
            )}
          </div>
          {fields.facility_id && (() => {
            const r = availableRooms.find((x) => x.id === fields.facility_id);
            return r ? (
              <p className="text-xs text-slate-400 mt-0.5">
                {r.facility_type_name ?? ""}{r.floor_name ? ` · ${r.floor_name}` : ""} · up to {r.capacity} pax
              </p>
            ) : null;
          })()}
          {roomRating?.reasons?.[0] && (
            <p className="text-xs text-slate-500 mt-1">{roomRating.reasons.slice(0, 2).join(" · ")}</p>
          )}
        </div>

        {showRooms && alternatives.length > 0 && (
          <div className="space-y-1 pt-1">
            {alternatives.map((room) => (
              <button
                key={room.id}
                onClick={() => { onRoomChange(room); setShowRooms(false); }}
                className="w-full text-left rounded-lg border border-white/10 bg-white/5 px-3 py-2 hover:border-blue-500/40 hover:bg-blue-500/10 transition-all"
              >
                <p className="text-sm text-slate-200">{room.name}</p>
                <p className="text-xs text-slate-500">
                  {room.facility_type_name ?? ""}{room.floor_name ? ` · ${room.floor_name}` : ""} · up to {room.capacity} pax
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Booking summary */}
      <div className="space-y-2 text-sm border-t border-white/10 pt-3">
        {fields.booking_date && (
          <div className="flex justify-between gap-4">
            <span className="text-slate-500 shrink-0">Date</span>
            <span className="text-slate-200">{fields.booking_date}</span>
          </div>
        )}
        {fields.start_time && fields.end_time && (
          <div className="flex justify-between gap-4">
            <span className="text-slate-500 shrink-0">Time</span>
            <span className="text-slate-200">{fields.start_time} – {fields.end_time}</span>
          </div>
        )}
        {fields.booking_purpose && (
          <div className="flex justify-between gap-4">
            <span className="text-slate-500 shrink-0">Purpose</span>
            <span className="text-slate-200">{PURPOSE_LABELS[fields.booking_purpose] ?? fields.booking_purpose}</span>
          </div>
        )}
        {fields.expected_attendees != null && (
          <div className="flex justify-between gap-4">
            <span className="text-slate-500 shrink-0">Attendees</span>
            <span className="text-slate-200">{fields.expected_attendees}</span>
          </div>
        )}
      </div>

      {/* Paid cost estimate */}
      {bookingFlow === "paid" && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">Estimated Cost</span>
            <span className="text-sm font-bold text-amber-300">{estimatedCost}</span>
          </div>
          <p className="text-xs text-slate-500">*Final cost depends on addons. Building Head approval required before payment.</p>
        </div>
      )}

      {/* Standard real approval grade */}
      {bookingFlow === "standard" && status === "hard_fail" && grade?.hardFail && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 space-y-1">
          <span className="text-sm font-bold text-red-400 inline-flex items-center gap-1"><X className="w-3 h-3 text-red-400" /> Won&apos;t be allowed as-is</span>
          <p className="text-xs text-red-300/80">{grade.hardFail.message}</p>
          <p className="text-xs text-slate-500">Adjust the details (room, time, or date) and try again.</p>
        </div>
      )}

      {bookingFlow === "standard" && status !== "hard_fail" && score !== null && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">Approval Grade</span>
            <span className={`text-sm font-bold ${
              status === "auto_approve" ? "text-green-400" : status === "review" ? "text-yellow-400" : "text-red-400"
            }`}>
              {score}/100
              {status === "auto_approve" ? <span className="inline-flex items-center gap-1"> — <Check className="w-3 h-3 text-green-400 inline" /> will auto-approve</span> : status === "review" ? <span className="inline-flex items-center gap-1"> — <AlertTriangle className="w-3 h-3 text-yellow-400 inline" /> needs admin review</span> : <span className="inline-flex items-center gap-1"> — <X className="w-3 h-3 text-red-400 inline" /> likely declined</span>}
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${
                status === "auto_approve" ? "bg-green-500" : status === "review" ? "bg-yellow-500" : "bg-red-500"
              }`}
              style={{ width: `${score}%` }}
            />
          </div>
          {grade?.reasoning && <p className="text-xs text-slate-500">{grade.reasoning}</p>}
          <p className="text-xs text-slate-600">Real grade from the approval engine — recomputed on submit.</p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-all"
        >
          Edit in Form
        </button>
        <button
          onClick={onConfirm}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-all ${
            bookingFlow === "paid"
              ? "bg-amber-600 hover:bg-amber-500"
              : "bg-blue-600 hover:bg-blue-500"
          }`}
        >
          {bookingFlow === "paid" ? "Go to Paid Booking →" : "Confirm & Pre-fill →"}
        </button>
      </div>
    </div>
  );
}

// ─── Session Banner ───────────────────────────────────────────────────────────

export function SessionBanner({
  session,
  onContinue,
  onDismiss,
}: {
  session: PreviousSession;
  onContinue: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mx-4 mt-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
      <p className="text-xs text-blue-300 font-medium mb-0.5">
        ↩ Unfinished booking from {timeAgo(session.last_active_at)}
      </p>
      <p className="text-xs text-slate-400 mb-2.5">
        {session.booking_flow === "paid" ? "Paid facility booking" : "Standard reservation"}
        {session.collected_fields.facility_name ? ` — ${session.collected_fields.facility_name}` : ""}
      </p>
      <div className="flex gap-2">
        <button
          onClick={onContinue}
          className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-all"
        >
          Continue →
        </button>
        <button
          onClick={onDismiss}
          className="flex-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5 transition-all"
        >
          Start Fresh
        </button>
      </div>
    </div>
  );
}

// ─── Progress Dots ────────────────────────────────────────────────────────────

export function ProgressDots({ count, total = 5 }: { count: number; total?: number }) {
  const labels = ["Purpose", "Date", "Time", "People", "Room"];
  return (
    <div className="flex items-center gap-1.5" aria-label={`Booking details: ${count} of ${total} provided`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          title={labels[i] || `Field ${i + 1}`}
          className={`h-1.5 w-1.5 rounded-full transition-all ${
            i < count ? "bg-blue-400" : "bg-slate-600"
          }`}
        />
      ))}
      <span className="text-xs text-slate-500 ml-1">{count}/{total}</span>
    </div>
  );
}

// ─── Lookup result rendering ──────────────────────────────────────────────────

function ViewSection({ view }: { view: LookupView }) {
  switch (view.kind) {
    case 'error':
      return <p className="text-xs text-red-300">{view.message}</p>;
    case 'table':
      return (
        <div className="space-y-1">
          {view.table.rows.slice(0, 8).map((row, i) => (
            <div key={i} className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-slate-300">
              {view.table.headers.map((h) => (
                <span key={h.key} className="mr-3">
                  <span className="text-slate-500">{h.label}: </span>
                  {typeof row[h.key] === 'string'
                    ? humanizeEnumValue(formatCell(row[h.key]))
                    : formatCell(row[h.key])}
                </span>
              ))}
            </div>
          ))}
          {view.table.total > 8 && (
            <p className="text-xs text-slate-500">+{view.table.total - 8} more</p>
          )}
        </div>
      );
    case 'record':
      return (
        <div className="divide-y divide-white/5">
          {view.pairs.map(([label, value], i) => (
            <div key={i} className="flex justify-between gap-4 py-1">
              <span className="text-xs text-slate-500 shrink-0">{label}</span>
              <span className="text-xs text-slate-200 text-right break-words">{value}</span>
            </div>
          ))}
        </div>
      );
    case 'empty':
      return <p className="text-xs text-slate-400">No further details.</p>;
    case 'person':
      return null; // person is handled at the LookupCard level
    default:
      return null;
  }
}

export function LookupCard({ data }: { data: LookupData }) {
  const view = buildLookupView(data.tool, data.result);
  const label = TOOL_LABELS[data.tool] ?? 'Results';

  if (view.kind === 'error') {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
        <p className="text-xs text-red-300">{view.message}</p>
      </div>
    );
  }

  if (view.kind === 'person') {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-3">
        <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
        {/* Person fields */}
        {view.fields.length > 0 && (
          <div className="divide-y divide-white/5">
            {view.fields.map(([k, v], i) => (
              <div key={i} className="flex justify-between gap-4 py-1">
                <span className="text-xs text-slate-500 shrink-0">{k}</span>
                <span className="text-xs text-slate-200 text-right break-words">{v}</span>
              </div>
            ))}
          </div>
        )}
        {/* Facet sections */}
        {view.sections.map((sec, i) => (
          <div key={i} className="space-y-1">
            <p className="text-xs text-slate-400 font-medium">{sec.name}</p>
            <ViewSection view={sec.content} />
          </div>
        ))}
      </div>
    );
  }

  if (view.kind === 'table') {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1.5">
        <p className="text-xs text-slate-500 uppercase tracking-wider">{label} · {view.table.total}</p>
        <ViewSection view={view} />
      </div>
    );
  }

  if (view.kind === 'record') {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1.5">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
        <ViewSection view={view} />
      </div>
    );
  }

  // empty
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xs text-slate-400">No further details.</p>
    </div>
  );
}

// ─── Guarded-action confirm card ──────────────────────────────────────────────

export function ActionConfirmCard({
  action,
  resolved,
  onConfirm,
  onDismiss,
}: {
  action: Extract<ResponseAction, { kind: "mutate" }>;
  resolved: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const blocked = (action.missing?.length ?? 0) > 0;
  const isHigh = action.risk === "high" && !!action.confirm_phrase;
  const phraseOk = !isHigh || typed.trim().toUpperCase() === action.confirm_phrase!.toUpperCase();
  const high = isHigh;
  return (
    <div className={`rounded-xl border p-3 space-y-2 ${high ? "border-red-500/40 bg-red-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
      <div className="flex items-center gap-2">
        <svg className={`h-4 w-4 shrink-0 ${high ? "text-red-300" : "text-amber-300"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <span className={`text-sm font-semibold ${high ? "text-red-200" : "text-amber-200"}`}>
          {high ? "Confirm high-impact action" : "Confirm action"}
        </span>
      </div>
      <p className="text-sm text-slate-200">{action.summary}</p>
      {action.facts && action.facts.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 divide-y divide-white/5">
          {action.facts.map((f, i) => (
            <div key={i} className="flex justify-between gap-4 px-3 py-1.5 text-xs">
              <span className="text-slate-500 shrink-0 uppercase tracking-wider">{f.label}</span>
              <span className="text-slate-200 text-right break-words">{f.value}</span>
            </div>
          ))}
        </div>
      )}
      {action.facts && action.facts.length > 0 && (
        <p className="text-[11px] text-slate-500">Verified from the server — not the assistant&apos;s summary.</p>
      )}
      {high && (
        <p className="text-xs text-red-300/90">This has side-effects and can&apos;t be silently undone. Review carefully.</p>
      )}
      {blocked && (
        <p className="text-xs text-red-300">I still need: {action.missing.join(", ")}. Tell me and I&apos;ll continue.</p>
      )}
      {resolved ? (
        <p className="text-xs text-green-300 inline-flex items-center gap-1"><Check className="w-3 h-3 text-green-300" /> Done.</p>
      ) : (
        <>
          {high && !blocked && (
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={`Type ${action.confirm_phrase} to confirm`}
              className="w-full rounded-lg border border-red-500/30 bg-white/5 px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-red-500/60 focus:outline-none"
            />
          )}
          <div className="flex gap-2">
            <button
              disabled={busy || blocked || !phraseOk}
              onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-40 transition-all ${high ? "bg-red-600 hover:bg-red-500" : "bg-green-600 hover:bg-green-500"}`}
            >
              {busy ? "Working…" : high ? "Confirm" : "Confirm"}
            </button>
            <button
              disabled={busy}
              onClick={onDismiss}
              className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-all"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Navigate button ──────────────────────────────────────────────────────────

export function NavigateButton({ action, onGo }: { action: Extract<ResponseAction, { kind: "navigate" }>; onGo: () => void }) {
  return (
    <button
      onClick={onGo}
      className="flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-200 hover:bg-blue-500/20 transition-all"
    >
      {action.label} →
    </button>
  );
}

// ─── Past-conversation history panel ──────────────────────────────────────────

export function HistoryPanel({
  sessions,
  onResume,
  onClose,
}: {
  sessions: HistorySession[];
  onResume: (s: HistorySession) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#1a1f2e]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-sm font-semibold text-slate-200">Past conversations</span>
        <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-white/10 hover:text-slate-200" aria-label="Close history">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sessions.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-slate-500">No past conversations yet.</p>
        ) : (
          sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => onResume(s)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left hover:border-blue-500/40 hover:bg-blue-500/10 transition-all"
            >
              <p className="text-sm font-medium text-slate-100 line-clamp-1">{s.title || s.summary || "Conversation"}</p>
              {s.summary && s.summary !== s.title && (
                <p className="text-xs text-slate-400 line-clamp-1">{s.summary}</p>
              )}
              <p className="text-xs text-slate-500">{timeAgo(s.last_active_at)}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
