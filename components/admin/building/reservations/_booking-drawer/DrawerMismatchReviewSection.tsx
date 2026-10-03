'use client'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  CheckCircle2, XCircle, Info, ShieldCheck, ArrowRightLeft, Loader2
} from 'lucide-react'
import type { BuildingBooking } from '@/backend/admin/building/building.types'
import { cn } from '@/lib/utils'
import { formatEnumLabel } from '@/lib/enum-labels'

interface DrawerMismatchReviewSectionProps {
  booking: BuildingBooking
  mismatchMode: 'approve' | 'decline' | 'suggest_alternative' | null
  setMismatchMode: (mode: 'approve' | 'decline' | 'suggest_alternative' | null) => void
  mismatchNotes: string
  setMismatchNotes: (v: string) => void
  mismatchAltFacilityId: string
  setMismatchAltFacilityId: (v: string) => void
  mismatchAltDate: string
  setMismatchAltDate: (v: string) => void
  mismatchAltStart: string
  setMismatchAltStart: (v: string) => void
  mismatchAltEnd: string
  setMismatchAltEnd: (v: string) => void
  mismatchFacilities: { id: string; name: string; room_number: string | null }[]
  mismatchSubmitting: boolean
  mismatchError: string | null
  setMismatchError: (v: string | null) => void
  altAvailBlocked: { start: string; end: string; reason: string }[]
  setAltAvailBlocked: (v: { start: string; end: string; reason: string }[]) => void
  altAvailLoading: boolean
  altConflict: { available: boolean; conflicts: string[] } | null
  setAltConflict: (v: { available: boolean; conflicts: string[] } | null) => void
  altConflictChecking: boolean
  onMismatchSubmit: () => Promise<void>
}

