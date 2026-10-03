import { NextResponse } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { apiUnexpectedError } from '@/lib/api/response'
import { AdminAuditService } from '@/backend/admin'

export async function GET() {
  const { error, user } = await requireBuildingAdminStrict()
  if (error) return error

  try {
    const supabase = createAdminClient()
    const { data, error: rpcError } = await supabase.rpc('admin_export_data')
    
    if (rpcError) throw new Error(rpcError.message)

    await AdminAuditService.log({
      actorId: user.id,
      action: 'data.export',
      targetType: 'database',
      details: { format: 'json' },
    })

    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="reserveit-backup-${new Date().toISOString().split('T')[0]}.json"`,
      },
    })
  } catch (err) {
    return apiUnexpectedError('GET /api/admin/building/data-wipe/backup', err)
  }
}
