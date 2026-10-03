"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface Props {
  paymentId: string
  totalAmount: number
  onSuccess: () => void
  trigger: React.ReactNode
}

export function DiscretionaryRefundDialog({ paymentId, totalAmount, onSuccess, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(String(totalAmount))
  const [note, setNote] = useState("")
  const [destinationName, setDestinationName] = useState("")
  const [destinationContact, setDestinationContact] = useState("")
  const [referenceNumber, setReferenceNumber] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const numericAmount = Number(amount)
  const canSubmit = note.trim() && destinationName.trim() && destinationContact.trim() && referenceNumber.trim()
    && numericAmount > 0 && numericAmount <= totalAmount

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/building/payments/${paymentId}/refunds`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger_type: "ba_override", amount: numericAmount, justification_note: note,
          destination_name: destinationName, destination_contact_number: destinationContact,
          reference_number: referenceNumber,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data?.error ?? "Unable to process refund."); return }
      setOpen(false)
      onSuccess()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Discretionary Refund</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="dr-amount">Amount (max ₱{totalAmount.toLocaleString()})</Label>
            <Input id="dr-amount" className="h-11" type="number" value={amount} onChange={e => setAmount(e.target.value)} max={totalAmount} min={0} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dr-note">
              Justification (off-app arrangement) <span className="text-destructive">*</span>
            </Label>
            <Textarea id="dr-note" value={note} onChange={e => setNote(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dr-dest-name">
              Destination name <span className="text-destructive">*</span>
            </Label>
            <Input id="dr-dest-name" className="h-11" value={destinationName} onChange={e => setDestinationName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dr-dest-contact">
              Destination contact number <span className="text-destructive">*</span>
            </Label>
            <Input id="dr-dest-contact" className="h-11" value={destinationContact} onChange={e => setDestinationContact(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dr-ref">
              Your outgoing transaction reference number <span className="text-destructive">*</span>
            </Label>
            <Input id="dr-ref" className="h-11" value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!canSubmit || submitting} onClick={handleSubmit}>Submit Refund</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
