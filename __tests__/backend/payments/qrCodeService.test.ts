import { describe, it, expect } from 'vitest'
import { extractStoragePath } from '@/backend/payments/qrCodeService'

describe('extractStoragePath', () => {
  it('extracts path from a valid Supabase public URL', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/public/payment-qr-codes/user123/1692000000.png'
    expect(extractStoragePath(url, 'payment-qr-codes')).toBe('user123/1692000000.png')
  })

  it('returns null for URL with different bucket name', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/public/other-bucket/user123/file.png'
    expect(extractStoragePath(url, 'payment-qr-codes')).toBeNull()
  })

  it('returns null for invalid URL', () => {
    expect(extractStoragePath('not-a-url', 'payment-qr-codes')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractStoragePath('', 'payment-qr-codes')).toBeNull()
  })

  it('handles URL with nested path', () => {
    const url = 'https://xyz.supabase.co/storage/v1/object/public/payment-qr-codes/abc-123/subfolder/file.webp'
    expect(extractStoragePath(url, 'payment-qr-codes')).toBe('abc-123/subfolder/file.webp')
  })
})
