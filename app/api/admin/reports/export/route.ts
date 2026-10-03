import { NextRequest, NextResponse } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { AdminReportsService } from '@/backend/admin/admin-reports.service'

export async function GET(req: NextRequest) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { searchParams } = new URL(req.url)
    const reportType = searchParams.get('type') as 'distribution' | 'metrics'

    if (!reportType || !['distribution', 'metrics'].includes(reportType)) {
      return NextResponse.json(
        { error: 'Invalid report type. Must be "distribution" or "metrics"' },
        { status: 400 }
      )
    }

    const csv = await AdminReportsService.exportReportData(reportType)
    const filename = `${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('Error exporting report:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export report' },
      { status: 500 }
    )
  }
}
