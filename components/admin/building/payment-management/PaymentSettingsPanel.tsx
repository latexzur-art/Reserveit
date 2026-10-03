"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { QrCodeManager } from "./QrCodeManager"

const MODES = [
  { value: "paymongo", label: "PayMongo" },
  { value: "qr_after_approval", label: "QR — after BA approval" },
  { value: "qr_at_submission", label: "QR — at submission" },
]

export function PaymentSettingsPanel() {
  const [mode, setMode] = useState("paymongo")
  const [helpdesk, setHelpdesk] = useState("")
  const [loaded, setLoaded] = useState(false)

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/payment-policy")
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        toast.error(d?.error ?? "Failed to load payment settings")
        return
      }
      const data = await res.json()
      setMode(data.payment_method_mode)
      setHelpdesk(data.payment_helpdesk_contact)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const updateMode = async (value: string) => {
    setMode(value)
    const res = await fetch("/api/settings/payment-policy", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment_method_mode: value }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      toast.error(d?.error ?? "Failed to update payment method")
    }
  }

  const updateHelpdesk = async (value: string) => {
    const res = await fetch("/api/settings/payment-policy", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment_helpdesk_contact: value }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      toast.error(d?.error ?? "Failed to update helpdesk contact")
    }
  }

  if (!loaded) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Loading payment settings…</span>
      </div>
    )
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="payment-mode">Active Payment Method</Label>
          <Select value={mode} onValueChange={updateMode}>
            <SelectTrigger id="payment-mode" className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="helpdesk-contact">Helpdesk Contact</Label>
          <Input
            id="helpdesk-contact"
            className="h-11"
            value={helpdesk}
            onChange={e => setHelpdesk(e.target.value)}
            onBlur={e => updateHelpdesk(e.target.value)}
            placeholder="e.g. 0912-345-6789"
          />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">QR Codes</h3>
        <QrCodeManager />
      </div>
    </Card>
  )
}
