import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/response'

const MODE_KEY = 'payment_method_mode'
const HELPDESK_KEY = 'payment_helpdesk_contact'
const VALID_MODES = ['paymongo', 'qr_after_approval', 'qr_at_submission']

export async function GET() {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  const supabase = createAdminClient()
  const { data } = await supabase.from('system_settings').select('key, value').in('key', [MODE_KEY, HELPDESK_KEY])
  const byKey = new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]))

  return NextResponse.json({
    payment_method_mode: byKey.get(MODE_KEY) ?? 'paymongo',
    payment_helpdesk_contact: byKey.get(HELPDESK_KEY) ?? '',
  })
}

export async function PATCH(request: NextRequest) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return apiError(400, 'Invalid request body')

  const supabase = createAdminClient()

  if ('payment_method_mode' in body) {
    if (!VALID_MODES.includes(body.payment_method_mode)) {
      return apiError(400, `payment_method_mode must be one of: ${VALID_MODES.join(', ')}`)
    }
    const { error } = await supabase.from('system_settings').upsert({
      key: MODE_KEY, value: body.payment_method_mode, category: 'payments',
      description: 'Active payment method: paymongo, qr_after_approval, or qr_at_submission', updated_by: user.id,
    }, { onConflict: 'key' })
    if (error) return apiError(500, error.message)
  }

  if ('payment_helpdesk_contact' in body) {
    if (typeof body.payment_helpdesk_contact !== 'string') return apiError(400, 'payment_helpdesk_contact must be a string')
    const { error } = await supabase.from('system_settings').upsert({
      key: HELPDESK_KEY, value: body.payment_helpdesk_contact, category: 'payments',
      description: 'Contact info shown to renters for refund/payment questions', updated_by: user.id,
    }, { onConflict: 'key' })
    if (error) return apiError(500, error.message)
  }

  return NextResponse.json({ success: true })
}
