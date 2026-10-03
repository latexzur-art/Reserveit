import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from '@/lib/auth/guards';
import { summarizeSession, generateSessionTitle } from "@/backend/ai/tools";
import { scrubPII } from "@/app/api/ai/chat/_lib/safety";

// PATCH /api/ai/sessions/[id] — update an existing session's messages, fields, flow, or status.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuthenticatedUser();
  if (error) return error;

  if (process.env.NEXT_PUBLIC_AI_FEATURES_ENABLED !== "true") {
    return NextResponse.json({ ok: true });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing session id" }, { status: 400 });
  }

  let body: {
    messages?: unknown;
    collected_fields?: unknown;
    booking_flow?: string;
    session_status?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    last_active_at: new Date().toISOString(),
  };

  if (Array.isArray(body.messages)) {
    // Scrub PII from user messages before storing (defense-in-depth).
    updates.messages = body.messages.map((msg: { role: string; content: string }) => {
      if (msg.role === "user" && typeof msg.content === "string") {
        return { ...msg, content: scrubPII(msg.content) };
      }
      return msg;
    });
  }
  if (body.collected_fields && typeof body.collected_fields === "object")
    updates.collected_fields = body.collected_fields;
  if (typeof body.booking_flow === "string") updates.booking_flow = body.booking_flow;
  if (typeof body.session_status === "string") updates.session_status = body.session_status;

  // On completion, store a one-line summary + an LLM-generated title so past
  // conversations can be recalled and shown by name.
  if (body.session_status === "completed") {
    const msgs = Array.isArray(body.messages)
      ? (body.messages as Array<{ role: string; content: string }>)
      : null;
    const fields =
      body.collected_fields && typeof body.collected_fields === "object"
        ? (body.collected_fields as Record<string, unknown>)
        : null;
    const flow = typeof body.booking_flow === "string" ? body.booking_flow : null;

    updates.summary = summarizeSession(msgs, fields, flow);

    // Reuse the repo's OpenRouter client + model (see chat/_lib/fields.ts). The
    // generator falls back to a deterministic title if the key is absent or the
    // call fails, so archival never breaks on the LLM.
    const apiKey = process.env.OPENROUTER_API_KEY;
    const complete = async ({ system, user }: { system: string; user: string }) => {
      if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");
      const openai = new OpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey });
      const r = await openai.chat.completions.create({
        model: "deepseek/deepseek-v4-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 24,
        temperature: 0.3,
      });
      return r.choices[0]?.message?.content ?? "";
    };
    updates.title = await generateSessionTitle(msgs, fields, complete, flow);
  }

  const supabase = createAdminClient();

  const { error: updateError } = await supabase
    .from("ai_chat_sessions")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id); // RLS guard: user can only update their own sessions

  if (updateError) {
    console.error("[sessions PATCH] update failed:", updateError);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
