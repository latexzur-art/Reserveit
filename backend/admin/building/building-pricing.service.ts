import { createAdminClient } from '@/lib/supabase/server'
import { type RateConfig } from '@/backend/booking/computeBookingAmount'
import {
  type RentalRate,
  type FacilityRates,
  type RentalRateFilters,
  type CreateRateInput,
  dbRentalRateToView,
} from './building.types'

export const BuildingPricingService = {
  async getAll(filters?: RentalRateFilters): Promise<{ rates: RentalRate[]; total: number }> {
    const supabase = createAdminClient()

    let query = supabase
      .from('rental_rates')
      .select('*, facilities(id, name)', { count: 'exact' })
      .order('facility_id')
      .order('sort_order')
      .order('created_at')

    if (filters?.facilityId) query = query.eq('facility_id', filters.facilityId)
    if (filters?.isAddon !== undefined) query = query.eq('is_addon', filters.isAddon)
    if (filters?.isActive !== undefined) query = query.eq('is_active', filters.isActive)
    if (filters?.feeCategory) query = query.eq('fee_category', filters.feeCategory)

    const { data, error, count } = await query

    if (error) throw new Error(error.message)

    const rates = (data ?? []).map(row =>
      dbRentalRateToView(row, row.facilities?.name)
    )
    return { rates, total: count ?? rates.length }
  },

  async getByFacility(facilityId: string): Promise<RentalRate[]> {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('rental_rates')
      .select('*, facilities(id, name)')
      .eq('facility_id', facilityId)
      .eq('is_active', true)
      .order('sort_order')
      .order('created_at')

    if (error) throw new Error(error.message)

    return (data ?? []).map(row => dbRentalRateToView(row, row.facilities?.name))
  },

  async create(data: CreateRateInput): Promise<RentalRate> {
    const supabase = createAdminClient()

    // Both times must be provided together (DB check constraint)
    const hasStart = !!data.applicableStartTime
    const hasEnd = !!data.applicableEndTime
    const startTime = (hasStart && hasEnd) ? data.applicableStartTime! : null
    const endTime = (hasStart && hasEnd) ? data.applicableEndTime! : null

    const { data: row, error } = await supabase
      .from('rental_rates')
      .insert({
        facility_id: data.facilityId,
        fee_category: data.feeCategory,
        rate_name: data.rateName,
        rate_type: data.rateType,
        time_period: data.timePeriod,
        amount: data.amount,
        applicable_start_time: startTime,
        applicable_end_time: endTime,
        description: data.description ?? null,
        is_required: data.isRequired ?? false,
        is_addon: data.isAddon ?? false,
        sort_order: data.sortOrder ?? 0,
        is_active: true,
        effective_from: new Date().toISOString().split('T')[0],
      })
      .select('*, facilities(id, name)')
      .single()

    if (error) {
      if (error.code === '23505') throw new Error(`A rate named "${data.rateName}" already exists for this facility. Use a different name.`)
      if (error.code === '23514') throw new Error('Both start time and end time must be provided together, or leave both empty.')
      throw new Error(error.message)
    }
    return dbRentalRateToView(row, row.facilities?.name)
  },

  async update(id: string, updates: Partial<CreateRateInput>): Promise<RentalRate> {
    const supabase = createAdminClient()

    const patch: Record<string, unknown> = {}
    if (updates.facilityId !== undefined) patch.facility_id = updates.facilityId
    if (updates.feeCategory !== undefined) patch.fee_category = updates.feeCategory
    if (updates.rateName !== undefined) patch.rate_name = updates.rateName
    if (updates.rateType !== undefined) patch.rate_type = updates.rateType
    if (updates.timePeriod !== undefined) patch.time_period = updates.timePeriod
    if (updates.amount !== undefined) patch.amount = updates.amount
    if (updates.applicableStartTime !== undefined) patch.applicable_start_time = updates.applicableStartTime
    if (updates.applicableEndTime !== undefined) patch.applicable_end_time = updates.applicableEndTime
    if (updates.description !== undefined) patch.description = updates.description
    if (updates.isRequired !== undefined) patch.is_required = updates.isRequired
    if (updates.isAddon !== undefined) patch.is_addon = updates.isAddon
    if (updates.sortOrder !== undefined) patch.sort_order = updates.sortOrder

    const { data: row, error } = await supabase
      .from('rental_rates')
      .update(patch)
      .eq('id', id)
      .select('*, facilities(id, name)')
      .single()

    if (error) {
      if (error.code === '23505') throw new Error(`A rate with that name already exists for this facility. Use a different name.`)
      if (error.code === '23514') throw new Error('Invalid time range: end time must be after start time, and both times must be provided together.')
      throw new Error(error.message)
    }
    return dbRentalRateToView(row, row.facilities?.name)
  },

  async delete(id: string): Promise<void> {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('rental_rates')
      .update({ is_active: false })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  async toggleFacilityRental(facilityId: string, isAvailable: boolean): Promise<void> {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('facilities')
      .update({ is_available_for_rental: isAvailable })
      .eq('id', facilityId)
    if (error) throw new Error(error.message)
  },

  async getFacilityRatesPublic(facilityId: string): Promise<FacilityRates | null> {
    const supabase = createAdminClient()

    const { data: facility, error: fErr } = await supabase
      .from('facilities')
      .select('id, name, is_available_for_rental')
      .eq('id', facilityId)
      .single()

    if (fErr || !facility) return null

    const { data: rates, error: rErr } = await supabase
      .from('rental_rates')
      .select('*')
      .eq('facility_id', facilityId)
      .eq('is_active', true)
      .order('sort_order')

    if (rErr) return null

    const rateRows = rates ?? []

    const nonAddonRows = rateRows.filter(r => !r.is_addon)
    const allDayRow = nonAddonRows.find(r => r.time_period === 'all_day')

    // Primary: match by time_period label
    let amRow = nonAddonRows.find(r => r.time_period === 'am')
    let pmRow = nonAddonRows.find(r => r.time_period === 'pm')

    // Determine cutoff from AM row's end time, defaulting to 17
    let amCutoffHour = 17
    if (amRow?.applicable_end_time) {
      amCutoffHour = parseInt(amRow.applicable_end_time.split(':')[0], 10)
    }

    // Fallback: if no explicit PM row, detect by start time >= cutoff.
    // This handles cases where the admin saved a night/PM rate with time_period='am' by mistake.
    if (!pmRow) {
      const pmByWindow = nonAddonRows.find(r =>
        r.id !== amRow?.id &&
        r.applicable_start_time &&
        parseInt(r.applicable_start_time.split(':')[0], 10) >= amCutoffHour
      )
      if (pmByWindow) pmRow = pmByWindow
    }

    let amRate: number | null = null
    let pmRate: number | null = null

    if (amRow) amRate = Number(amRow.amount)
    if (pmRow) pmRate = Number(pmRow.amount)
    if (allDayRow && !amRow && !pmRow) {
      amRate = Number(allDayRow.amount)
      pmRate = Number(allDayRow.amount)
    }

    const addons = rateRows
      .filter(r => r.is_addon)
      .map(r => ({
        id: r.id as string,
        name: r.rate_name as string,
        amount: Number(r.amount),
        isAddon: true as const,
      }))

    return {
      facilityId: facility.id,
      facilityName: facility.name,
      amRate,
      pmRate,
      amCutoffHour,
      addons,
      rawRates: rateRows.map(r => dbRentalRateToView(r, facility.name)),
    }
  },

  /**
   * Helper for backend processes to get RateConfig for computeBookingAmount
   */
  async getRateConfig(facilityId: string): Promise<RateConfig | undefined> {
    const rates = await this.getFacilityRatesPublic(facilityId)
    if (!rates) return undefined

    return {
      amRatePerHour: rates.amRate ?? undefined,
      pmRatePerHour: rates.pmRate ?? undefined,
      pmCutoffHour: rates.amCutoffHour,
      addonSoundFee: rates.addons.find(a => a.name.toLowerCase().includes('sound'))?.amount,
      addonLedFee: rates.addons.find(a => a.name.toLowerCase().includes('led'))?.amount,
    }
  },
}
