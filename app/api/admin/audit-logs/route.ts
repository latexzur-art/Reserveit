import { NextResponse } from 'next/server'
import { requireUserManager } from '@/lib/auth/guards'
import { AdminAuditService } from '@/backend/admin'

export async function GET(request: Request) {
  const { error } = await requireUserManager()
  if (error) return error

  try {
    const searchParams = new URL(request.url).searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const action = searchParams.get('action') || undefined
    const targetType = searchParams.get('targetType') || undefined

    const { logs, total } = await AdminAuditService.getAuditLogs({
      page,
      pageSize,
      action,
      targetType,
    })

    return NextResponse.json({ logs, total })
  } catch (err: any) {
    console.error('[API] GET /admin/audit-logs error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
