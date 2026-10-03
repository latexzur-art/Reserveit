import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sanitizeDbError } from '@/lib/errors'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

const UpdateProfileSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100).trim().optional(),
  phone: z.string().max(20, 'Phone number is too long').trim().nullable().optional(),
  notificationEmail: z.string().email('Invalid email address').trim().nullable().optional(),
  gender: z.string().trim().nullable().optional(),
  language: z.string().trim().nullable().optional(),
}).refine(data => data.fullName !== undefined || data.phone !== undefined || data.notificationEmail !== undefined || data.gender !== undefined || data.language !== undefined, {
  message: 'Nothing to update.',
})

export async function PATCH(req: NextRequest) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      ?? req.headers.get('x-real-ip')
      ?? 'unknown'
    const rateLimited = checkRateLimit(`auth:${ip}`, RATE_LIMITS.AUTH)
    if (rateLimited) return rateLimited

    const cookieStore = await cookies()

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options)
                    })
                },
            },
        }
    )

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = UpdateProfileSchema.safeParse(body)
    if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? 'Invalid input'
        return NextResponse.json({ error: message }, { status: 400 })
    }
    const { fullName, phone, notificationEmail, gender, language } = parsed.data

    // Build update payload
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (fullName !== undefined) updates.full_name = fullName
    if (phone !== undefined) updates.phone = phone ?? null
    if (notificationEmail !== undefined) updates.notification_email = notificationEmail ?? null
    if (gender !== undefined) updates.gender = gender ?? null
    if (language !== undefined) updates.language = language ?? null

    const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(updates)
        .eq('auth_user_id', user.id)
        .select('id')
        .single()

    if (updateError) {
        return NextResponse.json({ error: sanitizeDbError(updateError) }, { status: 500 })
    }

    if (notificationEmail !== undefined) {
        const { AdminAuditService } = await import('@/backend/admin')
        await AdminAuditService.log({
            actorId: updatedUser.id,
            action: 'user.update',
            targetType: 'user',
            targetId: updatedUser.id,
            details: {
                updateType: 'profile_settings',
                notificationEmail: notificationEmail || null,
            },
        })
    }

    return NextResponse.json({ success: true })
}
