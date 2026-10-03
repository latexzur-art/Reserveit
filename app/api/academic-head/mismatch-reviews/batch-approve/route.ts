/**
 * POST /api/academic-head/mismatch-reviews/batch-approve
 *
 * L2 — approve multiple mismatch-flagged bookings in one action, so the AH doesn't
 * have to open each one individually. Reuses the exact same approveMismatchBooking()
 * the single-booking PATCH route calls (backend/booking/mismatchApproval.ts) — no
 * duplicated logic, no risk of the two paths drifting apart.
 *
 * Processes sequentially (not Promise.all) so one booking's failure can't interleave
 * writes with another's and so per-booking errors are cleanly attributable in the
 * response. Each booking is independent — a failure on one does not roll back or
 * block the others.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { approveMismatchBooking } from '@/backend/booking/mismatchApproval'

const BatchApproveSchema = z.object({
  booking_ids: z.array(z.string().uuid()).min(1).max(50),
  reviewer_notes: z.string().max(1000).optional(),
})

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const hasRole = user.roles?.some((r: { name: string }) => ['academic_head', 'building_admin'].includes(r.name))
  if (!hasRole) {
    return NextResponse.json({ error: 'Forbidden: academic_head or building_admin role required' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = BatchApproveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const { booking_ids, reviewer_notes } = parsed.data
  const supabase = createAdminClient()

  const results: Array<{ booking_id: string; ok: boolean; error?: string }> = []
  for (const bookingId of booking_ids) {
    const result = await approveMismatchBooking(supabase, bookingId, user, reviewer_notes)
    results.push(result.ok
      ? { booking_id: result.booking_id, ok: true }
      : { booking_id: result.booking_id, ok: false, error: result.error })
  }

  const approved = results.filter(r => r.ok).length
  const failed = results.length - approved

  return NextResponse.json({ approved, failed, results })
}
