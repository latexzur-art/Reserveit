/** Field extraction, sanitization, preview helpers + local LLM call. */

import { OpenAI } from "openai";
import type { PreviewFields, ScorePreviewResult } from "@/backend/booking/scorePreview";
import { type CollectedFields, EMPTY_FIELDS, VALID_BOOKING_PURPOSES, VALID_SESSION_TYPES, VALID_EVENT_NAMES } from "./shared";

// ─── Pre-Extraction ────────────────────────────────────────────────────────────
export async function preExtractFields(message: string, apiKey: string): Promise<Partial<CollectedFields>> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const openai = new OpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey });

    const prompt = `Extract booking details from this message: "${message}".
      TODAY: ${today}
      Convert relative dates to YYYY-MM-DD.
      Convert times to HH:MM (24-hour).
      If duration is missing but intent exists, assume 2 hours.
      Return ONLY valid JSON matching this structure perfectly. Set missing fields strictly to null:
      {"booking_date": "YYYY-MM-DD", "start_time": "HH:MM", "end_time": "HH:MM", "expected_attendees": 0}`;

    const completion = await openai.chat.completions.create({
      model: "deepseek/deepseek-v4-flash",
      response_format: { type: "json_object" },
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = completion.choices[0]?.message?.content || "{}";
    return JSON.parse(rawText);
  } catch (err) {
    console.error("[chat] preExtractFields DeepSeek failed:", err);
    return {};
  }
}


// ─── Sanitize Output ───────────────────────────────────────────────────
export function sanitizeCollectedFields(cf: Record<string, unknown>): CollectedFields {
  const isValidTime = (t: unknown): t is string => typeof t === "string" && /^\d{2}:\d{2}$/.test(t);
  const isValidDate = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

  const startTime = isValidTime(cf.start_time) ? cf.start_time : null;
  const endTime = isValidTime(cf.end_time) ? cf.end_time : null;

  return {
    facility_id: typeof cf.facility_id === "string" && cf.facility_id.trim() ? cf.facility_id.trim() : null,
    facility_name: typeof cf.facility_name === "string" && cf.facility_name.trim() ? cf.facility_name.trim().slice(0, 200) : null,
    booking_date: isValidDate(cf.booking_date) ? cf.booking_date : null,
    start_time: startTime,
    end_time: startTime && endTime && endTime > startTime ? endTime : null,
    booking_purpose: VALID_BOOKING_PURPOSES.includes(cf.booking_purpose as string) ? (cf.booking_purpose as string) : null,
    expected_attendees: typeof cf.expected_attendees === "number" && cf.expected_attendees > 0 ? Math.round(cf.expected_attendees) : null,
    booking_department_code: typeof cf.booking_department_code === "string" && cf.booking_department_code.trim() ? cf.booking_department_code.trim().slice(0, 20) : null,
    booking_course_code: typeof cf.booking_course_code === "string" && cf.booking_course_code.trim() ? cf.booking_course_code.trim().slice(0, 20) : null,
    session_type: VALID_SESSION_TYPES.includes(cf.session_type as string) ? (cf.session_type as string) : null,
    event_name: VALID_EVENT_NAMES.includes(cf.event_name as string) ? (cf.event_name as string) : null,
    facility_purpose_category: typeof cf.facility_purpose_category === "string" && cf.facility_purpose_category.trim() ? cf.facility_purpose_category.trim().slice(0, 50) : null,
    purpose: typeof cf.purpose === "string" && cf.purpose.trim() ? cf.purpose.trim().slice(0, 500) : null,
    special_requests: typeof cf.special_requests === "string" && cf.special_requests.trim() ? cf.special_requests.trim().slice(0, 500) : null,
  };
}

export function mergeFields(previous: CollectedFields, aiReturned: CollectedFields): CollectedFields {
  const merged = { ...previous };
  for (const key of Object.keys(merged) as (keyof CollectedFields)[]) {
    if (aiReturned[key] !== null && aiReturned[key] !== undefined) {
      (merged as Record<string, unknown>)[key] = aiReturned[key];
    }
  }
  return merged;
}

export function toPreviewFields(cf: CollectedFields): PreviewFields {
  return {
    facility_id: cf.facility_id,
    booking_date: cf.booking_date,
    start_time: cf.start_time,
    end_time: cf.end_time,
    booking_purpose: cf.booking_purpose,
    expected_attendees: cf.expected_attendees,
    purpose: cf.purpose,
    event_name: cf.event_name,
    special_requests: cf.special_requests,
    facility_purpose_category: cf.facility_purpose_category,
    booking_course_code: cf.booking_course_code,
    booking_department_code: cf.booking_department_code,
    session_type: cf.session_type === "lecture" || cf.session_type === "lab" ? cf.session_type : null,
  };
}

export const isUUID = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export function gradeStatus(preview: ScorePreviewResult): "auto_approve" | "review" | "declined" | "hard_fail" | null {
  if (preview.status === "hard_fail") return "hard_fail";
  if (preview.status !== "scored") return null;
  if (preview.willAutoApprove) return "auto_approve";
  if (preview.willDecline) return "declined";
  return "review";
}

export function reasoningFromPreview(preview: ScorePreviewResult): string | null {
  if (preview.status === "hard_fail") return preview.message;
  if (preview.status !== "scored") return null;
  const top = preview.adjustments
    .filter((a) => a.points !== 0)
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    .slice(0, 2)
    .map((a) => `${a.points > 0 ? "+" : ""}${a.points} ${a.name}`)
    .join(", ");
  return top ? `Key factors: ${top}.` : "Score is at baseline.";
}

export async function callLocalLLM(messages: Array<{ role: string; content: string }>): Promise<string | null> {
  if (process.env.LOCAL_LLM_ENABLED !== "true") return null;
  const baseUrl = process.env.LOCAL_LLM_BASE_URL || "http://127.0.0.1:1234/v1";
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, temperature: 0.3, max_tokens: 1024 }),
      signal: AbortSignal.timeout(180000),
    });
    if (!res.ok) throw new Error(`Local LLM status ${res.status}`);
    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.warn("[chat] LM Studio unavailable, routing to OpenRouter cloud:", (err as Error).message);
    return null;
  }
}

