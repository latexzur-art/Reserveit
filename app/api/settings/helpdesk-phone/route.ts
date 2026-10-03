import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
export async function GET() {
  const { error } = await requireAuthenticatedUser()
  if (error) return error

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['emergency_helpdesk_phone', 'emergency_helpdesk_email'])

  const map: Record<string, string> = {}
  for (const row of data ?? []) {
    // row.value from JSONB is already parsed by the client
    map[row.key] = typeof row.value === 'string' ? row.value : JSON.stringify(row.value)
  }

  return NextResponse.json({
    helpdeskPhone: map['emergency_helpdesk_phone'] ?? '(043) 123-4567',
    helpdeskEmail: map['emergency_helpdesk_email'] ?? 'helpdesk@sti-lucena.edu.ph',
  })
}
