/**
 * Cross-session memory: recent bookings + session summaries.
 * @module backend/ai/tools/memory
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getManilaTodayISO } from '@/lib/timezone'

export interface RecentBooking {
  reference: string | null
  facility_name: string | null
  date: string
  start_time: string
  end_time: string
  booking_purpose: string | null
  event_name: string | null
  status: string
}

const STATUS_LABEL: Record<string, string> = {
  auto_approved: 'approved',
  approved: 'approved',
  flagged: 'pending review',
  pending: 'pending',
  auto_declined: 'declined',
  rejected: 'declined',
  cancelled: 'cancelled',
  completed: 'completed',
}

export async function getRecentBookings(
  supabase: SupabaseClient,
  userId: string,
  timeframe: 'upcoming' | 'past' | 'all' = 'all',
  limit = 8
): Promise<RecentBooking[]> {
  const today = getManilaTodayISO()
  let query = supabase
    .from('bookings')
    .select(`
      booking_reference, booking_date, start_time, end_time,
      booking_purpose, purpose, event_name, current_status,
      booking_facilities ( facility:facilities ( name ) )
    `)
    .eq('user_id', userId)

  if (timeframe === 'upcoming') {
    query = query.gte('booking_date', today).order('booking_date', { ascending: true })
  } else if (timeframe === 'past') {
    query = query.lt('booking_date', today).order('booking_date', { ascending: false })
  } else {
    query = query.order('booking_date', { ascending: false })
  }

  const { data, error } = await query.limit(limit)
  if (error || !data) return []

  return data.map((b) => {
    const bf = (b as { booking_facilities?: Array<{ facility?: { name?: string } | { name?: string }[] }> })
      .booking_facilities?.[0]?.facility
    const facilityName = Array.isArray(bf) ? bf[0]?.name ?? null : bf?.name ?? null
    return {
      reference: b.booking_reference ?? null,
      facility_name: facilityName,
      date: b.booking_date,
      start_time: (b.start_time as string)?.slice(0, 5) ?? b.start_time,
      end_time: (b.end_time as string)?.slice(0, 5) ?? b.end_time,
      booking_purpose: b.booking_purpose ?? null,
      event_name: b.event_name ?? null,
      status: STATUS_LABEL[b.current_status] ?? b.current_status,
    }
  })
}

/** Compact memory string injected into the chat system prompt. */
export function formatBookingsMemory(rows: RecentBooking[]): string {
  if (!rows.length) return 'USER BOOKING HISTORY: (none yet — this is a new user)'
  const lines = rows.slice(0, 5).map((r) => {
    const what = r.event_name || r.booking_purpose || 'booking'
    const room = r.facility_name ?? 'a room'
    return `  - ${room} on ${r.date} ${r.start_time}–${r.end_time} for ${what} [${r.status}]`
  })
  // Most-used facility
  const counts = new Map<string, number>()
  for (const r of rows) if (r.facility_name) counts.set(r.facility_name, (counts.get(r.facility_name) ?? 0) + 1)
  const mostUsed = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  const fav = mostUsed ? `\n  Most-booked room: ${mostUsed[0]} (${mostUsed[1]}×)` : ''
  return `USER BOOKING HISTORY (recent, use to personalize & offer rebooking):\n${lines.join('\n')}${fav}`
}

// ─── Cross-conversation memory: summaries of the user's earlier chat sessions ──
export interface SessionSummary {
  topic: string
  outcome: string
  when: string
}

interface StoredSessionMessage {
  role: string
  content: string
}

/**
 * Deterministic one-line summary of a chat session — stored on completion and
 * used as a fallback when no stored summary exists. No LLM call.
 */
export function summarizeSession(
  messages: Array<{ role: string; content: string }> | null | undefined,
  collectedFields: Record<string, unknown> | null | undefined,
  bookingFlow?: string | null
): string {
  const cf = collectedFields ?? {}
  const flow = bookingFlow === 'paid' ? 'Paid ' : ''
  const room = (cf.facility_name as string) || null
  const purpose = (cf.booking_purpose as string) || null
  const date = (cf.booking_date as string) || null
  if (room || purpose || date) {
    const parts: string[] = [`${flow}booking`]
    if (room) parts.push(`of ${room}`)
    if (purpose) parts.push(`for ${purpose}`)
    if (date) parts.push(`on ${date}`)
    return parts.join(' ')
  }
  const msgs = Array.isArray(messages) ? messages : []
  const firstUser = msgs.find((m) => m.role === 'user')
  if (firstUser?.content) return firstUser.content.slice(0, 100)
  return 'A short assistant conversation'
}

