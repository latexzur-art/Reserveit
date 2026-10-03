import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingPricingService } from '@/backend/admin/building'
import { createAdminClient } from '@/lib/supabase/server'
import { getErrorMessage } from '@/lib/errors'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { id } = await params
    const { isAvailableForRental } = await request.json()
    if (typeof isAvailableForRental !== 'boolean') {
      return NextResponse.json({ error: 'isAvailableForRental must be a boolean' }, { status: 400 })
    }

    // Guard: when enabling rental, ensure the facility has active base rates
    if (isAvailableForRental) {
      const supabase = createAdminClient()
      const { data: rates } = await supabase
        .from('rental_rates')
        .select('id')
        .eq('facility_id', id)
        .eq('is_active', true)
        .eq('is_addon', false)
        .limit(1)

      if (!rates?.length) {
        // Check for inactive rates that could be reactivated
        const { data: inactiveRates } = await supabase
          .from('rental_rates')
          .select('id, rate_name')
          .eq('facility_id', id)
          .eq('is_active', false)
          .eq('is_addon', false)

        if (inactiveRates?.length) {
          return NextResponse.json({
            error: 'inactive_rates_exist',
            message: `This facility has ${inactiveRates.length} inactive rate(s). Reactivate them first or create new ones.`,
            inactive_rates: inactiveRates,
          }, { status: 400 })
        }

        return NextResponse.json({
          error: 'no_rates_configured',
          message: 'This facility has no rental rates. Add AM/PM rates first.',
        }, { status: 400 })
      }
    }

    await BuildingPricingService.toggleFacilityRental(id, isAvailableForRental)
    return NextResponse.json({ success: true, isAvailableForRental })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