export function DrawerMismatchReviewSection({
  booking,
  mismatchMode,
  setMismatchMode,
  mismatchNotes,
  setMismatchNotes,
  mismatchAltFacilityId,
  setMismatchAltFacilityId,
  mismatchAltDate,
  setMismatchAltDate,
  mismatchAltStart,
  setMismatchAltStart,
  mismatchAltEnd,
  setMismatchAltEnd,
  mismatchFacilities,
  mismatchSubmitting,
  mismatchError,
  setMismatchError,
  altAvailBlocked,
  setAltAvailBlocked,
  altAvailLoading,
  altConflict,
  setAltConflict,
  altConflictChecking,
  onMismatchSubmit,
}: DrawerMismatchReviewSectionProps) {
  if (!booking.mismatchFlag || !['flagged', 'pending_faculty_response'].includes(booking.currentStatus)) {
    return null
  }

  return (
    <div className="p-6 border-t border-border bg-rose-50/40 dark:bg-rose-950/20 space-y-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5" />
        Mismatch Review — {formatEnumLabel(booking.mismatchFlag)}
      </p>

      {/* Show who reviewed it (cross-role visibility) */}
      {booking.mismatchReviewedByName && (
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest",
          booking.mismatchReviewedByRole === 'academic_head'
            ? "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20"
            : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
        )}>
          <Info className="w-3.5 h-3.5 shrink-0" />
          Reviewed by {booking.mismatchReviewedByRole === 'academic_head' ? 'Academic Head' : 'Building Admin'}: {booking.mismatchReviewedByName}
        </div>
      )}

      {booking.currentStatus === 'pending_faculty_response' ? (
        <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800">
          Awaiting faculty response to the suggested alternative.
        </p>
      ) : (
        <>
          {/* Action selector */}
          {!mismatchMode && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setMismatchMode('approve')} className="flex-1 h-9 rounded-xl text-[10px] font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Approve
              </Button>
              <Button size="sm" onClick={() => setMismatchMode('suggest_alternative')} className="flex-1 h-9 rounded-xl text-[10px] font-black uppercase bg-blue-600 hover:bg-blue-700 text-white">
                <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" /> Propose Alt
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMismatchMode('decline')} className="flex-1 h-9 rounded-xl text-[10px] font-black uppercase border-red-200 text-red-600 hover:bg-red-50">
                <XCircle className="w-3.5 h-3.5 mr-1.5" /> Decline
              </Button>
            </div>
          )}

          {/* Expanded form */}
          {mismatchMode && (
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-foreground">
                {mismatchMode === 'approve' ? 'Approving booking' : mismatchMode === 'decline' ? 'Declining booking' : 'Suggesting alternative facility'}
              </p>

              {mismatchMode === 'suggest_alternative' && (
                <div className="space-y-2">
                  {/* Quick-fill presets */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMismatchAltDate(booking.bookingDate)
                        setMismatchAltStart(booking.startTime?.slice(0, 5) ?? '')
                        setMismatchAltEnd(booking.endTime?.slice(0, 5) ?? '')
                        setMismatchAltFacilityId('')
                        setAltAvailBlocked([]); setAltConflict(null)
                      }}
                      className="flex-1 h-8 px-2 rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 text-[9px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                    >
                      Same date &amp; time
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const origFac = booking.facilities?.[0]
                        if (origFac) setMismatchAltFacilityId(origFac.id)
                        setMismatchAltDate('')
                        setMismatchAltStart('')
                        setMismatchAltEnd('')
                        setAltConflict(null)
                      }}
                      className="flex-1 h-8 px-2 rounded-xl border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30 text-[9px] font-black uppercase tracking-widest text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
                    >
                      Retain facility
                    </button>
                  </div>
                  <select
                    value={mismatchAltFacilityId}
                    onChange={e => setMismatchAltFacilityId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs font-bold outline-none focus:ring-2 ring-blue-500/20"
                  >
                    <option value="">— Select Alternative Facility —</option>
                    {mismatchFacilities.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name}{f.room_number ? ` (${f.room_number})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground pt-1">
                    Proposed Date &amp; Time (optional)
                  </p>
                  <input
                    type="date"
                    value={mismatchAltDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={e => { setMismatchAltDate(e.target.value); setMismatchAltStart(''); setMismatchAltEnd('') }}
                    className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs font-bold outline-none focus:ring-2 ring-blue-500/20"
                  />
                  {/* Blocked ranges info for the selected date */}
                  {mismatchAltFacilityId && !altAvailLoading && altAvailBlocked.length > 0 && (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                        Blocked on {mismatchAltDate || booking.bookingDate}
                      </p>
                      {altAvailBlocked.map((b, i) => (
                        <p key={i} className="text-[10px] text-amber-700 dark:text-amber-300">
                          {b.start}–{b.end} &mdash; {b.reason}
                        </p>
                      ))}
                    </div>
                  )}
                  {mismatchAltFacilityId && altAvailLoading && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" /> Checking availability…
                    </p>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={mismatchAltStart}
                      onChange={e => setMismatchAltStart(e.target.value)}
                      disabled={!mismatchAltFacilityId || !mismatchAltDate}
                      placeholder="Start time"
                      className="flex-1 h-10 px-3 rounded-xl border border-border bg-background text-xs font-bold outline-none focus:ring-2 ring-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                    <input
                      type="time"
                      value={mismatchAltEnd}
                      onChange={e => setMismatchAltEnd(e.target.value)}
                      disabled={!mismatchAltFacilityId || !mismatchAltDate}
                      placeholder="End time"
                      className="flex-1 h-10 px-3 rounded-xl border border-border bg-background text-xs font-bold outline-none focus:ring-2 ring-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </div>
                  {/* Conflict check result */}
                  {altConflictChecking && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" /> Validating time slot…
                    </p>
                  )}
                  {!altConflictChecking && altConflict && (
                    altConflict.available ? (
                      <p className="text-[10px] font-black text-emerald-600 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Time slot is available
                      </p>
                    ) : (
                      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 space-y-0.5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-red-600">Conflict detected</p>
                        {altConflict.conflicts.map((c, i) => (
                          <p key={i} className="text-[10px] text-red-600">{c}</p>
                        ))}
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Before / After comparison */}
              {mismatchMode === 'suggest_alternative' && (mismatchAltFacilityId || mismatchAltDate || mismatchAltStart) && (() => {
                const origFac = booking.facilities?.[0]
                const altFac  = mismatchFacilities.find(f => f.id === mismatchAltFacilityId)
                const facChanged  = mismatchAltFacilityId && mismatchAltFacilityId !== origFac?.id
                const dateChanged = mismatchAltDate && mismatchAltDate !== booking.bookingDate
                const timeChanged = (mismatchAltStart && mismatchAltStart !== booking.startTime) || (mismatchAltEnd && mismatchAltEnd !== booking.endTime)
                return (
                  <div className="rounded-xl border border-border bg-muted/30 overflow-hidden text-[10px]">
                    <p className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground border-b border-border">
                      Proposal comparison
                    </p>
                    <div className="grid grid-cols-2 divide-x divide-border">
                      {/* Before */}
                      <div className="px-3 py-2 space-y-1.5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Before</p>
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Facility</p>
                          <p className="font-bold text-foreground leading-tight">
                            {origFac ? `${origFac.name}${origFac.roomNumber ? ` (${origFac.roomNumber})` : ''}` : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Date</p>
                          <p className="font-bold text-foreground">{booking.bookingDate || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Time</p>
                          <p className="font-bold text-foreground">{booking.startTime && booking.endTime ? `${booking.startTime}–${booking.endTime}` : '—'}</p>
                        </div>
                      </div>
                      {/* After */}
                      <div className="px-3 py-2 space-y-1.5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">After</p>
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Facility</p>
                          <p className={`font-bold leading-tight ${facChanged ? 'text-blue-600 dark:text-blue-400' : 'text-foreground'}`}>
                            {altFac ? `${altFac.name}${altFac.room_number ? ` (${altFac.room_number})` : ''}` : mismatchAltFacilityId ? '…' : (origFac ? `${origFac.name}${origFac.roomNumber ? ` (${origFac.roomNumber})` : ''}` : '—')}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Date</p>
                          <p className={`font-bold ${dateChanged ? 'text-blue-600 dark:text-blue-400' : 'text-foreground'}`}>
                            {mismatchAltDate || booking.bookingDate || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Time</p>
                          <p className={`font-bold ${timeChanged ? 'text-blue-600 dark:text-blue-400' : 'text-foreground'}`}>
                            {(mismatchAltStart || booking.startTime) && (mismatchAltEnd || booking.endTime)
                              ? `${mismatchAltStart || booking.startTime}–${mismatchAltEnd || booking.endTime}`
                              : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              <Textarea
                rows={2}
                value={mismatchNotes}
                onChange={e => setMismatchNotes(e.target.value)}
                placeholder={mismatchMode === 'decline' ? 'Reason for declining...' : 'Notes (optional)...'}
                className="rounded-xl text-xs resize-none"
              />

              {mismatchError && (
                <p className="text-[10px] text-red-600 font-bold">{mismatchError}</p>
              )}

              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setMismatchMode(null); setMismatchNotes(''); setMismatchAltFacilityId(''); setMismatchAltDate(''); setMismatchAltStart(''); setMismatchAltEnd(''); setMismatchError(null); setAltAvailBlocked([]); setAltConflict(null) }} className="flex-1 h-9 rounded-xl text-[10px] font-black uppercase">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={mismatchSubmitting}
                  onClick={onMismatchSubmit}
                  className={cn('flex-1 h-9 rounded-xl text-[10px] font-black uppercase text-white',
                    mismatchMode === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' :
                    mismatchMode === 'decline' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                  )}
                >
                  {mismatchSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm'}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
