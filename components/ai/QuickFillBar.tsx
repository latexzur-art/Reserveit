"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AI_FEATURES_ENABLED } from "@/lib/featureFlags";

interface QuickFillBarProps {
  formRoute: string;
}

interface QuickFillResult {
  facility_search_term: string | null;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  booking_purpose: string | null;
  expected_attendees: number | null;
  department: string | null;
  course: string | null;
  session_type: string | null;
  purpose_statement: string | null;
  special_requests: string | null;
  estimated_score: number | null;
  confidence: string;
  notes: string | null;
}

const EXAMPLE_PROMPTS = [
  'AVR tomorrow 2pm seminar with projector for 40 students',
  'Computer lab next Monday 10am IT lecture',
  'Function room this Friday 3pm department meeting',
];

export function QuickFillBar({ formRoute }: QuickFillBarProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);


  const openBar = useCallback(() => {
    setIsOpen(true);
    setError(null);
    setInputValue("");
    setTimeout(() => inputRef.current?.focus(), 60);
  }, []);

  const closeBar = useCallback(() => {
    setIsOpen(false);
    setError(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        openBar();
      }
      if (e.key === "Escape" && isOpen) closeBar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, openBar, closeBar]);

  const handleSubmit = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || text.length < 5) {
      setError("Please describe your booking in more detail.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/quick-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        if (res.status === 503) {
          setError("AI is busy right now. Try again in a moment.");
          return;
        }
        const body = await res.json().catch(() => null);
        if (res.status === 422 && body?.error) {
          setError(body.error);
          return;
        }
        console.warn("[QuickFillBar] Parse failed, opening blank form");
        closeBar();
        router.push(formRoute);
        return;
      }

      const result: QuickFillResult = await res.json();

      const prefillData: Record<string, unknown> = {};
      if (result.facility_search_term)
        prefillData.facility_search_term = result.facility_search_term;
      if (result.booking_date) prefillData.booking_date = result.booking_date;
      if (result.start_time) prefillData.start_time = result.start_time;
      if (result.end_time) prefillData.end_time = result.end_time;
      if (result.booking_purpose)
        prefillData.booking_purpose = result.booking_purpose;
      if (result.expected_attendees)
        prefillData.expected_attendees = result.expected_attendees;
      if (result.department) prefillData.department = result.department;
      if (result.course) prefillData.course = result.course;
      if (result.session_type) prefillData.session_type = result.session_type;
      if (result.purpose_statement)
        prefillData.purpose_statement = result.purpose_statement;
      if (result.special_requests)
        prefillData.special_requests = result.special_requests;
      if (result.estimated_score !== null)
        prefillData.estimated_score = result.estimated_score;
      if (result.notes) prefillData.notes = result.notes;

      const prefillParam = encodeURIComponent(JSON.stringify(prefillData));
      closeBar();
      router.push(`${formRoute}?prefill=${prefillParam}`);
    } catch {
      console.warn("[QuickFillBar] Network error, opening blank form");
      closeBar();
      router.push(formRoute);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, router, closeBar, formRoute]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isLoading) handleSubmit();
    if (e.key === "Escape") closeBar();
  };


  if (!AI_FEATURES_ENABLED) return null;

  // ── Collapsed trigger button ───────────────────────────────────────────────
  if (!isOpen) {
    return (
      <button
        onClick={openBar}
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-400 hover:border-white/20 hover:bg-white/10 hover:text-slate-200 transition-all"
        title="Quick-Fill Booking (Ctrl+K)"
      >
        <svg
          className="h-4 w-4 text-blue-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
        <span>Quick Book</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-white/10 px-1.5 py-0.5 text-xs font-mono text-slate-500">
          Ctrl K
        </kbd>
      </button>
    );
  }

  // ── Open modal ─────────────────────────────────────────────────────────────
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={closeBar}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick-Fill Booking"
        className="fixed left-1/2 top-[20%] z-50 w-full max-w-xl -translate-x-1/2 rounded-2xl border border-white/10 bg-[#1a1f2e] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <svg
            className="h-5 w-5 text-blue-400 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <span className="text-sm font-semibold text-slate-200">
            Quick Book
          </span>
          <span className="ml-auto text-xs text-slate-500">
            AI-optimized for higher approval
          </span>
        </div>

        {/* Input */}
        <div className="px-5 py-4">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={onKeyDown}
            placeholder='e.g. "AVR tomorrow 2pm seminar with projector"'
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            disabled={isLoading}
            maxLength={300}
          />

          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Describe your booking — AI will pre-fill the form optimized for
              approval.
            </p>
            <button
              onClick={handleSubmit}
              disabled={isLoading || inputValue.trim().length < 5}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Analyzing...
                </>
              ) : (
                "Fill Form →"
              )}
            </button>
          </div>
        </div>

        {/* Example prompts */}
        <div className="border-t border-white/10 px-5 py-3">
          <p className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
            Try these:
          </p>
          <div className="flex flex-col gap-1.5">
            {EXAMPLE_PROMPTS.map((example) => (
              <button
                key={example}
                onClick={() => {
                  setInputValue(example);
                  inputRef.current?.focus();
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors"
              >
                &ldquo;{example}&rdquo;
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
