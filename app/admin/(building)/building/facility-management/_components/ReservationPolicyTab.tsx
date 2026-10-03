"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { Loader2, CalendarClock } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { getManilaTodayISO } from "@/lib/timezone"
import { earliestBookableDate, DEFAULT_MIN_LEAD_DAYS } from "@/lib/reservation-lead-time"

export function ReservationPolicyTab() {
  const [value, setValue] = useState<number>(DEFAULT_MIN_LEAD_DAYS)
  const [saved, setSaved] = useState<number>(DEFAULT_MIN_LEAD_DAYS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/settings/schedule-policy")
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d && typeof d.min_reservation_lead_days === "number") {
          setValue(d.min_reservation_lead_days)
          setSaved(d.min_reservation_lead_days)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const valid = Number.isInteger(value) && value >= 0 && value <= 14
  const dirty = value !== saved

  const handleSave = async () => {
    if (!valid || saving) return
    setSaving(true)
    try {
      const res = await fetch("/api/settings/schedule-policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ min_reservation_lead_days: value }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        throw new Error(d?.error ?? "Failed to save")
      }
      setSaved(value)
      toast({ title: "Reservation policy updated", description: `Minimum advance notice is now ${value} day(s).` })
    } catch (err) {
      toast({ title: "Could not save", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const earliestPreview = valid ? earliestBookableDate(getManilaTodayISO(), value) : null

  return (
    <Card className="max-w-2xl p-8 rounded-3xl border-border bg-card shadow-none space-y-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-accent-brand/15 p-2 text-accent-brand">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-black uppercase tracking-tight text-foreground">Minimum Advance Notice</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            How many days ahead faculty and program heads must reserve a classroom. Sundays are
            not counted. Paid/rental facilities and administrators are exempt.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading current policy…
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lead-days" className="text-sm font-medium text-foreground">
              Days of advance notice
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="lead-days"
                type="number"
                min={0}
                max={14}
                step={1}
                value={Number.isNaN(value) ? "" : value}
                onChange={e => setValue(parseInt(e.target.value, 10))}
                className="h-11 w-28"
              />
              <span className="text-sm text-muted-foreground">day(s) — set 0 to disable</span>
            </div>
            {!valid && (
              <p className="text-xs text-red-500">Enter a whole number between 0 and 14.</p>
            )}
          </div>

          {earliestPreview && (
            <p className="text-xs text-muted-foreground">
              {value === 0
                ? "No advance notice required — reservations can be made for today."
                : `A reservation started today could be booked no earlier than ${format(new Date(`${earliestPreview}T00:00:00`), "EEEE, MMM d")}.`}
            </p>
          )}

          <Button onClick={handleSave} disabled={!valid || !dirty || saving} className="h-11">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save policy
          </Button>
        </div>
      )}
    </Card>
  )
}
