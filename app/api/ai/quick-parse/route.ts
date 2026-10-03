import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";
import { ASSISTANT_NAME } from "@/backend/ai/identity";
import { requireAuthenticatedUser } from "@/lib/auth/guards";
import { checkRateLimitAsync, RATE_LIMITS } from "@/lib/rate-limit";

// ─── Valid Values (match actual form field values, not display labels) ────────
const VALID_BOOKING_PURPOSES = [
  "academic",
  "school_event",
  "department_use",
  "personal",
  "commercial",
  "community",
];

const VALID_SESSION_TYPES = ["lecture", "lab"];

// ─── Scoring Context Prompt ───────────────────────────────────────────────────
function buildSystemPrompt(): string {
  const today = new Date();
  const todayISO = today.toISOString().split("T")[0];
  const currentTime = today.toTimeString().slice(0, 5);

  return `You are ${ASSISTANT_NAME}, a smart booking assistant for a university facility reservation system called ReserveIT.
Your job is to:
1. Parse the user's free-text booking request
2. Optimize the field values to maximize the booking approval score (0–100, need ≥75 for auto-approval)
3. Return ONLY a valid JSON object — no markdown, no explanation, no code fences

SCORING PENALTIES YOU MUST AVOID:
- Purpose/facility mismatch: -20 pts
- Lecture session booked in lab room (SESSION_LECTURE_IN_LAB): -20 pts
- Lab session booked in lecture room (SESSION_LAB_IN_LECTURE): -15 pts
- Same-day booking: -15 pts
- Peak hours (08:00–09:00 or 12:00–13:00): -10 pts
- Weekend booking: -10 pts
- Duration over 4 hours: -10 pts
- Evening booking (start ≥ 18:00): -5 pts
- Incomplete required fields: -5 pts

SCORING BONUSES TO TARGET:
- Academic purpose: +15 pts

OPTIMIZATION RULES:
- Default start_time to "10:00" or "14:00" when time is vague (avoids peak hours)
- Default end_time to start_time + 2 hours when duration is unspecified
- Use "academic" booking_purpose when intent is clearly educational
- Match facility to purpose: seminar/lecture → "AVR" or "Function Room", lab work → "Computer Lab"
- Prefer weekdays when date is vague ("soon", "this week", "next available")
- NEVER suggest a lab room for a lecture; NEVER suggest a lecture room for lab work
- Always generate a purpose_statement when enough context exists — it is required
- Put equipment/setup needs in special_requests as plain text (e.g., "Need projector and 40 chairs")

VALID VALUES (use ONLY these exact strings — return null if not confident):
booking_purpose options: "academic", "school_event", "department_use", "personal", "commercial", "community"
  - Use "academic" for class lectures, exams, tutorials, thesis defense
  - Use "school_event" for school-sponsored events, seminars, activities
  - Use "department_use" for department meetings, trainings
  - Use "personal" for personal events like birthdays, reunions
  - Use "commercial" for business events, third-party rentals
  - Use "community" for community outreach, external organizations
session_type options: "lecture", "lab" (ONLY these two values, or null)

TODAY: ${todayISO}
CURRENT TIME: ${currentTime}

RETURN THIS EXACT JSON STRUCTURE (null for unknown fields, never omit keys):
{
  "facility_search_term": string | null,
  "booking_date": "YYYY-MM-DD" | null,
  "start_time": "HH:MM" | null,
  "end_time": "HH:MM" | null,
  "booking_purpose": "academic"|"school_event"|"department_use"|"personal"|"commercial"|"community" | null,
  "expected_attendees": number | null,
  "department": string | null,
  "course": string | null,
  "session_type": "lecture"|"lab" | null,
  "purpose_statement": string | null,
  "special_requests": string | null,
  "estimated_score": number | null,
  "confidence": "high" | "medium" | "low",
  "notes": string | null
}

Notes on fields:
- facility_search_term: human-readable search term (e.g. "AVR", "Computer Lab", "MPH") — NOT an ID
- booking_date: ISO format YYYY-MM-DD — the form accepts this directly, no conversion needed
- purpose_statement: draft a clear 1–2 sentence professional statement; always generate if context exists
- notes: max 150 chars, explain any optimization choices made (e.g. time change to avoid peak hours)`;
}

