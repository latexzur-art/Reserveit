// RATES: Hardcoded constants remain as fallbacks when DB rates are not configured.
// Booking forms pass DB-fetched rates via the optional `rates` parameter.
const AM_RATE_PER_HOUR = 580   // ₱580/hr for 7:00 AM – 5:00 PM
const PM_RATE_PER_HOUR = 780   // ₱780/hr for 5:00 PM – 7:00 AM (including midnight hours)
const AM_START_HOUR = 7        // 7:00 AM
const PM_CUTOFF_HOUR = 17      // 5:00 PM

// Add-on fees — fallback when DB rates are not configured
const ADDON_SOUND_FEE = 1500   // Basic Sound System flat fee
const ADDON_LED_FEE   = 2500   // LED Lights flat fee

export interface CostLineItem {
  label: string
  hours: number
  rate: number
  subtotal: number
  isFlatFee?: boolean
}

export interface BookingAddons {
  sound?: boolean
  led?: boolean
  [key: string]: boolean | undefined
}

export interface RateConfig {
  amRatePerHour?: number
  pmRatePerHour?: number
  pmCutoffHour?: number
  addonSoundFee?: number
  addonLedFee?: number
}

export function computeBookingAmount(
  startTime: string,
  endTime: string,
  addons?: BookingAddons,
  rates?: RateConfig
): { amount: number; breakdown: CostLineItem[] } {
  const amRate = rates?.amRatePerHour ?? AM_RATE_PER_HOUR
  const pmRate = rates?.pmRatePerHour ?? PM_RATE_PER_HOUR
  const pmCutoff = rates?.pmCutoffHour ?? PM_CUTOFF_HOUR
  const soundFee = rates?.addonSoundFee ?? ADDON_SOUND_FEE
  const ledFee = rates?.addonLedFee ?? ADDON_LED_FEE

  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const startDecimal = sh + sm / 60
  // If end <= start the booking crosses midnight — add 24 hours to end
  let endDecimal = eh + em / 60
  if (endDecimal <= startDecimal) endDecimal += 24

  // AM window: AM_START_HOUR–pmCutoff; PM window: everything outside AM
  let amHours = 0
  amHours += Math.max(0, Math.min(endDecimal, pmCutoff) - Math.max(startDecimal, AM_START_HOUR))
  amHours += Math.max(0, Math.min(endDecimal, 24 + pmCutoff) - Math.max(startDecimal, 24 + AM_START_HOUR))
  const pmHours = (endDecimal - startDecimal) - amHours

  const breakdown: CostLineItem[] = []

  if (amHours > 0)
    breakdown.push({ label: 'AM Rental', hours: amHours, rate: amRate, subtotal: amHours * amRate })
  if (pmHours > 0)
    breakdown.push({ label: 'PM Rental', hours: pmHours, rate: pmRate, subtotal: pmHours * pmRate })

  if (addons?.sound)
    breakdown.push({ label: 'Basic Sound System', hours: 1, rate: soundFee, subtotal: soundFee, isFlatFee: true })
  if (addons?.led)
    breakdown.push({ label: 'LED Lights', hours: 1, rate: ledFee, subtotal: ledFee, isFlatFee: true })

  const amount = breakdown.reduce((sum, row) => sum + row.subtotal, 0)
  return { amount: amount > 0 ? amount : 200, breakdown }
}
