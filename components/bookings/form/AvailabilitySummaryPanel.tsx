"use client"

import { CheckCircle, AlertCircle, Clock, Loader2 } from 'lucide-react'
import type { useReservationForm } from '@/hooks/faculty/useReservationForm'
import { SuggestionCard } from './SuggestionCard'
import { BOOKING_PURPOSES, STATUS_LABELS } from './constants'
import { formatTime } from '@/lib/formatTime'

type Hook = ReturnType<typeof useReservationForm>

interface AvailabilitySummaryPanelProps {
  formData: Hook['formData']
  updateField: Hook['updateField']
  submitResult: Hook['submitResult']
  availability: Hook['availability']
  loadingAvailability: Hook['loadingAvailability']
  selectedFacility: Hook['selectedFacility']
  reset: Hook['reset']
}

export function AvailabilitySummaryPanel({
  formData,
  updateField,
  submitResult,
  availability,
  loadingAvailability,
  selectedFacility,
  reset,
}: AvailabilitySummaryPanelProps) {
  return (
            <div className="space-y-6">

              {/* Success banner */}
              {submitResult && ['auto_approved', 'flagged', 'approved', 'routed_to_manual', 'processing', 'still_processing'].includes(submitResult.status) && (() => {
                const cfg = STATUS_LABELS[submitResult.status] ?? { bg: 'bg-blue-50 dark:bg-blue-900/20', color: 'text-blue-700 dark:text-blue-300', label: 'Processing...' }
                const isStillProcessing = submitResult.status === 'still_processing'
                const isInProgress = submitResult.status === 'processing' || isStillProcessing
                return (
                  <div className={`p-4 rounded-2xl border ${cfg.bg}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {isInProgress ? (
                        <Loader2 data-testid="status-icon-processing" className={`w-5 h-5 animate-spin ${cfg.color}`} />
                      ) : (
                        <CheckCircle data-testid="status-icon-success" className={`w-5 h-5 ${cfg.color}`} />
                      )}
                      <p className={`font-semibold ${cfg.color}`}>{cfg.label}</p>
                    </div>
                    {submitResult.booking_reference && (
                      <p className="text-sm text-muted-foreground">
                        Reference: <span className="font-mono font-medium">{submitResult.booking_reference}</span>
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">
                      {isStillProcessing
                        ? 'This is taking longer than usual. Your booking is still being decided — check My Reservations shortly for the result.'
                        : 'Redirecting to your reservations...'}
                    </p>
                  </div>
                )
              })()}

              {/* Suggestions when constraint failed */}
              {submitResult?.status === 'hard_constraint_failed' && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                    <h4 className="font-semibold text-slate-900 dark:text-white">Slot Unavailable</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {submitResult.message ?? 'That time slot is not available. Try one of these alternatives:'}
                  </p>
                  {submitResult.suggestions && submitResult.suggestions.length > 0 ? (
                    <div className="space-y-3">
                      {submitResult.suggestions.map((s, i) => (
                        <SuggestionCard
                          key={i}
                          suggestion={s}
                          onSelect={() => {
                            if (s.type === 'room' && s.facility_id) updateField('facility_id', s.facility_id)
                            if (s.start_time) updateField('start_time', s.start_time)
                            if (s.date) updateField('booking_date', s.date)
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No alternatives found. Try a different date.</p>
                  )}
                  <button onClick={reset} className="mt-4 text-sm text-primary underline">
                    Start over
                  </button>
                </div>
              )}

              {/* Blocked Time Ranges */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4 min-h-[200px]">
                <h4 className="text-sm font-medium text-muted-foreground dark:text-slate-400 mb-3">Availability Info</h4>

                {!formData.facility_id || !formData.booking_date ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-center">
                    <Clock className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-sm">Select a facility and date<br />to see availability</p>
                  </div>
                ) : loadingAvailability ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : availability ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground mb-2">
                      Operating hours: {formatTime(availability.operating_hours.open)} – {formatTime(availability.operating_hours.close)}
                    </p>
                    {availability.blocked_ranges.length > 0 ? (
                      <>
                        <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-1">Blocked times:</p>
                        {availability.blocked_ranges.map((block, i) => (
                          <div key={i} className="px-3 py-2 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-sm">
                            <span className="font-medium">{formatTime(block.start)} – {formatTime(block.end)}</span>
                            <span className="text-xs text-red-600 dark:text-red-400 ml-2">{block.reason}</span>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <p className="text-sm text-green-700 dark:text-green-300">All times available for this date</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    <p className="text-sm">Could not load availability. Try again.</p>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4">
                <h4 className="text-sm font-medium mb-3 text-slate-900 dark:text-white">Reservation Summary</h4>
                <div className="text-sm text-muted-foreground dark:text-slate-400 space-y-1">
                  <div className="flex justify-between py-1">
                    <span>Facility</span>
                    <span className="text-foreground dark:text-white font-medium truncate ml-4 max-w-[180px]">
                      {selectedFacility?.name ?? '—'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Date</span>
                    <span className="text-foreground dark:text-white">{formData.booking_date || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Time</span>
                    <span className="text-foreground dark:text-white">
                      {formData.start_time && formData.end_time
                        ? `${formatTime(formData.start_time)} – ${formatTime(formData.end_time)}`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Attendees</span>
                    <span className="text-foreground dark:text-white">{formData.expected_attendees || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Purpose</span>
                    <span className="text-foreground dark:text-white capitalize">
                      {BOOKING_PURPOSES.find(p => p.value === formData.booking_purpose)?.label ?? '—'}
                    </span>
                  </div>
                  {formData.event_name && (
                    <div className="flex justify-between py-1">
                      <span>Event Name</span>
                      <span className="text-foreground dark:text-white truncate ml-4 max-w-[180px]">{formData.event_name}</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
  )
}
