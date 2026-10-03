import { NextRequest, NextResponse } from 'next/server'
import { requireUserManager } from '@/lib/auth/guards'
import { AdminSettingsService, AdminAuditService } from '@/backend/admin'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireUserManager()
  if (error) return error

  try {
    const { id } = await params
    const result = await AdminSettingsService.getRoleWithUsers(id)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, user } = await requireUserManager()
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()

    const result = await AdminSettingsService.updateRole(id, body)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    await AdminAuditService.log({
      actorId: user.id,
      action: 'role.update',
      targetType: 'role',
      targetId: id,
      details: { updatedFields: Object.keys(body) },
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, user } = await requireUserManager()
  if (error) return error

  try {
    const { id } = await params
    const result = await AdminSettingsService.deactivateRole(id)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    await AdminAuditService.log({
      actorId: user.id,
      action: 'role.deactivate',
      targetType: 'role',
      targetId: id,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
