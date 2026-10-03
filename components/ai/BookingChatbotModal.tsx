"use client";

import { forwardRef, useImperativeHandle, useState, useEffect } from "react";
import { BookingChatbot } from "./BookingChatbot";
import { AI_FEATURES_ENABLED } from "@/lib/featureFlags";
import { ASSISTANT_NAME } from "@/backend/ai/identity";

export interface BookingChatbotModalHandle {
  open: () => void;
  openReserveNow: () => void;
  close: () => void;
}

interface BookingChatbotModalProps {
  formRoute: string;
  /** Show the one-tap "Reserve a room now" pill (booking-capable roles only). */
  showReserveNow?: boolean;
}

export const BookingChatbotModal = forwardRef<BookingChatbotModalHandle, BookingChatbotModalProps>(
  function BookingChatbotModal({ formRoute, showReserveNow = true }, ref) {
  const [isOpen, setIsOpen] = useState(false);
  // Once opened, the panel stays MOUNTED (just hidden) so the conversation is
  // never destroyed by a close / outside-click — only the first open pays the
  // chat's load cost.
  const [hasOpened, setHasOpened] = useState(false);
  const [openMode, setOpenMode] = useState<"chat" | "reserve_now">("chat");
  // Remember the expand preference across opens (lazy init — modal isn't rendered
  // until opened, so this never causes an SSR/hydration mismatch).
  const [expanded, setExpanded] = useState<boolean>(() => {
    try { return typeof window !== "undefined" && localStorage.getItem("ai-assistant-expanded") === "1"; }
    catch { return false; }
  });
  const toggleExpanded = () => {
    setExpanded((v) => {
      const next = !v;
      try { localStorage.setItem("ai-assistant-expanded", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  useImperativeHandle(ref, () => ({
    open: () => { setOpenMode("chat"); setHasOpened(true); setIsOpen(true); },
    openReserveNow: () => { setOpenMode("reserve_now"); setHasOpened(true); setIsOpen(true); },
    close: () => setIsOpen(false),
  }), []);

  // Minimize preserves the conversation (state is kept, panel just hidden).
  const minimize = () => setIsOpen(false);

  // Global Escape key dismissal listener for keyboard accessibility
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") minimize();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!AI_FEATURES_ENABLED) return null;

  return (
    <>
      {/* Backdrop — z-[100] ensures it floats ABOVE topbars (z-50) and sidebars */}
      {isOpen && (
        <div
          data-testid="assistant-backdrop"
          className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-md transition-opacity"
          onClick={minimize}
          aria-hidden="true"
        />
      )}

      {/* Panel — z-[110] ensures clear float above topbars, with top-20 offset in expanded mode */}
      {hasOpened && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rita-assistant-modal-title"
          className={`fixed z-[110] rounded-2xl border border-slate-700/80 dark:border-blue-900/50 bg-slate-900/95 dark:bg-[#0c1222]/95 text-slate-100 shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
            expanded
              ? "inset-4 sm:inset-6 md:left-auto md:right-6 md:top-20 md:bottom-6 md:w-[min(96vw,1040px)]"
              : "right-4 bottom-4 w-[min(94vw,440px)] h-[620px] max-h-[calc(100vh-96px)]"
          } ${isOpen ? "" : "hidden"}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/80 px-5 py-3.5 shrink-0">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span id="rita-assistant-modal-title" className="text-sm font-black uppercase tracking-tight text-white">
                {ASSISTANT_NAME} <span className="text-accent-brand">ASSISTANT</span>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleExpanded}
                className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-accent-brand/50"
                aria-label={expanded ? "Collapse window" : "Expand window"}
                title={expanded ? "Collapse window" : "Expand window"}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {expanded ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0v4m0-4h4m7 5l5-5m0 0v4m0-4h-4M9 15l-5 5m0 0v-4m0 4h4m7-5l5 5m0 0v-4m0 4h-4" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  )}
                </svg>
              </button>
              <button
                onClick={minimize}
                className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-accent-brand/50"
                aria-label="Minimize (Esc)"
                title="Minimize (Esc) — conversation is saved"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
                </svg>
              </button>
            </div>
          </div>

          {/* Chat content container */}
          <div className="flex-1 min-h-0 bg-slate-900/90 dark:bg-[#0c1222]/90">
            <BookingChatbot
              formRoute={formRoute}
              onClose={minimize}
              initialAction={openMode === "reserve_now" ? "reserve_now" : undefined}
              expanded={expanded}
            />
          </div>
        </div>
      )}
    </>
  );
}
);
