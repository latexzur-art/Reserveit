import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/response'
import { getErrorMessage } from '@/lib/errors'
import { QrCodeService } from '@/backend/payments/qrCodeService'

export async function GET() {
  const { error: authError } = await requireAuthenticatedUser()
  if (authError) return authError

  try {
    const qrCodes = await QrCodeService.listActive()

    const supabase = createAdminClient()
    const { data } = await supabase.from('system_settings').select('key, value').in('key', ['payment_helpdesk_contact'])
    const helpdeskContact = (data ?? []).find((r: { key: string }) => r.key === 'payment_helpdesk_contact')?.value ?? ''

    return NextResponse.json({ qrCodes, helpdeskContact })
  } catch (err) {
    return apiError(500, getErrorMessage(err))
  }
}
