import { NextResponse } from 'next/server'
import { requireUserManager } from '@/lib/auth/guards'
import { AdminUsersService } from '@/backend/admin'

export async function GET() {
  const { error } = await requireUserManager()
  if (error) return error

  try {
    const departments = await AdminUsersService.getDepartments()
    return NextResponse.json({ departments })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
