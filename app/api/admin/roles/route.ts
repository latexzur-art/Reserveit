import { NextRequest, NextResponse } from 'next/server'
import { requireUserManager } from '@/lib/auth/guards'
import { AdminUsersService, AdminSettingsService, AdminAuditService } from '@/backend/admin'

export async function GET() {
  const { error } = await requireUserManager()
  if (error) return error

  try {
    const dbRoles = await AdminUsersService.getRoles()
    const roles = (dbRoles || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      displayName: r.display_name || r.name,
      badgeColor: r.badge_color || 'gray',
      isInternalOnly: r.is_internal_only ?? true,
    }))
    return NextResponse.json({ roles })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireUserManager()
  if (error) return error

  try {
    const body = await request.json()
    const { name, displayName, description, badgeColor, isInternalOnly, permissions } = body

    if (!name || !displayName) {
      return NextResponse.json({ error: 'Name and display name are required' }, { status: 400 })
    }

    const result = await AdminSettingsService.createRole({
      name,
      displayName,
      description: description || '',
      badgeColor: badgeColor || 'gray',
      isInternalOnly: isInternalOnly ?? true,
      permissions: permissions || {},
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    await AdminAuditService.log({
      actorId: user.id,
      action: 'role.create',
      targetType: 'role',
      targetId: result.roleId,
      details: { name, displayName },
    })

    return NextResponse.json({ success: true, roleId: result.roleId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
