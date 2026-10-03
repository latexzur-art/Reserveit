'use client'

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import { ScheduleReviewWorkspace } from '@/components/schedule/review/ScheduleReviewWorkspace'
import { ROUTES } from '@/lib/routes'

function ScheduleReviewDetailPageInner() {
    const params = useParams()
    const uploadId = params?.uploadId as string
    return (
        <ScheduleReviewWorkspace
            uploadId={uploadId}
            backHref={ROUTES.academic.schedulesReview}
            capabilities={{ canPublish: true, canRollback: true }}
        />
    )
}

export default function ScheduleReviewDetailPage() {
    return (
        <Suspense>
            <ScheduleReviewDetailPageInner />
        </Suspense>
    )
}
