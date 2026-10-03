import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/hooks/academic-head/useScheduleUploads', () => ({
  useScheduleEntries: () => ({
    entries: [],
    loading: false,
    refetch: vi.fn(),
    batchReview: vi.fn(),
    reviewEntry: vi.fn(),
    patchEntry: vi.fn(),
    deleteEntry: vi.fn(),
    editEntry: vi.fn(),
    splitEntry: vi.fn(),
  }),
  useScheduleUploads: () => ({
    uploads: [
      { id: 'upload-1', upload_status: 'draft', review_notes: null },
    ],
  }),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))
vi.mock('@/lib/routes', () => ({
  ROUTES: {
    program: { schedulesUploads: '/program/schedules/uploads' },
    academic: { schedulesReview: '/academic/schedules/review' },
  },
}))

import { ScheduleReviewWorkspace } from '@/components/schedule/review/ScheduleReviewWorkspace'

describe('ScheduleReviewWorkspace — canSubmit mode', () => {
  it('shows Submit for Review button when capabilities.canSubmit is true', () => {
    render(
      <ScheduleReviewWorkspace
        uploadId="upload-1"
        backHref="/program/schedules/uploads"
        capabilities={{ canSubmit: true }}
        filterMode="validation"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />
    )
    expect(screen.getByRole('button', { name: /submit for review/i })).toBeInTheDocument()
  })

  it('does not show Submit for Review button in default review mode', () => {
    render(
      <ScheduleReviewWorkspace
        uploadId="upload-1"
        backHref="/academic/schedules/review"
        capabilities={{ canPublish: true, canRollback: true }}
      />
    )
    expect(screen.queryByRole('button', { name: /submit for review/i })).not.toBeInTheDocument()
  })

  it('shows validation filter tabs when filterMode is validation', () => {
    render(
      <ScheduleReviewWorkspace
        uploadId="upload-1"
        backHref="/program/schedules/uploads"
        capabilities={{ canSubmit: true }}
        filterMode="validation"
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /^conflicts/i })).toBeInTheDocument()
  })
})
