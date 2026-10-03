import { NextResponse } from 'next/server'
import { requirePamo } from '@/lib/auth/guards'
import { EquipmentIssueReportsService } from '@/backend/equipment/issue-reports.service'
import { getErrorMessage } from '@/lib/errors'

/** Escalation summary for the PAMO overview: { open, latest } for non-tech escalated reports. */
export async function GET() {
  const { error: authError } = await requirePamo()
  if (authError) return authError

  try {
    const summary = await EquipmentIssueReportsService.pamoEscalationSummary()
    return NextResponse.json(summary)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