// ─── Sanitizer ────────────────────────────────────────────────────────────────
function sanitize(parsed: Record<string, unknown>) {
  const isValidTime = (t: unknown): t is string =>
    typeof t === "string" && /^\d{2}:\d{2}$/.test(t);

  const isValidDate = (d: unknown): d is string =>
    typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

  const startTime = isValidTime(parsed.start_time) ? parsed.start_time : null;
  const endTime = isValidTime(parsed.end_time) ? parsed.end_time : null;
  const endTimeValid =
    startTime && endTime && endTime > startTime ? endTime : null;

  return {
    facility_search_term:
      typeof parsed.facility_search_term === "string" &&
      parsed.facility_search_term.trim().length > 0
        ? parsed.facility_search_term.trim().slice(0, 100)
        : null,

    booking_date: isValidDate(parsed.booking_date) ? parsed.booking_date : null,

    start_time: startTime,
    end_time: endTimeValid,

    booking_purpose: VALID_BOOKING_PURPOSES.includes(
      parsed.booking_purpose as string
    )
      ? (parsed.booking_purpose as string)
      : null,

    expected_attendees:
      typeof parsed.expected_attendees === "number" &&
      parsed.expected_attendees > 0 &&
      parsed.expected_attendees <= 5000
        ? Math.round(parsed.expected_attendees)
        : null,

    department:
      typeof parsed.department === "string" &&
      parsed.department.trim().length > 0
        ? parsed.department.trim().slice(0, 100)
        : null,

    course:
      typeof parsed.course === "string" && parsed.course.trim().length > 0
        ? parsed.course.trim().slice(0, 100)
        : null,

    session_type: VALID_SESSION_TYPES.includes(parsed.session_type as string)
      ? (parsed.session_type as string)
      : null,

    purpose_statement:
      typeof parsed.purpose_statement === "string" &&
      parsed.purpose_statement.trim().length > 0
        ? parsed.purpose_statement.trim().slice(0, 500)
        : null,

    special_requests:
      typeof parsed.special_requests === "string" &&
      parsed.special_requests.trim().length > 0
        ? parsed.special_requests.trim().slice(0, 500)
        : null,

    estimated_score:
      typeof parsed.estimated_score === "number"
        ? Math.min(100, Math.max(0, Math.round(parsed.estimated_score)))
        : null,

    confidence: ["high", "medium", "low"].includes(
      parsed.confidence as string
    )
      ? (parsed.confidence as string)
      : "low",

    notes:
      typeof parsed.notes === "string" && parsed.notes.trim().length > 0
        ? parsed.notes.trim().slice(0, 150)
        : null,
  };
}

// ─── Route Handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    if (process.env.NEXT_PUBLIC_AI_FEATURES_ENABLED !== "true") {
      return NextResponse.json({ error: "AI features disabled" }, { status: 403 });
    }

    const { error: authError, user } = await requireAuthenticatedUser();
    if (authError) return authError;

    const limited = await checkRateLimitAsync(`ai-quick-parse:${user.id}`, RATE_LIMITS.AI_CHAT);
    if (limited) return limited;

    const body = await req.json().catch(() => null);
    if (!body || typeof body.text !== "string") {
      return NextResponse.json({ error: "Missing text field" }, { status: 400 });
    }

    const text = body.text.trim();
    if (text.length < 5) {
      return NextResponse.json({ error: "Text too short to parse" }, { status: 400 });
    }
    if (text.length > 500) {
      return NextResponse.json({ error: "Text too long" }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error("[quick-parse] OPENROUTER_API_KEY not set");
      return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
    }

    const openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
    });

    const completion = await openai.chat.completions.create({
      model: "deepseek/deepseek-v4-flash",
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: `User's booking request: "${text}"` },
      ],
    });

    const rawText = completion.choices[0]?.message?.content || "{}";

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawText.trim());
    } catch {
      console.error("[quick-parse] DeepSeek returned non-JSON:", rawText.slice(0, 200));
      return NextResponse.json({ error: "Parse failed" }, { status: 422 });
    }

    const sanitized = sanitize(parsed);

    const meaningfulFields = [
      sanitized.facility_search_term,
      sanitized.booking_date,
      sanitized.start_time,
      sanitized.booking_purpose,
    ].filter(Boolean).length;

    if (meaningfulFields < 2) {
      return NextResponse.json(
        { error: "Not enough information to pre-fill. Try being more specific." },
        { status: 422 }
      );
    }

    return NextResponse.json(sanitized);
  } catch (error) {
    console.error("[quick-parse] Unexpected error:", error);
    return NextResponse.json({ error: "AI service temporarily unavailable" }, { status: 503 });
  }
}
