'use client'

/**
 * BatchMetadataForm — Term, department, and effective date selection for schedule uploads.
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Building2, BookOpen, Loader2, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BatchMetadata {
    academic_term_id: string
    department_id: string
    effective_start: string
    effective_end: string
    notes?: string
}

interface BatchMetadataFormProps {
    value: BatchMetadata
    onChange: (meta: BatchMetadata) => void
    className?: string
}

export function BatchMetadataForm({ value, onChange, className }: BatchMetadataFormProps) {
    const supabase = createClient()
    const [terms, setTerms] = useState<{ id: string; term_name: string; academic_year: string; term_type: string; start_date: string | null; end_date: string | null }[]>([])
    const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            const [termsRes, deptsRes] = await Promise.all([
                supabase.from('academic_terms').select('id, term_name, academic_year, term_type, start_date, end_date').in('term_type', ['first_semester', 'second_semester']).order('academic_year', { ascending: false }),
                supabase.from('departments').select('id, name').order('name'),
            ])
            setTerms(termsRes.data ?? [])
            setDepartments(deptsRes.data ?? [])
            setLoading(false)
        }
        load()
    }, [supabase])

    const update = (field: keyof BatchMetadata, val: string) => {
        onChange({ ...value, [field]: val })
    }

    const handleTermChange = (termId: string) => {
        const selected = terms.find(t => t.id === termId)
        onChange({
            ...value,
            academic_term_id: termId,
            effective_start: selected?.start_date ?? value.effective_start,
            effective_end: selected?.end_date ?? value.effective_end,
        })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 text-ah-sti-cyan animate-spin" />
            </div>
        )
    }

    return (
        <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4', className)}>
            {/* Academic Term */}
            <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1.5">
                    <BookOpen className="h-3.5 w-3.5" /> Academic Term <span className="text-red-400">*</span>
                </label>
                <select
                    value={value.academic_term_id}
                    onChange={e => handleTermChange(e.target.value)}
                    className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors"
                >
                    <option value="">Select term...</option>
                    {terms.map(t => (
                        <option key={t.id} value={t.id}>{t.term_name} ({t.academic_year})</option>
                    ))}
                </select>
            </div>

            {/* Department */}
            <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1.5">
                    <Building2 className="h-3.5 w-3.5" /> Department
                </label>
                <select
                    value={value.department_id}
                    onChange={e => update('department_id', e.target.value)}
                    className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors"
                >
                    <option value="">All departments</option>
                    {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                </select>
            </div>

            {/* Effective Start */}
            <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Effective From
                </label>
                <input
                    type="date"
                    value={value.effective_start}
                    onChange={e => update('effective_start', e.target.value)}
                    className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors"
                />
            </div>

            {/* Effective End */}
            <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Effective Until
                </label>
                <input
                    type="date"
                    value={value.effective_end}
                    onChange={e => update('effective_end', e.target.value)}
                    className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors"
                />
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1.5">
                    <FileText className="h-3.5 w-3.5" /> Notes (Optional)
                </label>
                <input
                    type="text"
                    value={value.notes || ''}
                    onChange={e => update('notes', e.target.value)}
                    placeholder="E.g., Second batch of adjustments for CS 1st Year..."
                    className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors placeholder:text-muted-foreground"
                />
            </div>
        </div>
    )
}
