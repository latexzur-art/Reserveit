'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Loader2, CheckCircle2, XCircle, Clock, MapPin, AlertTriangle, History, Pencil, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { Users } from 'lucide-react'
import { ProfessorPicker } from './ProfessorPicker'
import { FacultyDirectory } from './FacultyDirectory'
import { Faculty, fmtSlot, clashingBlock, HARD_CONFLICT_SOURCES } from './types'

interface Item {
  id: string
  class_schedule_id: string
  proposed_instructor_id: string | null
  proposed_instructor_name: string
  status: 'pending' | 'approved' | 'rejected' | 'conflict'
  conflict_details: { reason?: string; conflicting_course?: string; conflicting_section?: string } | null
  schedule: {
    id: string
    course_code: string
    course_name: string
    section: string
    session_type: string | null
    day_of_week: number
    start_time: string
    end_time: string
    facilities: { name: string; room_number: string } | null
  } | null
}

interface Lineup {
  id: string
  status: string
  review_notes: string | null
  created_at: string
  creator: { id: string; full_name: string } | null
  departments: { id: string; name: string } | null
  items: Item[]
}

export function AssignmentLineupReview() {
  const [lineups, setLineups] = useState<Lineup[]>([])
  const [faculty, setFaculty] = useState<Faculty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<string | null>(null) // item id being overridden

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/schedules/assignments?status=pending')
      .then((r) => r.json())
      .then((d) => {
        setLineups(d.lineups ?? [])
        setError(null)
      })
      .catch(() => setError('Failed to load lineups'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    fetch('/api/faculty/availability')
      .then((r) => r.json())
      .then((d) => setFaculty(d.faculty ?? []))
      .catch(() => {})
  }, [load])

  // Count items that would be skipped on approval. Matches the RPC exactly:
  // only confirmed teaching overlaps are hard conflicts (a prof's own pending
  // proposal and soft bookings do not skip), so this never false-flags.
  const itemConflict = (it: Item) => {
    if (!it.schedule || !it.proposed_instructor_id) return null
    const f = faculty.find((x) => x.id === it.proposed_instructor_id)
    return f
      ? clashingBlock(f, it.schedule.day_of_week, it.schedule.start_time, it.schedule.end_time, HARD_CONFLICT_SOURCES)
      : null
  }
  const conflictCount = (lineup: Lineup) => lineup.items.filter((it) => !!itemConflict(it)).length

  const overrideItem = async (lineupId: string, item: Item, id: string | null, name: string) => {
    await fetch(`/api/schedules/assignments/review/${lineupId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: item.id, proposed_instructor_id: id, proposed_instructor_name: name }),
    })
    setLineups((prev) =>
      prev.map((l) =>
        l.id !== lineupId
          ? l
          : {
              ...l,
              items: l.items.map((it) =>
                it.id === item.id
                  ? { ...it, proposed_instructor_id: id, proposed_instructor_name: name, status: 'pending', conflict_details: null }
                  : it
              ),
            }
      )
    )
    setEditing(null)
  }

  const act = async (id: string, action: 'approve' | 'reject') => {
    if (action === 'reject' && (!notes[id] || notes[id].trim().length < 5)) {
      setActionError((p) => ({ ...p, [id]: 'Rejection requires notes (min 5 chars)' }))
      return
    }
    setActing(id)
    setActionError((p) => ({ ...p, [id]: '' }))
    try {
      const res = await fetch(`/api/schedules/assignments/review/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes: notes[id] || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionError((p) => ({ ...p, [id]: data.error || 'Action failed' }))
        return
      }
      setLineups((prev) => prev.filter((l) => l.id !== id))
    } catch {
      setActionError((p) => ({ ...p, [id]: 'Network error' }))
    } finally {
      setActing(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1].map((i) => <div key={i} className="h-48 rounded-3xl bg-slate-100 dark:bg-white/[0.04] animate-pulse" />)}
      </div>
    )
  }
  if (error) {
    return <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center text-red-500 text-sm font-semibold">{error}</div>
  }

  const refetchAll = () => {
    load()
    fetch('/api/faculty/availability')
      .then((r) => r.json())
      .then((d) => setFaculty(d.faculty ?? []))
  }

  const directory = (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
        <Users className="h-4 w-4" />
        Faculty directory — {faculty.length} professor{faculty.length === 1 ? '' : 's'} and their subjects
      </div>
      <FacultyDirectory faculty={faculty} onRefresh={refetchAll} />
    </div>
  )

  if (lineups.length === 0) {
    return (
      <div className="space-y-4">
        {directory}
        <div className="bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/[0.06] rounded-[2rem] p-20 text-center">
          <div className="p-4 bg-emerald-500/10 rounded-full w-fit mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No lineups awaiting review</p>
          <p className="text-xs text-slate-400 mt-1">Program-head assignment proposals show up here for approval.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {directory}
      {lineups.map((l) => {
        const conflicts = conflictCount(l)
        const isActioning = acting === l.id
        return (
          <div key={l.id} className="bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/[0.06] rounded-3xl p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {l.creator?.full_name ?? 'Unknown'} · {l.departments?.name ?? 'N/A'}
                </span>
                <span className="text-xs text-slate-400">{l.items.length} assignment{l.items.length === 1 ? '' : 's'}</span>
              </div>
              <span className="text-xs font-medium text-slate-400">
                {new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="space-y-2">
              {l.items.map((it) => {
                const busy = itemConflict(it)
                const isEditing = editing === it.id
                return (
                  <div key={it.id} className="rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-black/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {it.schedule?.course_code} · {it.schedule?.section}
                        </p>
                        {it.schedule && (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtSlot(it.schedule.day_of_week, it.schedule.start_time, it.schedule.end_time)}</span>
                            {it.schedule.facilities && (
                              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{it.schedule.facilities.name || it.schedule.facilities.room_number}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={cn('text-sm font-semibold', busy ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white')}>
                          {it.proposed_instructor_name}
                        </p>
                        <button
                          onClick={() => setEditing(isEditing ? null : it.id)}
                          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-500 hover:text-blue-600"
                        >
                          {isEditing ? <X className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                          {isEditing ? 'Close' : 'Override'}
                        </button>
                      </div>
                    </div>

                    {busy && !isEditing && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        Busy: {busy.label} ({fmtSlot(busy.day_of_week, busy.start_time, busy.end_time)}) — will be skipped on approval
                      </p>
                    )}

                    {isEditing && it.schedule && (
                      <div className="mt-3">
                        <ProfessorPicker
                          faculty={faculty}
                          dayOfWeek={it.schedule.day_of_week}
                          startTime={it.schedule.start_time}
                          endTime={it.schedule.end_time}
                          value={it.proposed_instructor_id}
                          valueName={it.proposed_instructor_name}
                          busySources={HARD_CONFLICT_SOURCES}
                          onChange={(id, name) => overrideItem(l.id, it, id, name)}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {conflicts > 0 && (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                {conflicts} of {l.items.length} will be skipped (instructor busy). Override or approve the rest.
              </p>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 pt-4 mt-4 border-t border-slate-100 dark:border-white/5">
              <div className="flex-1">
                <Textarea
                  placeholder="Review notes (required to reject)…"
                  value={notes[l.id] || ''}
                  onChange={(e) => setNotes((p) => ({ ...p, [l.id]: e.target.value }))}
                  className="min-h-[64px] bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/[0.06] rounded-2xl text-sm"
                />
                {actionError[l.id] && <p className="text-xs text-red-500 font-semibold mt-1">{actionError[l.id]}</p>}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => act(l.id, 'reject')}
                  disabled={isActioning}
                  className="h-10 px-5 border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wide"
                >
                  {isActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
                  Reject
                </Button>
                <Button
                  onClick={() => act(l.id, 'approve')}
                  disabled={isActioning}
                  className="h-10 px-5 bg-[#050d36] dark:bg-emerald-600 hover:bg-[#050d36]/90 dark:hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wide"
                >
                  {isActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                  {conflicts > 0 ? `Approve ${l.items.length - conflicts}` : 'Approve'}
                </Button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
