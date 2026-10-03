import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingBookingsService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

const ManualBookingBodySchema = z.object({
  userId: z.string().uuid(),
  bookingType: z.string().min(1),
  bookingPurpose: z.string().min(1),
  bookingDate: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  purpose: z.string().min(1),
  eventName: z.string().optional(),
  expectedAttendees: z.number().int().positive().optional(),
  facilityIds: z.array(z.string().uuid()).min(1),
  specialRequests: z.string().optional(),
  requiresPayment: z.boolean().optional(),
  paymentAmount: z.number().positive().optional(),
  paymentMethod: z.enum(['cashier', 'qr_manual']).optional(),
})

export async function POST(request: NextRequest) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const body = await request.json()
    const parsed = ManualBookingBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map(i => i.message).join('; ') },
        { status: 400 },
      )
    }
    const booking = await BuildingBookingsService.createManual(parsed.data)
    return NextResponse.json(booking, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
