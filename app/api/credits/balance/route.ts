import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { creditService } from '@/backend/credits/creditService'
import { getErrorMessage } from '@/lib/errors'

export async function GET() {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  try {
    const balanceCentavos = await creditService.getUserBalance(user!.id)
    return NextResponse.json({
      balanceCentavos,
      balancePeso: (balanceCentavos / 100).toFixed(2),
    })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
