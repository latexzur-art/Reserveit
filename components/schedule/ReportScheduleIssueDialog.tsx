'use client'

import { useState, useEffect, useRef } from 'react'
import { AlertTriangle, Camera, Loader2, Upload, X } from 'lucide-react'
import imageCompression from 'browser-image-compression'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { scheduleIssueCategoryLabel } from '@/lib/enum-labels'
import { useToast } from '@/hooks/use-toast'
import {
  SCHEDULE_ISSUE_CATEGORIES,
  buildScheduleReportPayload,
  type ScheduleReportCategory,
} from '@/lib/schedule/report-form'
import type { ScheduleEvent } from '@/hooks/shared/useMySchedules'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<string, string> = {
  wrong_room: 'Wrong Room',
  time_conflict: 'Time Conflict',
  missing_session: 'Missing Session',
  incorrect_time: 'Incorrect Time',
  instructor_mismatch: 'Instructor Mismatch',
  not_updated: 'Not Updated',
  equipment_issue: 'Equipment Issue',
  other: 'Other',
}

const ROOM_OTHER = '__other__'

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1920,
  fileType: 'image/webp' as const,
  useWebWorker: true,
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface Props {
  event: ScheduleEvent
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReportScheduleIssueDialog({ event, open, onOpenChange }: Props) {
  const [category, setCategory] = useState('')
  const [roomValue, setRoomValue] = useState('')
  const [noticedAt, setNoticedAt] = useState('')
  const [whatHappened, setWhatHappened] = useState('')
  const [whatToCorrect, setWhatToCorrect] = useState('')
  const [equipmentType, setEquipmentType] = useState('')
  const [saving, setSaving] = useState(false)
  const [attachments, setAttachments] = useState<Array<{ file: File; preview: string }>>([])
  const [uploading, setUploading] = useState(false)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const { toast } = useToast()

  // Derive facility label from event
  const facilityLabel = [event.facility, event.room ? `Room ${event.room}` : null]
    .filter(Boolean)
    .join(' · ')

  // Pre-fill room and noticedAt on open
  useEffect(() => {
    if (open) {
      setRoomValue(facilityLabel)
      setNoticedAt(new Date().toISOString().slice(0, 10))
    }
  }, [open, facilityLabel])

  const reset = () => {
    setCategory('')
    setRoomValue('')
    setNoticedAt('')
    setWhatHappened('')
    setWhatToCorrect('')
    setEquipmentType('')
    attachments.forEach((att) => URL.revokeObjectURL(att.preview))
    setAttachments([])
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (attachments.length + files.length > 5) {
      toast({ title: 'Max 5 images', variant: 'destructive' })
      return
    }
    for (const file of files) {
      try {
        const compressed = await imageCompression(file, COMPRESSION_OPTIONS)
        const preview = URL.createObjectURL(compressed)
        setAttachments((prev) => [...prev, { file: compressed, preview }])
      } catch {
        toast({
          title: 'Compression failed',
          description: 'Could not compress image.',
          variant: 'destructive',
        })
      }
    }
    e.target.value = ''
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const submit = async () => {
    if (!category || !whatHappened) return
    setSaving(true)

    // Resolve facility ID from the raw event data
    let facilityId: string | undefined
    if (event.type === 'class') {
      facilityId = (event.raw as { facility?: { id?: string } })?.facility?.id
    }

    const payload = buildScheduleReportPayload({
      scheduleType: event.type === 'class' ? 'class_schedule' : 'reservation',
      scheduleId: event.id,
      category: category as ScheduleReportCategory,
      whatHappened,
      whatToCorrect: whatToCorrect || undefined,
      noticedAt: noticedAt || undefined,
      facilityId,
      facilityName: event.facility,
      courseCode: event.courseCode,
      section: event.section,
      startTime: event.start_time,
      endTime: event.end_time,
      dayOfWeek: String(event.day_of_week),
      scheduleDate: event.date,
      equipmentType: equipmentType || undefined,
    })

    try {
      const res = await fetch('/api/schedule-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        const reportId = data.id ?? data.report_id

        // Upload attachments if any
        if (reportId && attachments.length > 0) {
          setUploading(true)
          for (const att of attachments) {
            const formData = new FormData()
            formData.append('file', att.file)
            await fetch(`/api/schedule-reports/${reportId}/attachments`, {
              method: 'POST',
              body: formData,
            }).catch(() => {})
          }
          setUploading(false)
        }

        toast({
          title: 'Report submitted',
          description: 'The building admin will review it.',
        })
        reset()
        onOpenChange(false)
      } else {
        const d = await res.json().catch(() => ({}))
        toast({
          title: 'Error',
          description: d.error || 'Submit failed',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Network error — please try again',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) reset()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report a schedule issue</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Category */}
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULE_ISSUE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORY_LABELS[cat] ?? scheduleIssueCategoryLabel(cat)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {category === 'equipment_issue' && (
            <div className="space-y-1.5">
              <Label>What type of equipment?</Label>
              <Select value={equipmentType} onValueChange={setEquipmentType}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select equipment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="projector">Projector</SelectItem>
                  <SelectItem value="tv">TV / Monitor</SelectItem>
                  <SelectItem value="aircon">Air Conditioning</SelectItem>
                  <SelectItem value="computer">Computer / Desktop</SelectItem>
                  <SelectItem value="laptop">Laptop</SelectItem>
                  <SelectItem value="microphone">Microphone / Speaker</SelectItem>
                  <SelectItem value="whiteboard">Whiteboard / Smart Board</SelectItem>
                  <SelectItem value="printer">Printer</SelectItem>
                  <SelectItem value="network">Network / WiFi</SelectItem>
                  <SelectItem value="lighting">Lighting</SelectItem>
                  <SelectItem value="other_equipment">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Room / Facility */}
          <div className="space-y-1.5">
            <Label>Which room / facility?</Label>
            <Select value={roomValue} onValueChange={setRoomValue}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select room" />
              </SelectTrigger>
              <SelectContent>
                {facilityLabel && (
                  <SelectItem value={facilityLabel}>{facilityLabel}</SelectItem>
                )}
                <SelectItem value={ROOM_OTHER}>Other</SelectItem>
              </SelectContent>
            </Select>
            {roomValue === ROOM_OTHER && (
              <Input
                value={roomValue === ROOM_OTHER ? '' : roomValue}
                onChange={(e) => setRoomValue(e.target.value)}
                placeholder="Type the room or facility"
                className="h-11 mt-1.5"
              />
            )}
          </div>

          {/* Noticed At */}
          <div className="space-y-1.5">
            <Label htmlFor="noticedAt">When did you notice this?</Label>
            <Input
              id="noticedAt"
              type="date"
              value={noticedAt}
              onChange={(e) => setNoticedAt(e.target.value)}
              className="h-11"
            />
          </div>

          {/* What Happened */}
          <div className="space-y-1.5">
            <Label htmlFor="whatHappened">What happened?</Label>
            <Textarea
              id="whatHappened"
              value={whatHappened}
              onChange={(e) => setWhatHappened(e.target.value)}
              placeholder="Describe the issue…"
              rows={4}
            />
          </div>

          {/* What to Correct */}
          <div className="space-y-1.5">
            <Label htmlFor="whatToCorrect">What should be corrected? (optional)</Label>
            <Textarea
              id="whatToCorrect"
              value={whatToCorrect}
              onChange={(e) => setWhatToCorrect(e.target.value)}
              placeholder="Suggested fix…"
              rows={3}
            />
          </div>

          {/* Attach Photos */}
          <div className="space-y-1.5">
            <Label>Attach Photos (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Take a photo or upload from device. Max 5 images, auto-compressed.
            </p>

            {/* Preview grid */}
            {attachments.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {attachments.map((att, i) => (
                  <div key={att.preview} className="relative rounded-lg overflow-hidden border border-border/50">
                    <img
                      src={att.preview}
                      alt={`Attachment ${i + 1}`}
                      className="w-full h-24 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeAttachment(i)}
                      className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 hover:bg-background transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload buttons */}
            {attachments.length < 5 && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 h-11 border-2 border-dashed border-border/50 rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  Take Photo
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 h-11 border-2 border-dashed border-border/50 rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Upload from Gallery
                </button>
              </div>
            )}

            {/* Hidden file inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Upload spinner */}
            {uploading && (
              <p className="text-xs text-primary flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading attachments…
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              reset()
            }}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={saving || uploading || !category || !whatHappened}
          >
            {(saving || uploading) && <Loader2 size={16} className="mr-1.5 animate-spin" />}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
