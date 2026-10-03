import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from '@/lib/auth/guards';
import { getRecentBookings } from "@/backend/ai/tools";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/user-context
 * Lightweight feed for the chatbot's "rebook" quick chips: the user's recent
 * upcoming + past reservations. Reuses getRecentBookings (same source as the
 * get_my_bookings tool and the chat memory injection).
 */
export async function GET() {
  if (process.env.NEXT_PUBLIC_AI_FEATURES_ENABLED !== "true") {
    return NextResponse.json({ upcoming: [], past: [] });
  }

  const { error, user } = await requireAuthenticatedUser();
  if (error) return error;

  const supabase = createAdminClient();
  try {
    const [upcoming, past] = await Promise.all([
      getRecentBookings(supabase, user!.id, "upcoming", 5),
      getRecentBookings(supabase, user!.id, "past", 5),
    ]);
    return NextResponse.json({ upcoming, past });
  } catch (err) {
    console.error("[user-context] failed:", err);
    return NextResponse.json({ upcoming: [], past: [] });
  }
}
