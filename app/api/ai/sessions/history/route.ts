import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from '@/lib/auth/guards';
// GET /api/ai/sessions/history — recent COMPLETED sessions with their stored
// summary, for the assistant's "past conversations" recall list.
export async function GET() {
  const { error, user } = await requireAuthenticatedUser();
  if (error) return error;

  if (process.env.NEXT_PUBLIC_AI_FEATURES_ENABLED !== "true") {
    return NextResponse.json({ sessions: [] });
  }

  const supabase = createAdminClient();

  const { data, error: fetchError } = await supabase
    .from("ai_chat_sessions")
    // messages included so the client can restore the full transcript on resume.
    .select("id, summary, title, messages, collected_fields, booking_flow, last_active_at")
    .eq("user_id", user.id)
    .eq("session_status", "completed")
    .order("last_active_at", { ascending: false })
    .limit(10);

  if (fetchError) {
    console.error("[sessions history] fetch failed:", fetchError);
    return NextResponse.json({ sessions: [] });
  }

  return NextResponse.json({ sessions: data ?? [] });
}
