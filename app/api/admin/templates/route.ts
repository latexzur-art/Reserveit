import { NextResponse } from 'next/server'
import { requireUserManager } from '@/lib/auth/guards'
import { AdminMessagingService } from '@/backend/admin'

export async function GET() {
  const { error } = await requireUserManager()
  if (error) return error

  try {
    const templates = await AdminMessagingService.getTemplates()
    return NextResponse.json({ templates })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
