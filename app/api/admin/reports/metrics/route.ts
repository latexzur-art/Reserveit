import { NextRequest, NextResponse } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { AdminReportsService } from '@/backend/admin/admin-reports.service'

export async function GET(req: NextRequest) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const data = await AdminReportsService.getKeyMetrics()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error fetching metrics data:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch metrics data' },
      { status: 500 }
    )
  }
}
