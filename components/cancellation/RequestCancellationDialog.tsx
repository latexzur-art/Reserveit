"use client"

import { useState, useEffect, useMemo, type ReactNode } from "react"
import { toast } from "sonner"
import imageCompression from "browser-image-compression"
import {
  UploadCloud,
  Trash2,
  QrCode,
  Maximize2,
  CheckCircle2,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isRefundWindowMet, getManilaDateString } from "@/lib/refund-eligibility"

const REASON_MIN_LENGTH = 20

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1024,
  fileType: "image/webp" as const,
  useWebWorker: true,
}

interface RequestCancellationDialogProps {
  bookingId: string
  bookingDate: string
  hasCompletedPayment: boolean
  defaultReason?: string
  dialogDescription?: string
  defaultDestinationName?: string
  defaultDestinationContact?: string
  defaultDestinationQrUrl?: string
  onSuccess: () => void
  trigger: ReactNode
}

function getStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage
    }
  } catch {}
  return null
}

export function RequestCancellationDialog({
  bookingId,
  bookingDate,
  hasCompletedPayment,
  defaultReason = "",
  dialogDescription,
  defaultDestinationName = "",
  defaultDestinationContact = "",
  defaultDestinationQrUrl = "",
  onSuccess,
  trigger,
}: RequestCancellationDialogProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [destinationName, setDestinationName] = useState(defaultDestinationName)
  const [destinationContact, setDestinationContact] = useState(defaultDestinationContact)
  const [destinationQrUrl, setDestinationQrUrl] = useState<string | null>(defaultDestinationQrUrl || null)
  const [uploadingQr, setUploadingQr] = useState(false)
  const [qrError, setQrError] = useState<string | null>(null)
  const [showQrLightbox, setShowQrLightbox] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load previously saved refund destination and QR code from localStorage on mount/open
  useEffect(() => {
    if (open) {
      if (defaultReason && !reason) {
        setReason(defaultReason)
      }
      const storage = getStorage()
      if (storage) {
        if (!destinationName) {
          const savedName = storage.getItem("reserveit_saved_refund_name")
          if (savedName) setDestinationName(savedName)
        }
        if (!destinationContact) {
          const savedContact = storage.getItem("reserveit_saved_refund_contact")
          if (savedContact) setDestinationContact(savedContact)
        }
        if (!destinationQrUrl) {
          const savedQr = storage.getItem("reserveit_saved_refund_qr")
          if (savedQr) setDestinationQrUrl(savedQr)
        }
      }
    }
  }, [open])

  const windowMet = useMemo(
    () => hasCompletedPayment && isRefundWindowMet(bookingDate, getManilaDateString()),
    [hasCompletedPayment, bookingDate]
  )

  const reasonValid = reason.trim().length >= REASON_MIN_LENGTH
  const destinationValid = !hasCompletedPayment || (destinationName.trim().length > 0 && destinationContact.trim().length > 0)
  const canSubmit = reasonValid && destinationValid && !submitting && !uploadingQr

  const resetForm = () => {
    setReason("")
    setDestinationName(defaultDestinationName)
    setDestinationContact(defaultDestinationContact)
    setDestinationQrUrl(defaultDestinationQrUrl || null)
    setUploadingQr(false)
    setQrError(null)
    setShowQrLightbox(false)
    setError(null)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) resetForm()
  }

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setQrError("Image size must be 10MB or smaller before compression")
      return
    }
    setUploadingQr(true)
    setQrError(null)
    try {
      // Auto-downsize & compress to lightweight WebP (max 1024px / <500KB)
      let compressedFile: File | Blob = file
      try {
        compressedFile = await imageCompression(file, COMPRESSION_OPTIONS)
      } catch {
        compressedFile = file
      }

      const formData = new FormData()
      formData.append("file", compressedFile, file.name.replace(/\.[^/.]+$/, ".webp"))
      const res = await fetch("/api/payments/screenshot-upload", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setQrError(data?.error ?? "Failed to upload QR code image")
        return
      }
      setDestinationQrUrl(data.url)
      const storage = getStorage()
      if (storage) {
        storage.setItem("reserveit_saved_refund_qr", data.url)
      }
    } catch {
      setQrError("Failed to upload QR code image")
    } finally {
      setUploadingQr(false)
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/request-cancellation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim(),
          ...(hasCompletedPayment
            ? {
                refund_destination_name: destinationName.trim(),
                refund_destination_contact_number: destinationContact.trim(),
                ...(destinationQrUrl ? { refund_destination_qr_url: destinationQrUrl } : {}),
              }
            : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? "Unable to submit cancellation request. Please try again.")
        return
      }

      // Save valid refund destination info to storage for effortless reuse in future
      const storage = getStorage()
      if (storage && hasCompletedPayment) {
        if (destinationName.trim()) storage.setItem("reserveit_saved_refund_name", destinationName.trim())
        if (destinationContact.trim()) storage.setItem("reserveit_saved_refund_contact", destinationContact.trim())
        if (destinationQrUrl) storage.setItem("reserveit_saved_refund_qr", destinationQrUrl)
      }

      setOpen(false)
      resetForm()
      toast.success(
        hasCompletedPayment
          ? "Cancellation request submitted. The Building Admin will review it shortly."
          : "Cancellation request submitted. The Academic Head will review it shortly."
      )
      onSuccess()
    } catch {
      setError("Unable to submit cancellation request. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="rounded-2xl border border-border shadow-2xl p-8 max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-foreground uppercase tracking-tight">
            REQUEST <span className="text-accent-brand">CANCELLATION</span>
          </DialogTitle>
          <DialogDescription className="text-sm font-medium text-muted-foreground leading-relaxed">
            {dialogDescription ?? (
              <>
                Please confirm your cancellation request. It will be submitted for review by{" "}
                {hasCompletedPayment ? "the Building Admin" : "the Academic Head"}. Your booking remains active until approved.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {hasCompletedPayment && (
          <p
            className={
              windowMet
                ? "text-sm font-medium text-emerald-600 dark:text-emerald-400"
                : "text-sm font-medium text-amber-600 dark:text-amber-400"
            }
          >
            {windowMet
              ? "You'll receive a full refund if approved."
              : "This request is outside the refund window — a refund isn't automatic; contact the helpdesk if you have an arrangement."}
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="cancel-reason" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Cancellation Reason <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Schedule conflict, class moved to a different room, event cancelled..."
            rows={4}
            className="rounded-2xl resize-none"
          />
          <p className="text-xs text-muted-foreground">
            {reason.trim().length}/{REASON_MIN_LENGTH} min characters
          </p>
        </div>

        {hasCompletedPayment && (
          <div className="space-y-4 pt-1 border-t border-border/40">
            <div className="space-y-2">
              <Label htmlFor="dest-name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Refund Destination Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dest-name"
                value={destinationName}
                onChange={e => setDestinationName(e.target.value)}
                placeholder="Full name on the receiving account"
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dest-contact" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Refund Destination Contact Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dest-contact"
                value={destinationContact}
                onChange={e => setDestinationContact(e.target.value)}
                placeholder="09XXXXXXXXX"
                className="rounded-xl h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dest-qr-upload" className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-emerald-500" />
                Refund QR Reference <span className="text-[10px] font-normal text-muted-foreground lowercase">(optional)</span>
              </Label>
              {destinationQrUrl ? (
                <div className="flex items-center gap-3 p-3 bg-muted/30 border border-border rounded-xl">
                  {/* Downsized scannable QR thumbnail container */}
                  <div className="relative w-24 h-24 rounded-lg border border-slate-700 bg-slate-950 p-1 flex items-center justify-center shrink-0 overflow-hidden group shadow-md">
                    <img
                      src={destinationQrUrl}
                      alt="Refund QR Code Preview"
                      className="max-w-full max-h-full object-contain rounded-md transition-transform group-hover:scale-105"
                    />
                    <button
                      type="button"
                      onClick={() => setShowQrLightbox(true)}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                      title="Expand QR Code"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      QR Code Attached
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      Downsized & scannable. Click image or View Full to expand.
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowQrLightbox(true)}
                        className="h-7 px-2 text-[11px] text-primary hover:text-primary font-medium"
                      >
                        <Maximize2 className="w-3 h-3 mr-1" /> View Full
                      </Button>
                      <label
                        htmlFor="dest-qr-upload-change"
                        className="inline-flex items-center justify-center h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground font-medium rounded-md hover:bg-accent cursor-pointer transition-colors"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Change / New
                      </label>
                      <input
                        id="dest-qr-upload-change"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={uploadingQr}
                        onChange={handleQrUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDestinationQrUrl(null)}
                        className="h-7 px-2 text-[11px] text-destructive hover:text-destructive font-medium"
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="dest-qr-upload"
                    className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-border hover:border-emerald-500/50 rounded-xl cursor-pointer bg-muted/20 hover:bg-muted/40 transition-colors text-center"
                  >
                    {uploadingQr ? (
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                        Uploading QR reference...
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="w-5 h-5 text-muted-foreground mb-1" />
                        <span className="text-xs font-bold text-foreground">Upload GCash / Maya QR Code</span>
                        <span className="text-[11px] text-muted-foreground">PNG, JPG or WebP (max 5MB)</span>
                      </>
                    )}
                  </label>
                  <input
                    id="dest-qr-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploadingQr}
                    onChange={handleQrUpload}
                    className="hidden"
                  />
                </div>
              )}
              {qrError && <p className="text-xs text-destructive font-medium mt-1">{qrError}</p>}
            </div>
          </div>
        )}

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="flex-1 rounded-xl font-bold uppercase text-xs tracking-wider h-12 border-border"
          >
            Go Back
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 rounded-xl font-bold uppercase text-xs tracking-wider h-12"
          >
            {submitting ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* QR Code Lightbox Modal */}
      {showQrLightbox && destinationQrUrl && (
        <Dialog open={showQrLightbox} onOpenChange={setShowQrLightbox}>
          <DialogContent className="max-w-lg p-6 bg-slate-950 border border-slate-800 text-white rounded-2xl flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-4">
              <span className="text-sm font-bold flex items-center gap-2">
                <QrCode className="w-4 h-4 text-emerald-400" />
                Refund QR Code Reference
              </span>
              <button
                type="button"
                onClick={() => setShowQrLightbox(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-xl max-w-full flex items-center justify-center">
              <img
                src={destinationQrUrl}
                alt="Full Refund QR Code"
                className="max-h-[60vh] max-w-full object-contain rounded"
              />
            </div>
            <p className="text-xs text-slate-400 mt-4 text-center">
              Scan with your GCash or Maya app camera to verify payment details.
            </p>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  )
}

