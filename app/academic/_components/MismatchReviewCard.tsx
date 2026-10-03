'use client'

import { useState, useEffect } from 'react'
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  ArrowRightLeft, 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  MapPin, 
  Calendar, 
  Clock, 
  Users,
  Info,
  Building2,
  Activity,
  MessageSquare,
  Check,
  X
} from 'lucide-react'
import { Gauge } from 'lucide-react'
import type { MismatchReviewItem, ReviewAction } from '@/hooks/academic-head/useMismatchReviews'
import { cn } from '@/lib/utils'
import { formatEnumLabel } from '@/lib/enum-labels'

interface MismatchReviewCardProps {
  review: MismatchReviewItem
  submitting: boolean
  onSubmit: (action: ReviewAction, options?: { alternativeFacilityId?: string; reviewerNotes?: string; alternativeDate?: string; alternativeStartTime?: string; alternativeEndTime?: string }) => void
  // L2: batch-approve selection — only offered for approve-eligible ('flagged') rows.
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}

interface AvailableFacility {
  id: string
  name: string
  room_number: string | null
  floor_number: number | null
  building_name: string | null
  is_available: boolean
  conflict_reason: string | null
}

const PURPOSE_LABELS: Record<string, string> = {
  academic: 'Academic / Class',
  school_event: 'School Event',
  department_use: 'Department Use',
  personal: 'Personal',
  commercial: 'Commercial',
  community: 'Community',
}

