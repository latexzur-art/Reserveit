'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Plus, Trash2, ArrowRightLeft, MapPin } from 'lucide-react'
import { useState } from 'react'
import type { FacilityAssignmentSummary } from '@/backend/admin/building/building.types'
import { AssignFacilityDialog } from '../AssignFacilityDialog'
import { ReassignFacilityDialog } from '../ReassignFacilityDialog'

interface Props {
  staffId: string
  assignments: FacilityAssignmentSummary[]
  loading: boolean
  onUnassign: (assignmentId: string) => Promise<void>
  onAssigned: () => void
  onReassigned: () => void
}

export function AssignmentsTab({ staffId, assignments, loading, onUnassign, onAssigned, onReassigned }: Props) {
  const [assignOpen, setAssignOpen] = useState(false)
  const [reassignTarget, setReassignTarget] = useState<FacilityAssignmentSummary | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const handleUnassign = async (a: FacilityAssignmentSummary) => {
    setRemovingId(a.assignmentId)
    await onUnassign(a.assignmentId)
    setRemovingId(null)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {assignments.length} facility{assignments.length !== 1 ? 'ies' : ''} assigned
        </p>
        <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Assign Facility
        </Button>
      </div>

      {!assignments.length ? (
        <p className="text-sm text-muted-foreground text-center py-6">No facilities assigned yet.</p>
      ) : (
        <ScrollArea className="h-56">
          <div className="space-y-2 pr-2">
            {assignments.map(a => (
              <div key={a.assignmentId} className="rounded-lg border border-border p-3 flex items-center gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.facilityName}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {a.facilityCode}{a.facilityRoomNumber ? ` · Room ${a.facilityRoomNumber}` : ''}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Assigned {new Date(a.assignedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-7 h-7"
                    onClick={() => setReassignTarget(a)}
                    title="Reassign to different facility"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-7 h-7 text-red-600 dark:text-red-400 hover:text-red-600 dark:hover:text-red-400"
                    onClick={() => handleUnassign(a)}
                    disabled={removingId === a.assignmentId}
                    title="Remove from facility"
                  >
                    {removingId === a.assignmentId
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />
                    }
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <AssignFacilityDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        staffId={staffId}
        existingFacilityIds={assignments.map(a => a.facilityId)}
        onSuccess={() => { setAssignOpen(false); onAssigned() }}
      />

      {reassignTarget && (
        <ReassignFacilityDialog
          open={!!reassignTarget}
          onOpenChange={open => { if (!open) setReassignTarget(null) }}
          staffId={staffId}
          fromFacility={reassignTarget}
          onSuccess={() => { setReassignTarget(null); onReassigned() }}
        />
      )}
    </div>
  )
}
