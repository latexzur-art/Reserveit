import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingFacilityEnhancementService } from '@/backend/admin/building'
import { apiError, apiUnexpectedError } from '@/lib/api/response'

const SEVERITIES = ['info', 'warning', 'critical']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { id } = await params
    const body = await request.json()

    if (!body.message || typeof body.message !== 'string') {
      return apiError(400, 'message is required')
    }
    if (body.severity && !SEVERITIES.includes(body.severity)) {
      return apiError(400, 'severity must be one of: info, warning, critical')
    }

    const warning = await BuildingFacilityEnhancementService.createWarning({
      facilityId: id,
      severity: body.severity,
      message: body.message,
      createdBy: user.id,
    })

    return NextResponse.json(warning, { status: 201 })
  } catch (err) {
    return apiUnexpectedError('POST /api/admin/building/facilities/[id]/warnings', err)
  }
}
