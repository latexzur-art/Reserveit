import { createAdminClient } from '@/lib/supabase/server'
import { computeBookingAmount, type CostLineItem, type RateConfig } from './computeBookingAmount'
import { BuildingPricingService } from '@/backend/admin/building/building-pricing.service'

export interface BookingPaymentCalculation {
  amount: number
  breakdown: CostLineItem[]
  rateConfig?: RateConfig
}

export const BookingPaymentService = {
  /**
   * Calculates the payment amount for a booking, automatically fetching the facility's rates.
   */
  async calculateAmount(
    booking: { 
      start_time: string; 
      end_time: string; 
      metadata?: any;
      booking_facilities?: any;
    }
  ): Promise<BookingPaymentCalculation> {
    const meta = (booking.metadata ?? {}) as Record<string, unknown>
    const addons = {
      sound: meta.addon_sound === true,
      led:   meta.addon_led   === true,
    }

    // Attempt to resolve facility_id
    let facilityId: string | null = null
    const facilityData = Array.isArray(booking.booking_facilities)
      ? booking.booking_facilities[0]
      : booking.booking_facilities

    if (facilityData) {
      facilityId = facilityData.facility_id || (typeof facilityData === 'string' ? facilityData : null)
    }

    const rateConfig = facilityId ? await BuildingPricingService.getRateConfig(facilityId) : undefined
    const { amount, breakdown } = computeBookingAmount(
      booking.start_time,
      booking.end_time,
      addons,
      rateConfig
    )

    return { amount, breakdown, rateConfig }
  }
}
