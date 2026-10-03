import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { previewBookingScore, type PreviewFields, type PreviewUserProfile } from '@/backend/booking/scorePreview'
import { rateRoom, type RateableRoom, type RoomRating } from '@/backend/booking/roomRating'

export const dynamic = 'force-dynamic'

interface ScorePreviewBody {
  collected_fields?: Record<string, unknown>
  candidate_room?: Partial<RateableRoom> | null
}

/**
 * POST /api/ai/score-preview
 * Returns the REAL pre-submit grade (hard constraints + soft score) for a
 * prospective booking, plus an optional room match rating. Single source of
 * truth for "will this auto-approve?" in the chatbot and quick-fill UIs.
 */
export async function POST(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_AI_FEATURES_ENABLED !== 'true') {
    return NextResponse.json({ error: 'AI features disabled' }, { status: 403 })
  }

  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  let body: ScorePreviewBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const cf = (body.collected_fields ?? {}) as Record<string, unknown>
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const num = (v: unknown): number | null => (typeof v === 'number' && v > 0 ? Math.round(v) : null)

  const fields: PreviewFields = {
    facility_id: str(cf.facility_id),
    booking_date: str(cf.booking_date),
    start_time: str(cf.start_time),
    end_time: str(cf.end_time),
    booking_purpose: str(cf.booking_purpose),
    expected_attendees: num(cf.expected_attendees),
    purpose: str(cf.purpose),
    event_name: str(cf.event_name),
    special_requests: str(cf.special_requests),
    facility_purpose_category: str(cf.facility_purpose_category),
    mismatch_justification: str(cf.mismatch_justification),
    booking_course_code: str(cf.booking_course_code),
    booking_department_code: str(cf.booking_department_code),
    session_type: cf.session_type === 'lecture' || cf.session_type === 'lab' ? cf.session_type : null,
  }

  const userProfile: PreviewUserProfile = {
    id: user!.id,
    user_type: user!.user_type,
    account_status: user!.account_status,
    roles: user!.roles ?? [],
    department: user!.department ?? null,
  }

  const supabase = createAdminClient()

  try {
    const preview = await previewBookingScore(supabase, userProfile, fields)

    let room_rating: RoomRating | null = null
    const cr = body.candidate_room
    if (cr && typeof cr.id === 'string' && typeof cr.capacity === 'number') {
      room_rating = rateRoom(
        {
          id: cr.id,
          name: cr.name ?? '',
          facility_type_name: cr.facility_type_name ?? null,
          capacity: cr.capacity,
          is_paid_facility: cr.is_paid_facility,
          specialized_tag: cr.specialized_tag ?? null,
        },
        {
          booking_purpose: fields.booking_purpose,
          expected_attendees: fields.expected_attendees ?? null,
          session_type: fields.session_type ?? null,
          booking_course_code: fields.booking_course_code ?? null,
        }
      )
    }

    return NextResponse.json({ preview, room_rating })
  } catch (err) {
    console.error('[score-preview] error:', err)
    return NextResponse.json({ error: 'Failed to compute score preview' }, { status: 500 })
  }
}