export function MismatchReviewCard({ review, submitting, onSubmit, selectable, selected, onToggleSelect }: MismatchReviewCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [selectedAlt, setSelectedAlt] = useState(review.suggestedAlternative?.id ?? '')
  const [notes, setNotes] = useState('')
  const [pendingAction, setPendingAction] = useState<ReviewAction | null>(null)

  const [altDate, setAltDate] = useState(review.bookingDate ?? '')
  const [altStartTime, setAltStartTime] = useState(review.startTime?.slice(0, 5) ?? '')
  const [altEndTime, setAltEndTime] = useState(review.endTime?.slice(0, 5) ?? '')
  const [availableFacilities, setAvailableFacilities] = useState<AvailableFacility[]>([])
  const [loadingAvail, setLoadingAvail] = useState(false)

  useEffect(() => {
    if (!altDate || !altStartTime || !altEndTime) {
      setAvailableFacilities([])
      return
    }
    setLoadingAvail(true)
    fetch(`/api/academic-head/available-facilities?date=${altDate}&start_time=${altStartTime}&end_time=${altEndTime}`)
      .then(r => r.ok ? r.json() : { facilities: [] })
      .then(d => setAvailableFacilities(d.facilities ?? []))
      .catch(() => setAvailableFacilities([]))
      .finally(() => setLoadingAvail(false))
  }, [altDate, altStartTime, altEndTime])

  const facilityDisplay = review.facility
    ? `${review.facility.name}${review.facility.room_number ? ` (${review.facility.room_number})` : ''}`
    : 'Unknown Facility'

  const isPendingResponse = review.currentStatus === 'pending_faculty_response'

  const handleAction = (action: ReviewAction) => {
    if (action === 'suggest_alternative' && !selectedAlt) return
    setPendingAction(action)
    onSubmit(action, {
      alternativeFacilityId: action === 'suggest_alternative' ? selectedAlt : undefined,
      reviewerNotes: notes.trim() || undefined,
      alternativeDate: action === 'suggest_alternative' ? altDate || undefined : undefined,
      alternativeStartTime: action === 'suggest_alternative' ? (altStartTime ? altStartTime.slice(0, 5) : undefined) : undefined,
      alternativeEndTime: action === 'suggest_alternative' ? (altEndTime ? altEndTime.slice(0, 5) : undefined) : undefined,
    })
  }

  return (
    <div className="bg-white dark:bg-[#0B0F17] rounded-[1.5rem] border border-slate-200 dark:border-white/[0.08] shadow-sm overflow-hidden transition-all duration-300">
      
      {/* ── HEADER ── */}
      <div className={cn(
        "flex w-full items-center transition-colors",
        expanded ? "bg-slate-50 dark:bg-white/[0.03]" : "hover:bg-slate-50 dark:hover:bg-white/[0.02]"
      )}>
        {selectable && (
          <button
            type="button"
            role="checkbox"
            aria-checked={!!selected}
            aria-label={`Select ${review.referenceNumber} for batch approval`}
            onClick={onToggleSelect}
            className={cn(
              "shrink-0 ml-4 md:ml-5 w-4 h-4 rounded border flex items-center justify-center transition-colors",
              selected
                ? "bg-emerald-600 border-emerald-600"
                : "border-slate-300 dark:border-white/20 hover:border-emerald-500"
            )}
          >
            {selected && <CheckCircle className="w-3 h-3 text-white" />}
          </button>
        )}
        <button
          type="button"
          aria-expanded={expanded}
          className="flex flex-1 min-w-0 items-center justify-between p-4 md:p-5 cursor-pointer text-left appearance-none bg-transparent border-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset"
          onClick={() => setExpanded(!expanded)}
        >
        <div className="flex items-center gap-4 min-w-0">
          <div className="p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white truncate">
                {review.facultyName}
              </h3>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase">
                {review.department}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest truncate">
              {facilityDisplay} · Ref #{review.referenceNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {review.reviewedBy && (
            <span className={cn(
              "hidden sm:inline-block px-2 py-0.5 rounded-md border text-xs font-semibold uppercase",
              review.reviewedBy.role === 'building_admin'
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20"
            )}>
              Reviewed by {review.reviewedBy.role === 'building_admin' ? 'Building Admin' : 'Academic Head'}
            </span>
          )}
          {isPendingResponse && (
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 text-xs font-semibold uppercase">
              Awaiting Response
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
        </button>
      </div>

      {expanded && (
        <div className="p-4 md:p-6 space-y-6 border-t border-slate-100 dark:border-white/5 animate-in slide-in-from-top-2 duration-300">
          
          {/* ── METADATA GRID ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Calendar, val: review.bookingDate, label: 'Date' },
              { icon: Clock, val: `${review.startTime?.slice(0, 5)} - ${review.endTime?.slice(0, 5)}`, label: 'Reserved Time' },
              { icon: Building2, val: facilityDisplay, label: 'Location' },
              { icon: Activity, val: PURPOSE_LABELS[review.bookingPurpose] || review.bookingPurpose, label: 'Declared Purpose' }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-50 dark:bg-white/[0.02] p-3 rounded-xl border border-slate-200 dark:border-white/5">
                <item.icon className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{item.label}</p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{item.val}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── L4: WHY FLAGGED / RECOMMENDED ACTION ── */}
          {review.scoreBreakdown && (
            <div className="p-4 rounded-2xl bg-slate-500/[0.03] border border-slate-500/10">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Gauge className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Why Flagged</span>
                </div>
                {review.scoreBreakdown.finalScore !== null && (
                  <span className={cn(
                    "text-[10px] font-black px-2 py-0.5 rounded-md border uppercase",
                    review.scoreBreakdown.finalScore >= 80
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : review.scoreBreakdown.finalScore < 35
                        ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                        : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20"
                  )}>
                    Score {review.scoreBreakdown.finalScore}/100
                  </span>
                )}
              </div>

              {review.scoreBreakdown.decisionReason && (
                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-2">
                  {review.scoreBreakdown.decisionReason}
                </p>
              )}

              {review.scoreBreakdown.adjustments.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {[...review.scoreBreakdown.adjustments]
                    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
                    .slice(0, 4)
                    .map((adj) => (
                      <span
                        key={adj.code}
                        title={adj.reason}
                        className={cn(
                          "text-[9px] font-bold px-2 py-0.5 rounded-md border",
                          adj.points >= 0
                            ? "bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 border-emerald-500/15"
                            : "bg-red-500/5 text-red-700 dark:text-red-400 border-red-500/15"
                        )}
                      >
                        {adj.points > 0 ? '+' : ''}{adj.points} {adj.name}
                      </span>
                    ))}
                </div>
              )}

              {review.mismatchFlag && (
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-2">
                  Flag: {formatEnumLabel(review.mismatchFlag)}
                </p>
              )}
            </div>
          )}

          {/* ── JUSTIFICATION & STATUS ── */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 p-4 rounded-2xl bg-orange-500/[0.03] border border-orange-500/10">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Faculty Justification</span>
              </div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed italic">
                "{review.mismatchJustification || 'No specific justification recorded.'}"
              </p>
            </div>

            {review.suggestedAlternative && (
              <div className="flex-1 p-4 rounded-2xl bg-primary/5 border border-primary/10">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary uppercase tracking-widest">Active Proposal</span>
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {review.suggestedAlternative.name} {review.suggestedAlternative.room_number && `(${review.suggestedAlternative.room_number})`}
                </p>
                <p className="text-xs font-semibold text-slate-400 uppercase mt-1 tracking-wider italic">Faculty status: Pending response</p>
              </div>
            )}
          </div>

          {/* ── INTERACTIVE TERMINAL ── */}
          <div className="space-y-5 pt-4 border-t border-slate-100 dark:border-white/5">
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest ml-1">Alternative Configuration</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative h-11 flex items-center">
                  <Calendar className="absolute left-4 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input type="date" value={altDate} onChange={e => setAltDate(e.target.value)} className="w-full h-full pl-11 pr-4 rounded-xl bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/10 text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all" />
                </div>
                <div className="relative h-11 flex items-center">
                  <Clock className="absolute left-4 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input type="time" value={altStartTime} onChange={e => setAltStartTime(e.target.value)} className="w-full h-full pl-11 pr-4 rounded-xl bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/10 text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all" />
                </div>
                <div className="relative h-11 flex items-center">
                  <Clock className="absolute left-4 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input type="time" value={altEndTime} onChange={e => setAltEndTime(e.target.value)} className="w-full h-full pl-11 pr-4 rounded-xl bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/10 text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {loadingAvail ? (
                <div className="h-11 flex items-center justify-center bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-dashed border-slate-200 dark:border-white/10">
                  <Loader2 className="w-4 h-4 animate-spin text-primary mr-2" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Scanning Grid...</span>
                </div>
              ) : (
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <select
                    value={selectedAlt}
                    onChange={e => setSelectedAlt(e.target.value)}
                    className="w-full h-11 pl-11 pr-10 rounded-xl bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/10 text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none transition-all cursor-pointer"
                  >
                    <option value="">— Choose Available Alternative —</option>
                    {availableFacilities.map(f => (
                      <option key={f.id} value={f.id} disabled={!f.is_available}>
                        {f.is_available ? '✓' : '✗'} {f.name} {f.room_number && `(Room ${f.room_number})`} {!f.is_available ? `[CONFLICT]` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest ml-1">Decision Memo</label>
              <div className="relative group">
                <MessageSquare className="absolute left-4 top-4 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Record justification for approval/decline or message to faculty..."
                  className="w-full pl-11 pr-4 py-4 rounded-2xl bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/10 text-xs font-medium dark:text-white outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* ── ACTION CENTER ── */}
          {!isPendingResponse && (
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
              <button
                onClick={() => handleAction('approve')}
                disabled={submitting}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {submitting && pendingAction === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Approve Use
              </button>

              <button
                onClick={() => handleAction('suggest_alternative')}
                disabled={submitting || !selectedAlt}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {submitting && pendingAction === 'suggest_alternative' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                Propose Alt
              </button>

              <button
                onClick={() => handleAction('decline')}
                disabled={submitting}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50"
              >
                {submitting && pendingAction === 'decline' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Decline
              </button>
            </div>
          )}

          {isPendingResponse && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5">
              <Info className="w-4 h-4 text-slate-400" />
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide italic">
                Awaiting faculty confirmation on the proposed alternative. Modifications are temporarily locked.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}