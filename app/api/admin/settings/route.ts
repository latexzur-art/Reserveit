import { NextRequest, NextResponse } from 'next/server'
import { requireUserManager } from '@/lib/auth/guards'
import { AdminSettingsService, AdminAuditService } from '@/backend/admin'

export async function GET() {
  const { error } = await requireUserManager()
  if (error) return error

  try {
    const settings = await AdminSettingsService.getSettings()
    return NextResponse.json({ settings })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { error, user } = await requireUserManager()
  if (error) return error

  try {
    const body = await request.json()
    const { settings } = body

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'Invalid settings payload' }, { status: 400 })
    }

    const result = await AdminSettingsService.updateSettings(settings, user.id)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    await AdminAuditService.log({
      actorId: user.id,
      action: 'settings.update',
      targetType: 'system_settings',
      details: { changedKeys: Object.keys(settings) },
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
