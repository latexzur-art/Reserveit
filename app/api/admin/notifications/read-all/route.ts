import { NextResponse } from 'next/server'
import { requireUserManager } from '@/lib/auth/guards'
import { AdminMessagingService } from '@/backend/admin'

export async function POST() {
  const { error, user } = await requireUserManager()
  if (error) return error

  try {
    const result = await AdminMessagingService.markAllNotificationsRead(user.id)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
