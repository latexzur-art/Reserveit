"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2, Trash2, ArrowUp, ArrowDown, Upload } from "lucide-react"

interface QrCode {
  id: string
  label: string
  image_url: string
  account_name: string | null
  account_number: string | null
  category: string
  is_active: boolean
  display_order: number
  created_at: string
}

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = ["image/jpeg", "image/png", "image/webp"]
const MIN_QR_DIMENSION = 200
const QR_MAX_DIMENSION = 1024

async function optimizeQrImage(file: File): Promise<Blob> {
  if (file.size > 20 * 1024 * 1024) throw new Error("Image is too large (max 20MB)")
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  if (bitmap.width < MIN_QR_DIMENSION || bitmap.height < MIN_QR_DIMENSION) {
    bitmap.close()
    throw new Error(`QR image must be at least ${MIN_QR_DIMENSION}x${MIN_QR_DIMENSION} pixels`)
  }
  const scale = Math.min(1, QR_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  if (scale >= 1) {
    // Already within bounds, return original
    bitmap.close()
    return file
  }
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  // Keep PNG for QR codes (sharper than WebP for line art)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      b => b ? resolve(b) : reject(new Error("Failed to process QR image")),
      "image/png",
    )
  })
}

export function QrCodeManager() {
  const [codes, setCodes] = useState<QrCode[]>([])
  const [loading, setLoading] = useState(true)
  const [newLabel, setNewLabel] = useState("")
  const [newAccountName, setNewAccountName] = useState("")
  const [newAccountNumber, setNewAccountNumber] = useState("")
  const [newCategory, setNewCategory] = useState("other")
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<QrCode | null>(null)

  const fetchCodes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/building/payment-qr-codes")
      const data = await res.json()
      setCodes((data.qrCodes ?? []).sort((a: QrCode, b: QrCode) => a.display_order - b.display_order))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCodes() }, [fetchCodes])

  const validateFile = (file: File): string | null => {
    if (!ALLOWED.includes(file.type)) return "QR image must be a JPEG, PNG, or WebP image"
    if (file.size > MAX_BYTES) return "QR image must be 5MB or smaller"
    return null
  }

  const handleAdd = async (file: File) => {
    setUploadError(null)
    const validationError = validateFile(file)
    if (validationError) { setUploadError(validationError); return }
    if (!newLabel.trim()) { setUploadError("Enter a label before uploading"); return }

    setUploading(true)
    try {
      const optimized = await optimizeQrImage(file)
      const form = new FormData()
      form.set("label", newLabel.trim())
      form.set("file", optimized, file.name)
      if (newAccountName.trim()) form.set("account_name", newAccountName.trim())
      if (newAccountNumber.trim()) form.set("account_number", newAccountNumber.trim())
      form.set("category", newCategory)
      const res = await fetch("/api/admin/building/payment-qr-codes", { method: "POST", body: form })
      if (!res.ok) { const d = await res.json(); setUploadError(d?.error ?? "Upload failed"); return }
      setNewLabel("")
      setNewAccountName("")
      setNewAccountNumber("")
      setNewCategory("other")
      await fetchCodes()
    } catch (err: any) {
      setUploadError(err?.message ?? "Failed to process QR image")
    } finally {
      setUploading(false)
    }
  }

  const toggleActive = async (id: string, isActive: boolean) => {
    const res = await fetch(`/api/admin/building/payment-qr-codes/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: isActive }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      toast.error(d?.error ?? "Failed to update QR code")
      return
    }
    await fetchCodes()
  }

  const renameCode = async (id: string, label: string) => {
    const res = await fetch(`/api/admin/building/payment-qr-codes/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      toast.error(d?.error ?? "Failed to rename QR code")
    }
  }

  const reorder = async (id: string, direction: -1 | 1) => {
    const idx = codes.findIndex(c => c.id === id)
    const swapWith = codes[idx + direction]
    if (!swapWith) return
    const results = await Promise.all([
      fetch(`/api/admin/building/payment-qr-codes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ display_order: swapWith.display_order }) }),
      fetch(`/api/admin/building/payment-qr-codes/${swapWith.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ display_order: codes[idx].display_order }) }),
    ])
    if (results.some(r => !r.ok)) {
      toast.error("Failed to reorder QR codes")
      return
    }
    await fetchCodes()
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    const target = pendingDelete
    setPendingDelete(null)
    const res = await fetch(`/api/admin/building/payment-qr-codes/${target.id}`, { method: "DELETE" })
    if (res.status === 409) {
      toast.error("This QR code has payment history — deactivate it instead.")
      return
    }
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      toast.error(d?.error ?? "Failed to remove QR code")
      return
    }
    toast.success(`${target.label} removed`)
    await fetchCodes()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Loading QR codes…</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {(() => {
        if (codes.length === 0) return null
        const newest = codes.reduce((a, b) => a.created_at > b.created_at ? a : b)
        const daysSinceUpdate = Math.floor((Date.now() - new Date(newest.created_at).getTime()) / 86400000)
        if (daysSinceUpdate <= 30) return null
        return (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
            QR codes were last updated {daysSinceUpdate} days ago. Consider rotating them monthly for security.
          </div>
        )
      })()}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {codes.map((code, idx) => (
          <Card key={code.id} className="p-4 space-y-3">
            <img src={code.image_url} alt={code.label} className="w-full aspect-square object-contain rounded-lg border" />
            <p className="text-sm font-semibold text-foreground truncate">{code.label}</p>
            <span className="inline-block text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {code.category}
            </span>
            {(code.account_name || code.account_number) && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                {code.account_name && <p>Account: {code.account_name}</p>}
                {code.account_number && <p className="font-mono">{code.account_number}</p>}
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor={`qr-rename-${code.id}`} className="text-xs text-muted-foreground">
                Rename
              </Label>
              <Input
                id={`qr-rename-${code.id}`}
                className="h-11"
                value={code.label}
                onChange={e => {
                  const label = e.target.value
                  setCodes(prev => prev.map(c => (c.id === code.id ? { ...c, label } : c)))
                }}
                onBlur={e => { renameCode(code.id, e.target.value) }}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={code.is_active}
                  onCheckedChange={v => toggleActive(code.id, v)}
                  aria-label={`${code.is_active ? "Deactivate" : "Activate"} ${code.label}`}
                />
                <span className="text-xs text-muted-foreground">{code.is_active ? "Active" : "Inactive"}</span>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => reorder(code.id, -1)} aria-label={`Move ${code.label} up`}>
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" disabled={idx === codes.length - 1} onClick={() => reorder(code.id, 1)} aria-label={`Move ${code.label} down`}>
                  <ArrowDown className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setPendingDelete(code)} aria-label={`Remove ${code.label}`}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          </Card>
        ))}

        <Card className="p-4 space-y-3 border-dashed">
          <Label id="qr-add-label">Add QR Code</Label>
          <div className="space-y-1">
            <Label htmlFor="qr-label" className="text-xs text-muted-foreground">
              QR Code Name
            </Label>
            <Input
              id="qr-label"
              className="h-11"
              placeholder="e.g. GCash, Maya, BPI Transfer"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="qr-category" className="text-xs text-muted-foreground">
              Category
            </Label>
            <select
              id="qr-category"
              className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
            >
              <option value="gcash">GCash</option>
              <option value="maya">Maya</option>
              <option value="bpi">BPI</option>
              <option value="grabpay">GrabPay</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="qr-account-name" className="text-xs text-muted-foreground">
              Account Name
            </Label>
            <Input
              id="qr-account-name"
              className="h-11"
              placeholder="e.g. Juan Dela Cruz"
              value={newAccountName}
              onChange={e => setNewAccountName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="qr-account-number" className="text-xs text-muted-foreground">
              Account Number
            </Label>
            <Input
              id="qr-account-number"
              className="h-11"
              placeholder="e.g. 0917 123 4567"
              value={newAccountNumber}
              onChange={e => setNewAccountNumber(e.target.value)}
            />
          </div>
          <label
            aria-labelledby="qr-add-label"
            className="flex items-center justify-center gap-2 h-24 rounded-lg border border-dashed cursor-pointer text-sm text-muted-foreground hover:bg-accent"
          >
            {uploading ? <Loader2 className="animate-spin w-4 h-4" /> : <Upload className="w-4 h-4" />}
            {uploading ? "Uploading..." : "Click to upload image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={async (e) => { const f = e.target.files?.[0]; if (f) { await handleAdd(f); e.target.value = "" } }}
            />
          </label>
          {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
        </Card>
      </div>

      <AlertDialog open={pendingDelete !== null} onOpenChange={open => { if (!open) setPendingDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {pendingDelete?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This only works if this QR code has no payment history. If it has been used before, deactivate it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
