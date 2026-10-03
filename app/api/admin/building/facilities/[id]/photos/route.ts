import { NextResponse, type NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { BuildingFacilityEnhancementService } from '@/backend/admin/building'
import { apiError, apiUnexpectedError } from '@/lib/api/response'

const MAX_PHOTO_BYTES = 500 * 1024 // 500KB (client pre-compresses to this ceiling)
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const BUCKET = 'facility-photos'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  const { id } = await params

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return apiError(400, 'Expected multipart form data')
  }

  const file = form.get('file')
  if (!(file instanceof File)) return apiError(400, 'file is required')
  if (file.size === 0) return apiError(400, 'file is empty')
  if (file.size > MAX_PHOTO_BYTES) return apiError(400, 'Photo must be 500KB or smaller (compress before upload)')

  const ext = ALLOWED_TYPES[file.type]
  if (!ext) return apiError(400, 'Photo must be a JPEG, PNG, or WebP image')

  const caption = typeof form.get('caption') === 'string' ? (form.get('caption') as string) : null
  const isCover = form.get('isCover') === 'true'

  const supabase = createAdminClient()

  try {
    const { data: buckets } = await supabase.storage.listBuckets()
    if (!buckets?.some(b => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_PHOTO_BYTES,
        allowedMimeTypes: Object.keys(ALLOWED_TYPES),
      })
    }

    const path = `${id}/${randomUUID()}.${ext}`
    const bytes = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: true })
    if (uploadError) throw uploadError

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)

    const photo = await BuildingFacilityEnhancementService.addPhoto({
      facilityId: id,
      storagePath: path,
      publicUrl: pub.publicUrl,
      caption,
      isCover,
      createdBy: user.id,
    })

    return NextResponse.json(photo, { status: 201 })
  } catch (err) {
    return apiUnexpectedError('POST /api/admin/building/facilities/[id]/photos', err)
  }
}
