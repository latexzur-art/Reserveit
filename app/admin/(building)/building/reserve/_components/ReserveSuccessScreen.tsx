'use client'

import { Button } from '@/components/ui/button'
import { CheckCircle2, CreditCard } from 'lucide-react'
import { ROUTES } from '@/lib/routes'
import { useRouter } from 'next/navigation'

interface ReserveSuccessScreenProps {
  successState: {
    type: 'auto_approved' | 'payment_required'
    bookingReference: string
    paymentId?: string | null
  }
  onNewReservation: () => void
}

export function ReserveSuccessScreen({ successState, onNewReservation }: ReserveSuccessScreenProps) {
  const router = useRouter()

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-24 px-6">
      {successState.type === 'auto_approved' ? (
        <div className="bg-card rounded-2xl shadow-sm border border-border p-12 max-w-md w-full text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-sti-blue dark:text-accent-light mx-auto" />
          <h2 className="text-2xl font-bold">Booking Auto-Approved</h2>
          <p className="text-muted-foreground">
            Reference: <span className="font-mono font-semibold">{successState.bookingReference}</span>
          </p>
          <p className="text-sm text-muted-foreground">Your privileged reservation has been confirmed.</p>
          <div className="flex gap-3 pt-2 justify-center">
            <Button onClick={onNewReservation}>
              New Reservation
            </Button>
            <Button variant="outline" onClick={() => router.push(ROUTES.buildingAdmin.reservations)}>
              View Reservations
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-2xl shadow-sm border border-border p-12 max-w-md w-full text-center space-y-4">
          <CreditCard className="w-16 h-16 text-amber-500 mx-auto" />
          <h2 className="text-2xl font-bold">Payment Required</h2>
          <p className="text-muted-foreground">
            Reference: <span className="font-mono font-semibold">{successState.bookingReference}</span>
          </p>
          <p className="text-sm text-muted-foreground">Go to My Payments to complete payment and confirm your reservation.</p>
          <div className="flex gap-3 pt-2 justify-center">
            <Button variant="outline" onClick={onNewReservation}>
              New Reservation
            </Button>
            <Button onClick={() => router.push(ROUTES.buildingAdmin.payment)}>
              Go to My Payments
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
