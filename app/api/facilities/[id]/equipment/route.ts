import { NextResponse, type NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { EquipmentIssueReportsService } from '@/backend/equipment/issue-reports.service'
import { getErrorMessage } from '@/lib/errors'
import { parseUuidParam } from '@/lib/api/validate-uuid'

/**
 * GET /api/facilities/[id]/equipment
 * Read-only list of the equipment assigned to a facility, for the professor
 * "Report equipment issue" dialog's item picker. Any authenticated user may
 * read it; picking an item lets the report route to the correct office.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError } = await requireAuthenticatedUser()
  if (authError) return authError

  try {
    const { id: rawId } = await params
    const parsed = parseUuidParam(rawId, 'facility id')
    if (!parsed.ok) return parsed.response
    const equipment = await EquipmentIssueReportsService.listEquipmentForFacility(parsed.value)
    return NextResponse.json({ equipment })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
