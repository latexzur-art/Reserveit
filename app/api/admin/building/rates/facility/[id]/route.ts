import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingPricingService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { id } = await params
    // Return the full FacilityRates shape so the admin UI can render AM/PM/addons/rawRates
    const rawRates = await BuildingPricingService.getByFacility(id)
    const amRateRow = rawRates.find(r => !r.isAddon && r.timePeriod === 'am')
    const pmRateRow = rawRates.find(r => !r.isAddon && r.timePeriod === 'pm')
    const amCutoffHour = amRateRow?.applicableEndTime
      ? parseInt(amRateRow.applicableEndTime.split(':')[0], 10)
      : 17
    const facilityRates = {
      facilityId: id,
      facilityName: rawRates[0]?.facilityName ?? '',
      amRate: amRateRow?.amount ?? null,
      pmRate: pmRateRow?.amount ?? null,
      amCutoffHour,
      addons: rawRates.filter(r => r.isAddon).map(r => ({ id: r.id, name: r.rateName, amount: r.amount, isAddon: true as const })),
      rawRates,
    }
    return NextResponse.json(facilityRates)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
