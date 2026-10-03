import { NextRequest, NextResponse } from 'next/server'
import { requireUserManager } from '@/lib/auth/guards'
import { AdminSettingsService } from '@/backend/admin'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireUserManager()
  if (error) return error

  try {
    const { id } = await params
    const result = await AdminSettingsService.getRoleWithUsers(id)
    return NextResponse.json({ users: result.users, total: result.users.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
