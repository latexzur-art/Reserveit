'use client'

import { Suspense, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { ScheduleReviewWorkspace } from '@/components/schedule/review/ScheduleReviewWorkspace'
import { EditEntryModal } from '../_components/EditEntryModal'
import { ROUTES } from '@/lib/routes'

function ProgramScheduleReviewInner() {
  const params = useParams()
  const uploadId = params?.uploadId as string

  const handleSubmit = useCallback(async () => {
    const res = await fetch(`/api/schedules/uploads/${uploadId}/submit`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Submit failed')
  }, [uploadId])

  return (
    <ScheduleReviewWorkspace
      uploadId={uploadId}
      backHref={ROUTES.program.schedulesUploads}
      capabilities={{ canSubmit: true }}
      filterMode="validation"
      onSubmit={handleSubmit}
      renderEditModal={(entry, id, onClose) => (
        <EditEntryModal
          entry={entry}
          uploadId={id}
          onClose={() => onClose()}
          onSaved={() => onClose(true)}
        />
      )}
    />
  )
}

export default function ProgramScheduleReviewPage() {
  return (
    <Suspense>
      <ProgramScheduleReviewInner />
    </Suspense>
  )
}
