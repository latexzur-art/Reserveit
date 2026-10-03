import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from '@/lib/auth/guards';
import { scrubPII } from "@/app/api/ai/chat/_lib/safety";
// GET /api/ai/sessions — return the most recent active session for the current user.
// Also purges expired rows for this user as a lightweight cleanup.
export async function GET() {
  const { error, user } = await requireAuthenticatedUser();
  if (error) return error;

  if (process.env.NEXT_PUBLIC_AI_FEATURES_ENABLED !== "true") {
    return NextResponse.json({ session: null });
  }

  const supabase = createAdminClient();

  // Purge expired sessions for this user (best-effort, non-blocking concern)
  await supabase
    .from("ai_chat_sessions")
    .delete()
    .eq("user_id", user.id)
    .lt("expires_at", new Date().toISOString());

  // Fetch most recent active session
  const { data, error: fetchError } = await supabase
    .from("ai_chat_sessions")
    .select("id, messages, collected_fields, booking_flow, last_active_at")
    .eq("user_id", user.id)
    .eq("session_status", "active")
    .order("last_active_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    console.error("[sessions GET] fetch failed:", fetchError);
    return NextResponse.json({ session: null });
  }

  return NextResponse.json({ session: data ?? null });
}

// POST /api/ai/sessions — create a new session for the current user.
export async function POST(req: NextRequest) {
  const { error, user } = await requireAuthenticatedUser();
  if (error) return error;

  if (process.env.NEXT_PUBLIC_AI_FEATURES_ENABLED !== "true") {
    return NextResponse.json({ id: null });
  }

  let body: { messages?: unknown; collected_fields?: unknown; booking_flow?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine for a fresh session
  }

  const supabase = createAdminClient();

  const { data, error: insertError } = await supabase
    .from("ai_chat_sessions")
    .insert({
      user_id: user.id,
      messages: Array.isArray(body.messages)
        ? body.messages.map((msg: { role: string; content: string }) =>
            msg.role === "user" && typeof msg.content === "string"
              ? { ...msg, content: scrubPII(msg.content) }
              : msg
          )
        : [],
      collected_fields: body.collected_fields && typeof body.collected_fields === "object"
        ? body.collected_fields
        : {},
      booking_flow: typeof body.booking_flow === "string" ? body.booking_flow : "standard",
      session_status: "active",
    })
    .select("id")
    .single();

  if (insertError || !data) {
    // FK violation means user_id not yet in the referenced table — non-fatal,
    // chat works fine without session persistence.
    if (insertError?.code === "23503") {
      console.warn("[sessions POST] FK constraint — session persistence skipped for user:", user.id);
      return NextResponse.json({ id: null });
    }
    console.error("[sessions POST] insert failed:", insertError);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
