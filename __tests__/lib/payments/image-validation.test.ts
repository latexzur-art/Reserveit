import { describe, it, expect } from 'vitest'
import { validateImageFileSize, checkQrDimensions } from '@/lib/payments/image-validation'

describe('validateImageFileSize', () => {
  it('accepts files under 20MB', () => {
    const file = new File([new ArrayBuffer(1024)], 'test.jpg', { type: 'image/jpeg' })
    expect(validateImageFileSize(file)).toBeNull()
  })

  it('rejects files over 20MB', () => {
    const file = new File([new ArrayBuffer(21 * 1024 * 1024)], 'huge.jpg', { type: 'image/jpeg' })
    expect(validateImageFileSize(file)).toBe('Image is too large (max 20MB)')
  })

  it('accepts files exactly at 20MB', () => {
    const file = new File([new ArrayBuffer(20 * 1024 * 1024)], 'exact.jpg', { type: 'image/jpeg' })
    expect(validateImageFileSize(file)).toBeNull()
  })

  it('accepts small files', () => {
    const file = new File([new ArrayBuffer(100)], 'tiny.png', { type: 'image/png' })
    expect(validateImageFileSize(file)).toBeNull()
  })
})

describe('checkQrDimensions', () => {
  it('rejects images smaller than 200x200', () => {
    expect(checkQrDimensions(1, 1)).toBe('QR image must be at least 200x200 pixels')
  })

  it('rejects images with width below 200', () => {
    expect(checkQrDimensions(199, 300)).toBe('QR image must be at least 200x200 pixels')
  })

  it('rejects images with height below 200', () => {
    expect(checkQrDimensions(300, 50)).toBe('QR image must be at least 200x200 pixels')
  })

  it('accepts images at exactly 200x200', () => {
    expect(checkQrDimensions(200, 200)).toBeNull()
  })

  it('accepts large QR code images', () => {
    expect(checkQrDimensions(2000, 2000)).toBeNull()
  })

  it('accepts non-square images above minimum', () => {
    expect(checkQrDimensions(800, 400)).toBeNull()
  })
})
