'use client'

import { Button } from '@/components/ui/button'
import { PauseCircle, Wallet } from 'lucide-react'

interface DrawerOnHoldActionsProps {
  isOnHold: boolean
  onShowCancelCreditModal: () => void
}

export function DrawerOnHoldActions({ isOnHold, onShowCancelCreditModal }: DrawerOnHoldActionsProps) {
  if (!isOnHold) return null

  return (
    <div className="p-6 border-t border-border bg-purple-50/50 dark:bg-purple-950/20">
      <p className="text-[10px] font-black uppercase text-purple-700 dark:text-purple-400 mb-3 tracking-widest flex items-center gap-1.5">
        <PauseCircle className="w-3 h-3" /> On Hold — Resolution Required
      </p>
      <Button
        className="w-full rounded-2xl h-11 font-black uppercase text-[10px] bg-amber-600 hover:bg-amber-700 text-white"
        onClick={onShowCancelCreditModal}
      >
        <Wallet className="w-3.5 h-3.5 mr-1.5" />
        Cancel & Issue Credit
      </Button>
    </div>
  )
}
