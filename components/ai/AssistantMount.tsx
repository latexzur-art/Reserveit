"use client";

import { useMemo, useRef } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { resolveCapabilities } from "@/backend/ai/roleCapabilities";
import { ASSISTANT_NAME } from "@/backend/ai/identity";
import { BookingChatbotModal, type BookingChatbotModalHandle } from "./BookingChatbotModal";

/**
 * Mounts the role-aware AI Assistant for the signed-in user. Derives the
 * booking destination + whether the booking flow applies from the user's role,
 * so a single mount in each role-group layout serves every role correctly.
 *
 * Also renders the assistant's launcher — a floating button that opens the
 * modal via its ref handle. Without this the modal has no trigger and Rita is
 * unreachable, since the modal only opens through `open()`.
 */
export function AssistantMount() {
  const { user } = useAuth();
  const caps = useMemo(() => resolveCapabilities(user?.roles ?? []), [user?.roles]);
  const modalRef = useRef<BookingChatbotModalHandle>(null);

  if (!user) return null;

  const formRoute = caps.defaultFormRoute ?? caps.destinations[0]?.href ?? "/";

  return (
    <>
      <button
        type="button"
        onClick={() => modalRef.current?.open()}
        aria-label={`Open ${ASSISTANT_NAME}, the ReserveIT assistant`}
        className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-sti-blue px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sti-navy/30 ring-1 ring-white/15 transition-all hover:bg-sti-blue-dark hover:ring-accent-brand/50 focus:outline-none focus:ring-2 focus:ring-accent-brand/70"
      >
        <Sparkles className="h-5 w-5" aria-hidden="true" />
        <span>Ask {ASSISTANT_NAME}</span>
      </button>

      <BookingChatbotModal ref={modalRef} formRoute={formRoute} showReserveNow={caps.canBook} />
    </>
  );
}
