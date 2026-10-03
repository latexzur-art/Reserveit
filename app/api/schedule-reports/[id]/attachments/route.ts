import { NextResponse, type NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { ScheduleIssueReportsService } from '@/backend/schedule/schedule-issue-reports.service'
import { apiError, apiUnexpectedError } from '@/lib/api/response'
import { checkRateLimitAsync } from '@/lib/rate-limit'

const MAX_PHOTO_BYTES = 500 * 1024 // 500KB (client pre-compresses to this ceiling)
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const MAX_ATTACHMENTS = 5
const BUCKET = 'schedule-report-attachments'

/** POST — upload an attachment for a schedule issue report. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  const { id: reportId } = await params

  // Rate limit: 10 uploads per minute per user
  const rateLimitResponse = await checkRateLimitAsync(
    `schedule-report-attachment:${user!.id}`,
    { maxRequests: 10, windowMs: 60_000 },
  )
  if (rateLimitResponse) return rateLimitResponse

  // Verify the report exists and belongs to the user
  const supabase = createAdminClient()
  const { data: report, error: reportErr } = await supabase
    .from('schedule_issue_reports')
    .select('id, reported_by')
    .eq('id', reportId)
    .single()

  if (reportErr || !report) return apiError(404, 'Report not found')
  if (report.reported_by !== user!.id) return apiError(403, 'You can only attach files to your own reports')

  // Parse multipart form data
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return apiError(400, 'Expected multipart form data')
  }

  const file = form.get('file')
  if (!(file instanceof File)) return apiError(400, 'file is required')
  if (file.size === 0) return apiError(400, 'file is empty')
  if (file.size > MAX_PHOTO_BYTES) return apiError(400, 'Attachment must be 500KB or smaller (compress before upload)')

  const ext = ALLOWED_TYPES[file.type]
  if (!ext) return apiError(400, 'Attachment must be a JPEG, PNG, or WebP image')

  const caption = typeof form.get('caption') === 'string' ? (form.get('caption') as string) : null

  try {
    // Check attachment count
    const count = await ScheduleIssueReportsService.getAttachmentCount(reportId)
    if (count >= MAX_ATTACHMENTS) {
      return apiError(400, `Maximum of ${MAX_ATTACHMENTS} attachments per report`)
    }

    // Ensure bucket exists (lazy create)
    const { data: buckets } = await supabase.storage.listBuckets()
    if (!buckets?.some(b => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_PHOTO_BYTES,
        allowedMimeTypes: Object.keys(ALLOWED_TYPES),
      })
    }

    // Upload to Supabase Storage
    const path = `${reportId}/${randomUUID()}.${ext}`
    const bytes = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: true })
    if (uploadError) throw uploadError

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)

    // Insert attachment record
    const { data: attachment, error: insertErr } = await supabase
      .from('schedule_issue_report_attachments')
      .insert({
        report_id: reportId,
        storage_path: path,
        public_url: pub.publicUrl,
        caption,
        file_size: file.size,
        sort_order: count,
        created_by: user!.id,
      })
      .select()
      .single()

    if (insertErr) throw new Error(insertErr.message)

    return NextResponse.json(attachment, { status: 201 })
  } catch (err) {
    return apiUnexpectedError('POST /api/schedule-reports/[id]/attachments', err)
  }
}

/** GET — list attachments for a report (admin only). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  // Only building_admin can list attachments
  const roles = (user!.roles ?? []).map((r: { name: string }) => r.name)
  if (!roles.includes('building_admin')) {
    return apiError(403, 'Forbidden: building_admin role required')
  }

  const { id: reportId } = await params

  try {
    const attachments = await ScheduleIssueReportsService.getAttachments(reportId)
    return NextResponse.json({ attachments })
  } catch (err) {
    return apiUnexpectedError('GET /api/schedule-reports/[id]/attachments', err)
  }
}
