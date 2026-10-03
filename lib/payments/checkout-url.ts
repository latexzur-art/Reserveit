/**
 * Guard for externally-supplied checkout URLs before assigning them to
 * window.location. Prevents open-redirects if an API response is ever
 * attacker-influenced: only PayMongo-hosted HTTPS checkout pages pass.
 */
const TRUSTED_CHECKOUT_HOSTS = ['paymongo.com', 'checkout.paymongo.com', 'links.paymongo.com']

export function isTrustedCheckoutUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  return TRUSTED_CHECKOUT_HOSTS.some(
    host => url.hostname === host || url.hostname.endsWith(`.${host}`),
  )
}
