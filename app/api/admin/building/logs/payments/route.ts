import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingReportsService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'
import { z } from 'zod'

const CreatePaymentSchema = z.object({
  bookingRef: z.string().min(1, 'Booking reference is required'),
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  paymentStatus: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { searchParams } = request.nextUrl
    const result = await BuildingReportsService.getPayments({
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      method: searchParams.get('method') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const body = await request.json()

    const validation = CreatePaymentSchema.safeParse(body)
    if (!validation.success) {
      const messages = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
      return NextResponse.json({ error: messages }, { status: 400 })
    }

    const transaction = await BuildingReportsService.createPaymentLog(validation.data)
    return NextResponse.json({ transaction }, { status: 201 })
  } catch (err) {
    console.error('[API] POST /admin/building/logs/payments error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
