'use client'

import { useState, useEffect } from 'react'
import { X, Calendar, Lock, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AcademicTerm, CreateTermData, TermType } from '@/hooks/shared/useAcademicTerms'

interface TermFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateTermData) => Promise<void>
  term?: AcademicTerm | null
  mode: 'create' | 'edit'
}

const TERM_TYPES: { value: TermType; label: string }[] = [
  { value: 'first_semester', label: '1st Semester' },
  { value: 'second_semester', label: '2nd Semester' },
  { value: 'summer', label: 'Summer' },
  { value: 'midyear', label: 'Midyear' },
]

export function TermFormModal({ isOpen, onClose, onSubmit, term, mode }: TermFormModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<CreateTermData & { is_schedule_locked?: boolean }>({
    term_code: '',
    term_name: '',
    academic_year: '',
    term_type: 'first_semester',
    start_date: '',
    end_date: '',
    enrollment_start: '',
    enrollment_end: '',
    exam_start: '',
    exam_end: '',
    is_active: false,
    is_schedule_locked: false,
  })

  useEffect(() => {
    if (term && mode === 'edit') {
      setFormData({
        term_code: term.term_code,
        term_name: term.term_name,
        academic_year: term.academic_year,
        term_type: term.term_type,
        start_date: term.start_date,
        end_date: term.end_date,
        enrollment_start: term.enrollment_start || '',
        enrollment_end: term.enrollment_end || '',
        exam_start: term.exam_start || '',
        exam_end: term.exam_end || '',
        is_active: term.is_active,
        is_schedule_locked: term.is_schedule_locked,
      })
    } else {
      setFormData({
        term_code: '',
        term_name: '',
        academic_year: '',
        term_type: 'first_semester',
        start_date: '',
        end_date: '',
        enrollment_start: '',
        enrollment_end: '',
        exam_start: '',
        exam_end: '',
        is_active: false,
        is_schedule_locked: false,
      })
    }
    setError(null)
  }, [term, mode, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await onSubmit(formData)
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-[#0a0f1e] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {mode === 'create' ? 'Create Academic Term' : 'Edit Academic Term'}
              </h2>
              <p className="text-sm text-slate-400">
                {mode === 'create' ? 'Add a new academic term' : 'Update term details'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Term Code <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.term_code}
                onChange={(e) => updateField('term_code', e.target.value)}
                placeholder="e.g., 2025-2026-1ST"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Term Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.term_name}
                onChange={(e) => updateField('term_name', e.target.value)}
                placeholder="e.g., 1st Semester AY 2025-2026"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Academic Year <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.academic_year}
                onChange={(e) => updateField('academic_year', e.target.value)}
                placeholder="e.g., 2025-2026"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Term Type <span className="text-red-400">*</span>
              </label>
              <select
                value={formData.term_type}
                onChange={(e) => updateField('term_type', e.target.value as TermType)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-emerald-500/50 focus:outline-none transition-colors"
                required
              >
                {TERM_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Core Dates */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Core Dates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Start Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => updateField('start_date', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-emerald-500/50 focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  End Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => updateField('end_date', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-emerald-500/50 focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>
          </div>

          {/* Optional Dates */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Optional Dates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Enrollment Start</label>
                <input
                  type="date"
                  value={formData.enrollment_start}
                  onChange={(e) => updateField('enrollment_start', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-emerald-500/50 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Enrollment End</label>
                <input
                  type="date"
                  value={formData.enrollment_end}
                  onChange={(e) => updateField('enrollment_end', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-emerald-500/50 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Exam Start</label>
                <input
                  type="date"
                  value={formData.exam_start}
                  onChange={(e) => updateField('exam_start', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-emerald-500/50 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Exam End</label>
                <input
                  type="date"
                  value={formData.exam_end}
                  onChange={(e) => updateField('exam_end', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-emerald-500/50 focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white">Status</h3>

            <label className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/10 rounded-lg cursor-pointer hover:bg-white/[0.04] transition-colors">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => updateField('is_active', e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/50"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  Set as Active Term
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  This will be the current term used throughout the system
                </p>
              </div>
            </label>

            {mode === 'edit' && (
              <label className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/10 rounded-lg cursor-pointer hover:bg-white/[0.04] transition-colors">
                <input
                  type="checkbox"
                  checked={formData.is_schedule_locked}
                  onChange={(e) => updateField('is_schedule_locked', e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-red-500 focus:ring-red-500/50"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    {formData.is_schedule_locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                    Lock Schedule Changes
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Prevent modifications to schedules for this term
                  </p>
                </div>
              </label>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button type="button" onClick={onClose} variant="ghost" disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {loading ? 'Saving...' : mode === 'create' ? 'Create Term' : 'Update Term'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
