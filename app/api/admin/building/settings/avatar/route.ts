import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/response'
import { getErrorMessage } from '@/lib/errors'

const MAX_AVATAR_BYTES = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const BUCKET = 'avatars'

export async function POST(request: NextRequest) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return apiError(400, 'Expected multipart form data')
  }

  const file = form.get('file')
  if (!(file instanceof File)) return apiError(400, 'file is required')
  if (file.size === 0) return apiError(400, 'file is empty')
  if (file.size > MAX_AVATAR_BYTES) return apiError(400, 'Avatar must be 2MB or smaller')

  const ext = ALLOWED_TYPES[file.type]
  if (!ext) return apiError(400, 'Avatar must be a JPEG, PNG, or WebP image')

  const supabase = createAdminClient()

  try {
    // Idempotent: create the public avatars bucket on first use
    const { data: buckets } = await supabase.storage.listBuckets()
    if (!buckets?.some(b => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_AVATAR_BYTES,
        allowedMimeTypes: Object.keys(ALLOWED_TYPES),
      })
    }

    const path = `${user.id}/avatar-${Date.now()}.${ext}`
    const bytes = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: true })
    if (uploadError) throw uploadError

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const avatarUrl = pub.publicUrl

    const { error: updateError } = await supabase
      .from('users')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    if (updateError) throw updateError

    return NextResponse.json({ success: true, avatarUrl })
  } catch (err) {
    console.error('[API] POST /admin/building/settings/avatar error:', err)
    return apiError(500, getErrorMessage(err))
  }
}
