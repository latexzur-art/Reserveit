import { describe, it, expect } from 'vitest'
import { isTrustedCheckoutUrl } from '@/lib/payments/checkout-url'

describe('isTrustedCheckoutUrl', () => {
  it('accepts PayMongo checkout URLs', () => {
    expect(isTrustedCheckoutUrl('https://checkout.paymongo.com/cs_abc123')).toBe(true)
    expect(isTrustedCheckoutUrl('https://links.paymongo.com/link/abc')).toBe(true)
    expect(isTrustedCheckoutUrl('https://test.paymongo.com/x')).toBe(true)
  })

  it('rejects non-https, other hosts, lookalikes, and garbage', () => {
    expect(isTrustedCheckoutUrl('http://checkout.paymongo.com/cs_abc')).toBe(false)
    expect(isTrustedCheckoutUrl('https://evil.com/paymongo.com')).toBe(false)
    expect(isTrustedCheckoutUrl('https://paymongo.com.evil.com/x')).toBe(false)
    expect(isTrustedCheckoutUrl('javascript:alert(1)')).toBe(false)
    expect(isTrustedCheckoutUrl('not a url')).toBe(false)
    expect(isTrustedCheckoutUrl(undefined)).toBe(false)
    expect(isTrustedCheckoutUrl(null)).toBe(false)
  })
})
