'use client'

import { CheckCircle2, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface SelfBookingSuccess {
  type: 'auto_approved' | 'payment_required'
  bookingReference: string
}

export function SuccessState({
  successState,
  onDone,
  onGoToPayments,
}: {
  successState: SelfBookingSuccess
  onDone: () => void
  onGoToPayments: () => void
}) {
  return (
          <div className="py-6 space-y-4">
            {successState.type === 'auto_approved' ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                <p className="font-semibold text-emerald-600">Booking Auto-Approved</p>
                <p className="text-sm text-muted-foreground">
                  Reference: <span className="font-mono font-medium">{successState.bookingReference}</span>
                </p>
                <p className="text-sm text-muted-foreground">Your reservation has been confirmed as a privileged booking.</p>
                <Button className="mt-2" onClick={onDone}>Done</Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <CreditCard className="w-12 h-12 text-amber-500" />
                <p className="font-semibold text-amber-600">Payment Required</p>
                <p className="text-sm text-muted-foreground">
                  Reference: <span className="font-mono font-medium">{successState.bookingReference}</span>
                </p>
                <p className="text-sm text-muted-foreground">Go to My Payments to complete payment and confirm your reservation.</p>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" onClick={onDone}>Close</Button>
                  <Button onClick={onGoToPayments}>
                    Go to My Payments
                  </Button>
                </div>
              </div>
            )}
          </div>
  )
}
