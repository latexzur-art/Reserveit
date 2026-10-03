/**
 * Building Bookings Service
 *
 * Handles booking queries, approve/reject, cancel, and manual reservation creation.
 * Integrates with booking_decisions, booking_status_history, and notifications.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { sanitizeSearch, dbBookingToView, type BookingFilters } from './building.types'
import { BuildingPricingService } from './building-pricing.service'
import { BookingPaymentService } from '@/backend/booking/paymentService'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { creditService } from '@/backend/credits/creditService'
import { ROUTES } from '@/lib/routes'
import {
  bookingApprovalEmail,
  bookingRejectionEmail,
  bookingCancellationEmail,
  bookerPaidBookingSubmittedEmail,
} from '@/backend/notifications/emailTemplates'

/** Batch-fetch reviewer name + role for bookings that have mismatch_reviewed_by set */
async function buildReviewerMap(
  supabase: ReturnType<typeof createAdminClient>,
  rows: any[]
): Promise<Map<string, { name: string; role: string }>> {
  const ids = [...new Set(rows.map(r => r.mismatch_reviewed_by).filter(Boolean))] as string[]
  const map = new Map<string, { name: string; role: string }>()
  if (ids.length === 0) return map

  const { data } = await supabase
    .from('users')
    .select('id, full_name, user_roles!user_roles_user_id_fkey(roles!inner(name))')
    .in('id', ids)

  for (const r of data ?? []) {
    const ur = Array.isArray(r.user_roles) ? r.user_roles[0] : r.user_roles
    const role = (Array.isArray(ur?.roles) ? ur.roles[0] : ur?.roles)?.name ?? 'reviewer'
    map.set(r.id, { name: (r as any).full_name ?? 'Unknown', role })
  }
  return map
}

/** Batch-fetch course name + elective info for bookings that have booking_course_code set */
async function buildCourseInfoMap(
  supabase: ReturnType<typeof createAdminClient>,
  rows: any[]
): Promise<Map<string, { course_name: string; is_elective: boolean; elective_type: string | null }>> {
  const codes = [...new Set(
    rows
      .filter(r => r.booking_course_code)
      .map(r => `${r.booking_department_code}:${r.booking_course_code}`)
  )]
  const map = new Map<string, { course_name: string; is_elective: boolean; elective_type: string | null }>()
  if (codes.length === 0) return map

  const { data } = await supabase
    .from('courses')
    .select('course_code, department_code, course_name, is_elective, elective_type')
  for (const c of data ?? []) {
    map.set(`${c.department_code}:${c.course_code}`, {
      course_name: c.course_name,
      is_elective: c.is_elective,
      elective_type: c.elective_type,
    })
  }
  return map
}

/** Statuses that the Building Admin can approve */
const APPROVABLE_STATUSES = ['pending', 'flagged', 'auto_approved']
/** Statuses that the Building Admin can reject/decline */
const REJECTABLE_STATUSES = ['pending', 'flagged', 'auto_approved']
/** Statuses that the Building Admin can cancel */
const CANCELLABLE_STATUSES = ['pending', 'approved', 'auto_approved', 'flagged']

export const BuildingBookingsQueries = {
/**
   * Get all bookings with pagination and filters.
   * Joins booking_decisions for scoring/audit trail visibility.
   */
  async getAll(filters?: BookingFilters) {
    const supabase = createAdminClient()
    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 20
    const offset = (page - 1) * pageSize

    let query = supabase
      .from('bookings')
      .select(`
        *,
        user:users!bookings_user_id_fkey(id, full_name, email),
        booking_facilities(
          facility_id,
          facility:facilities(id, name, room_number)
        ),
        booking_decisions(
          id, hard_constraints_passed, hard_constraint_failed_code,
          base_score, score_adjustments, final_score,
          decision, decision_reason, pipeline_version, created_at
        ),
        booking_overrides(id, override_action, new_values, created_at)
      `, { count: 'exact' })
      .order('submitted_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (filters?.status) {
      // Special filter: "needs_approval" = statuses awaiting Building Admin action
      if (filters.status === 'needs_approval') {
        query = query.in('current_status', APPROVABLE_STATUSES).eq('requires_payment', true)
      } else {
        query = query.eq('current_status', filters.status)
      }
    }

    if (filters?.type) {
      if (filters.type === 'external') {
        query = query.in('booking_type', ['external_paid', 'external'])
      } else if (filters.type === 'faculty' || filters.type === 'internal') {
        query = query.in('booking_type', ['internal_free', 'internal'])
      } else if (filters.type === 'academic') {
        query = query.in('booking_type', ['internal_free', 'school_event_block'])
      } else {
        query = query.eq('booking_type', filters.type)
      }
    }

    if (filters?.dateFrom) {
      query = query.gte('booking_date', filters.dateFrom)
    }

    if (filters?.dateTo) {
      query = query.lte('booking_date', filters.dateTo)
    }

    if (filters?.search) {
      const s = sanitizeSearch(filters.search)
      query = query.or(
        `booking_reference.ilike.%${s}%,purpose.ilike.%${s}%,event_name.ilike.%${s}%`
      )
    }

    const { data, error, count } = await query

    if (error) throw new Error(error.message)

    // Batch-fetch reviewer names + roles for flagged bookings that have been reviewed
    const reviewerMap = await buildReviewerMap(supabase, data ?? [])
    const courseInfoMap = await buildCourseInfoMap(supabase, data ?? [])

    return {
      bookings: (data || []).map(row => dbBookingToView(
        row,
        reviewerMap.get(row.mismatch_reviewed_by) ?? null,
        row.booking_course_code ? courseInfoMap.get(`${row.booking_department_code}:${row.booking_course_code}`) ?? null : null
      )),
      total: count || 0,
    }
  },
/**
   * Get a single booking by ID with full decision history
   */
  async getById(id: string) {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        user:users!bookings_user_id_fkey(id, full_name, email),
        booking_facilities(
          facility_id,
          facility:facilities(id, name, room_number)
        ),
        booking_decisions(
          id, hard_constraints_passed, hard_constraint_failed_code,
          base_score, score_adjustments, final_score,
          decision, decision_reason, pipeline_version, created_at
        ),
        booking_overrides(id, override_action, new_values, created_at)
      `)
      .eq('id', id)
      .single()

    if (error) throw new Error(error.message)

    const reviewerMap = await buildReviewerMap(supabase, [data])
    const courseInfoMap = await buildCourseInfoMap(supabase, [data])
    const courseInfo = data.booking_course_code
      ? courseInfoMap.get(`${data.booking_department_code}:${data.booking_course_code}`) ?? null
      : null
    return dbBookingToView(data, reviewerMap.get(data.mismatch_reviewed_by) ?? null, courseInfo)
  },
}
