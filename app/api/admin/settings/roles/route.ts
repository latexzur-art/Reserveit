import { NextResponse } from 'next/server'
import { requireUserManager } from '@/lib/auth/guards'
import { AdminSettingsService } from '@/backend/admin'

export async function GET() {
  const { error } = await requireUserManager()
  if (error) return error

  try {
    const roles = await AdminSettingsService.getRolesWithCounts()
    return NextResponse.json({ roles })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
