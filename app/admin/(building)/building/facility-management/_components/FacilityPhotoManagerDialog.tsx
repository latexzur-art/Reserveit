"use client"

import { useCallback, useRef, useState } from "react"
import imageCompression from "browser-image-compression"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { UploadCloud, Star, Trash2, Loader2 } from "lucide-react"
import { useFacilityPhotos } from "@/hooks/shared/useFacilityPhotos"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface FacilityPhotoManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  facilityId: string | null
  facilityName?: string
}

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1920,
  fileType: "image/webp" as const,
  useWebWorker: true,
}

export function FacilityPhotoManagerDialog({ open, onOpenChange, facilityId, facilityName }: FacilityPhotoManagerDialogProps) {
  const { photos, loading, uploadPhoto, updatePhoto, deletePhoto } = useFacilityPhotos(open ? facilityId : null)
  const { toast } = useToast()
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const compressed = await imageCompression(file, COMPRESSION_OPTIONS)
        await uploadPhoto(compressed)
      }
      toast({ title: "Uploaded", description: `${files.length} photo(s) added.` })
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }, [uploadPhoto, toast])

  const handleDelete = async (photoId: string) => {
    try {
      await deletePhoto(photoId)
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" })
    }
  }

  const handleUpdate = async (photoId: string, updates: { caption?: string; isCover?: boolean }) => {
    try {
      await updatePhoto(photoId, updates)
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-[2rem] p-8 overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight">
            Manage Photos — {facilityName || "Facility"}
          </DialogTitle>
        </DialogHeader>

        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-colors",
            dragOver ? "border-primary bg-primary/5" : "border-border/50"
          )}
        >
          <UploadCloud className="w-8 h-8 text-primary" />
          <p className="text-sm font-medium">Drag & drop photos here or click to browse</p>
          <p className="text-xs text-muted-foreground">Auto-compressed to WebP (&lt;500KB) in your browser</p>
          {uploading && <p className="text-xs text-primary flex items-center gap-1.5 mt-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</p>}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Gallery Thumbnails ({photos.length})
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : photos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No photos yet. Upload one above.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {photos.map(photo => (
                <div key={photo.id} className="rounded-xl border border-border/50 overflow-hidden">
                  <div className="relative h-28 bg-muted">
                    <img src={photo.publicUrl} alt={photo.caption || ""} className="w-full h-full object-cover" />
                    {photo.isCover && (
                      <span className="absolute top-1.5 left-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3 fill-white" /> Cover
                      </span>
                    )}
                  </div>
                  <div className="p-2 space-y-1.5">
                    <Input
                      defaultValue={photo.caption || ""}
                      placeholder="Caption…"
                      className="h-8 text-xs rounded-lg"
                      onBlur={e => {
                        if (e.target.value !== (photo.caption || "")) handleUpdate(photo.id, { caption: e.target.value })
                      }}
                    />
                    <div className="flex gap-1.5">
                      {!photo.isCover && (
                        <Button size="sm" variant="outline" className="h-7 flex-1 text-[10px] px-1" onClick={() => handleUpdate(photo.id, { isCover: true })}>
                          <Star className="w-3 h-3 mr-1" /> Set Cover
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 text-[10px] px-1 text-rose-500 hover:bg-rose-50" onClick={() => handleDelete(photo.id)}>
                        <Trash2 className="w-3 h-3 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
