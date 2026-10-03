import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { BASE_SCORE, SCORING_THRESHOLDS } from '@/backend/booking/booking.types'
import { cacheGet, cacheSet, TTL_24H } from '@/lib/cache'

// Condition fields that depend only on the user's profile (not the specific booking)
const PROFILE_FIELDS = new Set([
  'user_type', 'user_role', 'booking_count',
  'cancellation_rate', 'violation_count', 'has_unpaid_balance',
])

type SoftRule = {
  code: string
  name: string
  point_value: number
  condition_field: string
  condition_operator: string
  condition_value: string
}

function evalCondition(
  operator: string,
  conditionValue: string | null,
  contextValue: unknown
): boolean {
  const normalize = (v: unknown) => String(v).toLowerCase().trim()

  switch (operator) {
    case 'equals':
      if (Array.isArray(contextValue))
        return (contextValue as string[]).some(cv => normalize(cv) === normalize(conditionValue))
      return normalize(contextValue) === normalize(conditionValue)
    case 'not_equals':
      if (Array.isArray(contextValue))
        return !(contextValue as string[]).some(cv => normalize(cv) === normalize(conditionValue))
      return normalize(contextValue) !== normalize(conditionValue)
    case 'greater_than':
      return Number(contextValue) > Number(conditionValue)
    case 'less_than':
      return Number(contextValue) < Number(conditionValue)
    case 'greater_than_or_equal':
      return Number(contextValue) >= Number(conditionValue)
    case 'less_than_or_equal':
      return Number(contextValue) <= Number(conditionValue)
    case 'in': {
      const values = (conditionValue ?? '').split(',').map(v => normalize(v))
      if (Array.isArray(contextValue))
        return (contextValue as string[]).some(cv => values.includes(normalize(cv)))
      return values.includes(normalize(contextValue))
    }
    case 'not_in': {
      const values = (conditionValue ?? '').split(',').map(v => normalize(v))
      if (Array.isArray(contextValue))
        return !(contextValue as string[]).some(cv => values.includes(normalize(cv)))
      return !values.includes(normalize(contextValue))
    }
    default:
      return false
  }
}

export async function GET() {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const supabase = createAdminClient()

  const HISTORY_WINDOW_DAYS = 90
  const MIN_SAMPLE = 3
  const windowStart = new Date(Date.now() - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: allBookings }, { data: unpaidPayments }, { count: violationCountRaw }, { data: lastReset }] =
    await Promise.all([
      supabase
        .from('bookings')
        .select('id, current_status, cancellation_type, created_at')
        .eq('user_id', user!.id)
        .neq('current_status', 'pending'),
      supabase
        .from('payments')
        .select('id')
        .eq('user_id', user!.id)
        .in('payment_status', ['pending', 'processing'])
        .limit(1),
      supabase
        .from('restriction_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .in('action', ['auto_restricted', 'manually_restricted']),
      supabase
        .from('restriction_logs')
        .select('created_at')
        .eq('user_id', user!.id)
        .in('action', ['score_reset', 'score_reset_bulk'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  // If the user had an approved reset, only count cancellations that happened after it
  const resetAt = lastReset ? (lastReset as { created_at: string }).created_at : null
  const effectiveWindowStart = resetAt && resetAt > windowStart ? resetAt : windowStart

  const totalBookings = (allBookings ?? []).length
  const recent = (allBookings ?? []).filter((b: any) => b.created_at >= effectiveWindowStart)
  const recentCancelled = recent.filter(
    (b: any) =>
      (b.current_status === 'cancelled' || b.current_status === 'auto_declined') &&
      b.cancellation_type !== 'admin_cancelled'
  ).length
  const cancellationRate =
    recent.length >= MIN_SAMPLE ? recentCancelled / recent.length : 0
  // Internal users are exempt from the unpaid balance penalty (mirrors softScoringEngine)
  const hasUnpaidBalance = user!.user_type !== 'internal' && (unpaidPayments?.length ?? 0) > 0
  const violationCount = violationCountRaw ?? 0

  const roleNames = (user!.roles ?? []).map((r: { name: string }) => r.name)

  const profileCtx: Record<string, unknown> = {
    user_type: user!.user_type,
    user_role: roleNames,
    booking_count: totalBookings,
    cancellation_rate: cancellationRate,
    violation_count: violationCount,
    has_unpaid_balance: String(hasUnpaidBalance),
  }

  // Load soft rules (shared cache with scoring engine)
  const SOFT_RULES_KEY = 'booking:soft_rules'
  let rules: SoftRule[] | null = cacheGet<SoftRule[]>(SOFT_RULES_KEY) ?? null
  if (!rules) {
    const { data, error: rulesErr } = await supabase
      .from('approval_constraint_rules')
      .select('code, name, point_value, condition_field, condition_operator, condition_value')
      .eq('constraint_type', 'soft')
      .eq('is_active', true)
      .order('priority', { ascending: true })
    if (rulesErr) return NextResponse.json({ error: rulesErr.message }, { status: 500 })
    rules = data ?? []
    cacheSet(SOFT_RULES_KEY, rules, TTL_24H)
  }

  const factors: Array<{ code: string; label: string; points: number; type: 'positive' | 'negative' }> = []

  for (const rule of rules) {
    if (!PROFILE_FIELDS.has(rule.condition_field) || !rule.condition_operator) continue
    const ctxVal = profileCtx[rule.condition_field]
    if (ctxVal === undefined || ctxVal === null) continue
    if (evalCondition(rule.condition_operator, rule.condition_value, ctxVal)) {
      factors.push({
        code: rule.code,
        label: rule.name,
        points: rule.point_value,
        type: rule.point_value >= 0 ? 'positive' : 'negative',
      })
    }
  }

  const adjustment = factors.reduce((sum, f) => sum + f.points, 0)
  const baselineScore = Math.max(0, Math.min(100, BASE_SCORE + adjustment))

  const likelihood: 'high' | 'moderate' | 'low' =
    baselineScore >= SCORING_THRESHOLDS.AUTO_APPROVE
      ? 'high'
      : baselineScore >= 60
        ? 'moderate'
        : 'low'

  return NextResponse.json({ baselineScore, threshold: SCORING_THRESHOLDS.AUTO_APPROVE, likelihood, factors })
}
