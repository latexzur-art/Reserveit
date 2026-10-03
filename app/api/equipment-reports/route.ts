import { NextResponse, type NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { EquipmentIssueReportsService } from '@/backend/equipment/issue-reports.service'
import { getErrorMessage } from '@/lib/errors'

const rolesOf = (user: any): string[] => (user?.roles ?? []).map((r: any) => r.name)

export async function GET() {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  try {
    const reports = await EquipmentIssueReportsService.list({
      userId: user!.id,
      roles: rolesOf(user),
    })
    return NextResponse.json({ reports })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  try {
    const body = await request.json()
    if (!body?.category || !body?.description) {
      return NextResponse.json({ error: 'category and description are required' }, { status: 400 })
    }
    const report = await EquipmentIssueReportsService.create({
      equipmentId: body.equipmentId ?? null,
      facilityId: body.facilityId ?? null,
      category: body.category,
      description: body.description,
      reportedByUserId: user!.id,
    })
    return NextResponse.json(report, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
