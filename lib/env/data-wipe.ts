/**
 * Environment gate for the destructive data-wipe tooling.
 *
 * The wipe endpoints are testing/reset tools. We protect real data by
 * blocking them whenever the app is pointed at the PRODUCTION Supabase
 * project. We deliberately key off the Supabase project ref rather than
 * NODE_ENV / VERCEL_ENV, because the dev Vercel deployment also reports
 * VERCEL_ENV='production' — the database the app talks to is what actually
 * needs protecting.
 *
 * Set ALLOW_DATA_WIPE=true to deliberately override (e.g. a one-off cleanup
 * against prod). Leave it unset everywhere except where you truly need it.
 */

// ReserveIT production Supabase project ref — never wiped without an explicit override.
const PROD_SUPABASE_REF = 'aascxdiyetopvrxifape'

export type DataWipeGate = { allowed: true } | { allowed: false; reason: string }

export function checkDataWipeAllowed(): DataWipeGate {
  if (process.env.ALLOW_DATA_WIPE === 'true') return { allowed: true }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  if (url.includes(PROD_SUPABASE_REF)) {
    return {
      allowed: false,
      reason:
        'Data wipe is disabled because the app is connected to the production database. ' +
        'Set ALLOW_DATA_WIPE=true only if you intend to wipe production.',
    }
  }

  return { allowed: true }
}
