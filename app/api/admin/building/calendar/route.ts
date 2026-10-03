import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingCalendarService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'
import { z } from 'zod'

const CreateEventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Invalid time format'),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Invalid time format'),
  facilityId: z.string().optional(),
  reason: z.string().optional(),
  type: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { searchParams } = request.nextUrl
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const facilityId = searchParams.get('facilityId') || undefined

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
    }

    const events = await BuildingCalendarService.getEvents(startDate, endDate, facilityId)
    return NextResponse.json({ events })
  } catch (err) {
    console.error('[API] GET /admin/building/calendar error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const body = await request.json()

    const validation = CreateEventSchema.safeParse(body)
    if (!validation.success) {
      const messages = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
      return NextResponse.json({ error: messages }, { status: 400 })
    }

    const event = await BuildingCalendarService.createEvent(validation.data)
    return NextResponse.json({ event }, { status: 201 })
  } catch (err) {
    console.error('[API] POST /admin/building/calendar error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
