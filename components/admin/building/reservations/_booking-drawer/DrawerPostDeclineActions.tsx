'use client'

import { Button } from '@/components/ui/button'
import { AlertCircle, PauseCircle, Wallet } from 'lucide-react'

interface DrawerPostDeclineActionsProps {
  isAwaitingUserResponse: boolean
  onEmergencyHold: () => Promise<void>
  onShowCancelCreditModal: () => void
}

export function DrawerPostDeclineActions({
  isAwaitingUserResponse,
  onEmergencyHold,
  onShowCancelCreditModal,
}: DrawerPostDeclineActionsProps) {
  if (!isAwaitingUserResponse) return null

  return (
    <div className="p-6 border-t border-border bg-orange-50/50 dark:bg-orange-950/20 space-y-3">
      <p className="text-[10px] font-black uppercase text-orange-700 dark:text-orange-400 tracking-widest flex items-center gap-1.5">
        <AlertCircle className="w-3 h-3" /> User Declined — Choose Next Action
      </p>
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1 rounded-2xl h-11 font-black uppercase text-[10px] border-purple-200 text-purple-700 hover:bg-purple-50"
          onClick={onEmergencyHold}
        >
          <PauseCircle className="w-3.5 h-3.5 mr-1.5" />
          Put on Hold
        </Button>
        <Button
          className="flex-1 rounded-2xl h-11 font-black uppercase text-[10px] bg-amber-600 hover:bg-amber-700 text-white"
          onClick={onShowCancelCreditModal}
        >
          <Wallet className="w-3.5 h-3.5 mr-1.5" />
          Cancel & Issue Credit
        </Button>
      </div>
    </div>
  )
}
