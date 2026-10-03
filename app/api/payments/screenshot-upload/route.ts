import { NextResponse, type NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/response'
import { getErrorMessage } from '@/lib/errors'

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const BUCKET = 'payment-screenshots'
// Signed URL validity: long enough to cover a Building Admin's QR-proof review
// window (submission -> approve/reject), short enough that a leaked link doesn't
// stay live indefinitely for a private bucket.
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 24 * 7 // 7 days

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

export async function POST(request: NextRequest) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  let form: FormData
  try { form = await request.formData() } catch { return apiError(400, 'Expected multipart form data') }

  const file = form.get('file')
  if (!(file instanceof File)) return apiError(400, 'file is required')
  if (file.size === 0) return apiError(400, 'file is empty')
  if (file.size > MAX_SCREENSHOT_BYTES) return apiError(400, 'Screenshot must be 5MB or smaller')
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) return apiError(400, 'Screenshot must be a JPEG, PNG, or WebP image')

  const supabase = createAdminClient()

  try {
    const { data: buckets } = await supabase.storage.listBuckets()
    if (!buckets?.some((b: { name: string }) => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: MAX_SCREENSHOT_BYTES,
        allowedMimeTypes: Object.keys(ALLOWED_TYPES),
      })
    }

    const path = `${user.id}/${Date.now()}.${ext}`
    const bytes = Buffer.from(await file.arrayBuffer())
    if (!hasValidImageSignature(bytes)) return apiError(400, 'File content does not match a valid image format')
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: true })
    if (uploadError) throw uploadError

    const { data: signed, error: signError } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS)
    if (signError || !signed) throw signError ?? new Error('Failed to create signed URL')

    return NextResponse.json({ url: signed.signedUrl }, { status: 201 })
  } catch (err) {
    console.error('[API] POST /payments/screenshot-upload error:', err)
    return apiError(500, getErrorMessage(err))
  }
}