const TITLE_MAX = 48

/** Collapse whitespace, trim, and cap a title at TITLE_MAX chars (+ ellipsis). */
function truncateTitle(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > TITLE_MAX ? `${t.slice(0, TITLE_MAX).trim()}…` : t
}

/** Strip a "Title:" prefix + surrounding quotes + trailing sentence punctuation. */
function cleanModelTitle(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^title:\s*/i, '')
    .replace(/^["'`\s]+/, '')
    .replace(/["'`.。!?\s]+$/, '')
    .trim()
}

/**
 * Deterministic conversation title — the user's first message, else the booking
 * summary, else "Conversation". The fallback when an LLM title can't be produced.
 */
export function deriveSessionTitle(
  messages: Array<{ role: string; content: string }> | null | undefined,
  collectedFields: Record<string, unknown> | null | undefined,
  bookingFlow?: string | null
): string {
  const msgs = Array.isArray(messages) ? messages : []
  const firstUser = msgs.find(
    (m) => m.role === 'user' && typeof m.content === 'string' && m.content.trim()
  )
  if (firstUser) return truncateTitle(firstUser.content)
  const summary = summarizeSession(messages, collectedFields, bookingFlow)
  if (summary && summary !== 'A short assistant conversation') return truncateTitle(summary)
  return 'Conversation'
}

/**
 * Short LLM-generated conversation title (3–6 words). `complete` performs the
 * model call; on any failure or empty output it falls back to the deterministic
 * {@link deriveSessionTitle}, so a title always exists.
 */
export async function generateSessionTitle(
  messages: Array<{ role: string; content: string }> | null | undefined,
  collectedFields: Record<string, unknown> | null | undefined,
  complete: (prompt: { system: string; user: string }) => Promise<string>,
  bookingFlow?: string | null
): Promise<string> {
  const fallback = () => deriveSessionTitle(messages, collectedFields, bookingFlow)
  const msgs = Array.isArray(messages) ? messages : []
  const transcript = msgs
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(0, 6)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${String(m.content).slice(0, 200)}`)
    .join('\n')
  if (!transcript.trim()) return fallback()
  try {
    const raw = await complete({
      system:
        'You write a concise 3–6 word title for a chat conversation. Reply with ONLY the title — no quotes, no punctuation, no prefix.',
      user: `Conversation:\n${transcript}\n\nTitle:`,
    })
    const cleaned = cleanModelTitle(String(raw ?? ''))
    return cleaned ? truncateTitle(cleaned) : fallback()
  } catch {
    return fallback()
  }
}

/**
 * Summarize the user's recent COMPLETED chatbot sessions (past conversations,
 * distinct from the still-active current one) so the assistant can recall what
 * was discussed before. Deterministic — no LLM call.
 */
export async function getRecentSessionSummaries(
  supabase: SupabaseClient,
  userId: string,
  limit = 3
): Promise<SessionSummary[]> {
  const { data, error } = await supabase
    .from('ai_chat_sessions')
    .select('messages, collected_fields, booking_flow, session_status, last_active_at, summary')
    .eq('user_id', userId)
    .eq('session_status', 'completed')
    .order('last_active_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map((s) => {
    const stored = typeof s.summary === 'string' && s.summary.trim() ? s.summary.trim() : null
    const topic =
      stored ??
      summarizeSession(
        s.messages as StoredSessionMessage[] | null,
        s.collected_fields as Record<string, unknown> | null,
        s.booking_flow as string | null
      )
    return { topic, outcome: 'completed', when: s.last_active_at as string }
  })
}

/** Compact "earlier conversations" block for the chat system prompt. */
export function formatSessionMemory(rows: SessionSummary[]): string {
  if (!rows.length) return ''
  const lines = rows.map(
    (r) => `  - ${r.topic} (${new Date(r.when).toISOString().slice(0, 10)}, ${r.outcome})`
  )
  return `EARLIER CHATBOT CONVERSATIONS (your past completed chats — reference naturally if relevant, don't re-ask what was settled):\n${lines.join('\n')}`
}

// ─── Policies (static, reliable) ───────────────────────────────────────────────
