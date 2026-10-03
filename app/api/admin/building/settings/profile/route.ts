import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingSettingsService } from '@/backend/admin/building'
import { AdminAuditService } from '@/backend/admin'
import { getErrorMessage } from '@/lib/errors'

const ProfileSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100).trim().optional(),
  phone: z.string().max(20, 'Phone number is too long').trim().nullable().optional(),
  notificationEmail: z.union([z.string().email('Invalid notification email').trim(), z.literal('')]).nullable().optional(),
  gender: z.string().max(50).trim().nullable().optional(),
  language: z.string().max(50).trim().nullable().optional(),
})

export async function PATCH(request: NextRequest) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const parsed = ProfileSchema.safeParse(await request.json())
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid input'
      return NextResponse.json({ error: message }, { status: 400 })
    }
    const body = parsed.data
    const result = await BuildingSettingsService.updateProfile(user.id, {
      fullName: body.fullName,
      phone: body.phone ?? undefined,
      notificationEmail: body.notificationEmail ?? undefined,
      gender: body.gender ?? undefined,
      language: body.language ?? undefined,
    })

    if (body.notificationEmail !== undefined) {
      await AdminAuditService.log({
        actorId: user.id,
        action: 'user.update',
        targetType: 'user',
        targetId: user.id,
        details: {
          updateType: 'profile_settings',
          notificationEmail: body.notificationEmail || null,
        },
      })
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
