import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/response'
import { getErrorMessage } from '@/lib/errors'
import { QrCodeService } from '@/backend/payments/qrCodeService'

const MAX_QR_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const BUCKET = 'payment-qr-codes'

/**
 * Verifies the file's actual leading bytes against known image-format
 * signatures ("magic bytes"). The client-supplied `file.type` is just the
 * multipart Content-Type header, which the browser/attacker sets and is
 * trivially spoofable (e.g. rename malware.exe, declare image/png) — this
 * inspects real content instead of trusting that header.
 */
function hasValidImageSignature(bytes: Buffer): boolean {
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  const isWebp =
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  return isJpeg || isPng || isWebp
}

const MIN_QR_DIMENSION = 200

function getImageDimensions(bytes: Buffer): { width: number; height: number } | null {
  // PNG: width at bytes 16-19, height at bytes 20-23 (big-endian u32)
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
  }
  // JPEG: scan for SOF marker (FF C0-C3), dimensions at offset+5 (height) and offset+7 (width)
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2
    while (i < bytes.length - 9) {
      if (bytes[i] !== 0xff) { i++; continue }
      const marker = bytes[i + 1]
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { width: bytes.readUInt16BE(i + 7), height: bytes.readUInt16BE(i + 5) }
      }
      if (marker === 0xd9) break // end of image
      const segLen = bytes.readUInt16BE(i + 2)
      if (segLen === 0) break // malformed JPEG
      i += 2 + segLen
    }
  }
  // WebP: RIFF....WEBP, VP8 chunk at offset 26 has width-1/height-1 as little-endian u14
  if (bytes.length >= 32 && bytes[0] === 0x52 && bytes[8] === 0x57) {
    return { width: (bytes.readUInt16LE(26) & 0x3fff) + 1, height: (bytes.readUInt16LE(28) & 0x3fff) + 1 }
  }
  return null
}

export async function GET() {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const qrCodes = await QrCodeService.listAll()
    return NextResponse.json({ qrCodes })
  } catch (err) {
    return apiError(500, getErrorMessage(err))
  }
}

export async function POST(request: NextRequest) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  let form: FormData
  try { form = await request.formData() } catch { return apiError(400, 'Expected multipart form data') }

  const label = form.get('label')
  const file = form.get('file')
  const accountName = form.get('account_name')
  const accountNumber = form.get('account_number')
  const category = form.get('category')
  if (typeof label !== 'string' || !label.trim()) return apiError(400, 'label is required')
  if (!(file instanceof File)) return apiError(400, 'file is required')
  if (file.size === 0) return apiError(400, 'file is empty')
  if (file.size > MAX_QR_BYTES) return apiError(400, 'QR image must be 5MB or smaller')
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) return apiError(400, 'QR image must be a JPEG, PNG, or WebP image')

  const supabase = createAdminClient()

  try {
    const { data: buckets } = await supabase.storage.listBuckets()
    if (!buckets?.some((b: { name: string }) => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_QR_BYTES, allowedMimeTypes: Object.keys(ALLOWED_TYPES) })
    }

    const path = `${user.id}/${Date.now()}.${ext}`
    const bytes = Buffer.from(await file.arrayBuffer())
    if (!hasValidImageSignature(bytes)) return apiError(400, 'File content does not match a valid image format')
    const dims = getImageDimensions(bytes)
    if (dims && (dims.width < MIN_QR_DIMENSION || dims.height < MIN_QR_DIMENSION)) {
      return apiError(400, `QR image must be at least ${MIN_QR_DIMENSION}x${MIN_QR_DIMENSION} pixels`)
    }
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: true })
    if (uploadError) throw uploadError

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)

    const qrCode = await QrCodeService.create({
      label: label.trim(),
      imageUrl: pub.publicUrl,
      uploadedBy: user.id,
      accountName: typeof accountName === 'string' ? accountName.trim() : undefined,
      accountNumber: typeof accountNumber === 'string' ? accountNumber.trim() : undefined,
      category: typeof category === 'string' && category.trim() ? category.trim() : 'other',
    })
    return NextResponse.json({ qrCode }, { status: 201 })
  } catch (err) {
    console.error('[API] POST /admin/building/payment-qr-codes error:', err)
    return apiError(500, getErrorMessage(err))
  }
}
