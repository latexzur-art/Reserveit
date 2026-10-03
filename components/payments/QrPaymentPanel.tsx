"use client"

import { useEffect, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Download, Upload, X, Maximize2 } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

interface QrCode { id: string; label: string; image_url: string; account_name: string | null; account_number: string | null; category: string }

interface Props {
  paymentId: string
  payerNameDefault: string
  payerContactDefault: string
  currentStatus: "pending" | "pending_review" | "failed" | "completed"
  qrReferenceNumber?: string
  rejectionReason?: string
  helpdeskContact: string
  onSubmitted: () => void
}

async function resizeImage(file: File, maxDimension = 1600): Promise<Blob> {
  if (file.size > 20 * 1024 * 1024) throw new Error("Image is too large (max 20MB)")
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      b => b ? resolve(b) : reject(new Error("Failed to process image")),
      "image/webp", 0.85,
    )
  })
}

export function QrPaymentPanel({
  paymentId, payerNameDefault, payerContactDefault, currentStatus,
  qrReferenceNumber, rejectionReason, helpdeskContact, onSubmitted,
}: Props) {
  const [codes, setCodes] = useState<QrCode[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [payerName, setPayerName] = useState(payerNameDefault)
  const [payerContact, setPayerContact] = useState(payerContactDefault)
  const [payerAccountName, setPayerAccountName] = useState("")
  const [payerAccountNumber, setPayerAccountNumber] = useState("")
  const [reference, setReference] = useState(qrReferenceNumber ?? "")
  const [screenshotUrl, setScreenshotUrl] = useState<string | undefined>(undefined)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedQr, setExpandedQr] = useState<QrCode | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>("all")

  const CATEGORY_OPTIONS = [
    { value: "all", label: "All" },
    { value: "gcash", label: "GCash" },
    { value: "maya", label: "Maya" },
    { value: "bpi", label: "BPI" },
    { value: "grabpay", label: "GrabPay" },
    { value: "other", label: "Other" },
  ]

  const filteredCodes = categoryFilter === "all" ? codes : codes.filter(c => c.category === categoryFilter)

  const fetchCodes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/payment-qr-codes")
      const data = await res.json()
      setCodes(data.qrCodes ?? [])
      if ((data.qrCodes ?? []).length > 0) setSelectedId(data.qrCodes[0].id)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCodes() }, [fetchCodes])

  if (currentStatus === "completed") return null

  if (currentStatus === "pending_review") {
    return (
      <Card className="p-4 bg-amber-500/10 border-amber-500/20">
        <p className="text-sm font-semibold">Payment Under Review</p>
        <p className="text-xs text-muted-foreground mt-1">We&apos;re verifying your reference number ({qrReferenceNumber}). You will be notified once verified.</p>
      </Card>
    )
  }

  const canSubmit = selectedId && payerName.trim() && payerContact.trim() && reference.trim()

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/payments/${paymentId}/qr-submit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qr_code_id: selectedId,
          payer_name: payerName,
          payer_contact_number: payerContact,
          reference_number: reference,
          screenshot_url: screenshotUrl,
          payer_account_name: payerAccountName || undefined,
          payer_account_number: payerAccountNumber || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data?.error ?? "Unable to submit payment proof."); return }
      onSubmitted()
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="animate-spin" /></div>

  if (codes.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm font-semibold">No payment method available</p>
        <p className="text-xs text-muted-foreground mt-1">Please contact the helpdesk: {helpdeskContact}</p>
      </Card>
    )
  }

  const selected = codes.find(c => c.id === selectedId)

  return (
    <Card className="p-4 space-y-5">
      {currentStatus === "failed" && rejectionReason && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          Your previous submission was rejected: {rejectionReason}. Please resubmit below.
        </div>
      )}

      {/* Category Filter */}
      {codes.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filter by type</p>
          <div className="flex gap-2 flex-wrap">
            {CATEGORY_OPTIONS.filter(opt => opt.value === "all" || codes.some(c => c.category === opt.value)).map(opt => (
              <button key={opt.value} onClick={() => { setCategoryFilter(opt.value); const first = opt.value === "all" ? codes : codes.filter(c => c.category === opt.value); setSelectedId(first.length > 0 ? first[0].id : null) }}
                aria-pressed={categoryFilter === opt.value}
                className={`px-3 py-2 min-h-11 rounded-full text-xs font-semibold border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${categoryFilter === opt.value ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* QR Code Selection */}
      <div className="flex gap-2 flex-wrap">
        {filteredCodes.map(c => (
          <button key={c.id} onClick={() => setSelectedId(c.id)}
            aria-pressed={selectedId === c.id}
            className={`px-3 py-2.5 min-h-11 rounded-full text-xs font-semibold border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedId === c.id ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>
            {c.label}
          </button>
        ))}
      </div>
      {filteredCodes.length === 0 && codes.length > 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">No payment methods in this category.</p>
      )}

      {/* QR Code Display */}
      {selected && (
        <div className="flex flex-col items-center gap-2">
          <button type="button" onClick={() => setExpandedQr(selected)} className="group relative cursor-zoom-in">
            <img src={selected.image_url} alt={selected.label} className="w-48 h-48 object-contain rounded-lg border transition-all group-hover:shadow-md" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 rounded-lg transition-all">
              <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
            </div>
          </button>
          {(selected.account_name || selected.account_number) && (
            <div className="text-center space-y-0.5">
              {selected.account_name && <p className="text-xs text-muted-foreground">{selected.account_name}</p>}
              {selected.account_number && <p className="text-xs text-muted-foreground font-mono">{selected.account_number}</p>}
            </div>
          )}
          <a href={selected.image_url} download target="_blank" rel="noopener" className="text-xs text-primary flex items-center gap-1 hover:underline"><Download className="w-3 h-3" /> Download QR</a>
        </div>
      )}

      {/* Expanded QR Code Dialog */}
      <Dialog open={!!expandedQr} onOpenChange={open => { if (!open) setExpandedQr(null) }}>
        <DialogContent className="sm:max-w-lg p-8">
          <DialogTitle className="sr-only">{expandedQr?.label ?? "QR Code"}</DialogTitle>
          {expandedQr && (
            <div className="flex flex-col items-center gap-4">
              <img src={expandedQr.image_url} alt={expandedQr.label} className="w-full max-w-sm object-contain rounded-lg" />
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-foreground">{expandedQr.label}</p>
                {expandedQr.account_name && <p className="text-xs text-muted-foreground">Account: {expandedQr.account_name}</p>}
                {expandedQr.account_number && <p className="text-xs text-muted-foreground font-mono">{expandedQr.account_number}</p>}
              </div>
              <a href={expandedQr.image_url} download target="_blank" rel="noopener" className="text-xs text-primary flex items-center gap-1 hover:underline"><Download className="w-3 h-3" /> Download QR</a>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Your Information */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Information</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="qr-payer-name">Payer name</Label>
            <Input id="qr-payer-name" className="h-11" value={payerName} onChange={e => setPayerName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="qr-payer-contact">Contact number</Label>
            <Input id="qr-payer-contact" className="h-11" placeholder="09XX XXX XXXX" value={payerContact} onChange={e => setPayerContact(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="qr-payer-account-name">Account name</Label>
            <Input id="qr-payer-account-name" className="h-11" placeholder="Name on your account" value={payerAccountName} onChange={e => setPayerAccountName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="qr-payer-account-number">Account number</Label>
            <Input id="qr-payer-account-number" className="h-11" placeholder="Your account number" value={payerAccountNumber} onChange={e => setPayerAccountNumber(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Payment Proof */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment Proof</p>
        <div className="space-y-1">
          <Label htmlFor="qr-reference">Reference number</Label>
          <Input id="qr-reference" className="h-11" placeholder="From your GCash receipt" value={reference} onChange={e => setReference(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Screenshot (optional)</Label>
          {screenshotUrl ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border/80 bg-muted/20">
              <img src={screenshotUrl} alt="Uploaded screenshot" className="w-16 h-16 object-cover rounded-lg border" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">Screenshot uploaded</p>
                <p className="text-xs text-muted-foreground">Ready to submit</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setScreenshotUrl(undefined)} className="shrink-0 h-8 w-8 p-0">
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <label tabIndex={0} role="button" aria-label="Upload screenshot" onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.currentTarget.querySelector('input[type=file]') as HTMLInputElement)?.click() } }} className="flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl border border-dashed border-border/80 bg-muted/30 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Uploading..." : "Click to upload screenshot"}
              <input id="qr-screenshot" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading} onChange={async e => {
                const file = e.target.files?.[0]
                if (!file) return
                setError(null)
                setUploading(true)
                try {
                  const resized = await resizeImage(file)
                  const form = new FormData()
                  form.set("file", resized, "screenshot.webp")
                  const res = await fetch("/api/payments/screenshot-upload", { method: "POST", body: form })
                  const data = await res.json()
                  if (res.ok) {
                    setScreenshotUrl(data.url)
                  } else {
                    setError(data?.error ?? "Unable to upload screenshot. Please try again.")
                  }
                } catch {
                  setError("Unable to process the screenshot. Please try a different image or continue without one.")
                } finally {
                  setUploading(false)
                }
              }} />
            </label>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      <Button disabled={!canSubmit || submitting} onClick={handleSubmit} className="w-full h-11">
        {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : "Submit Payment Proof"}
      </Button>

      {helpdeskContact && (
        <p className="text-xs text-muted-foreground text-center">Need help? Contact{" "}
          {helpdeskContact.match(/^\d/) ? <a href={`tel:${helpdeskContact}`} className="text-primary hover:underline">{helpdeskContact}</a> : helpdeskContact}
        </p>
      )}
    </Card>
  )
}
