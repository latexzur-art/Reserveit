'use client'

import { useState } from 'react'
import { DAY_FULL } from './UploadRow'
import type { ScheduleRecord, EditScheduleData } from '@/hooks/academic-head/useScheduleHistory'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

export function EditScheduleModal({
    schedule,
    onClose,
    onSave,
}: {
    schedule: ScheduleRecord
    onClose: () => void
    onSave: (id: string, data: EditScheduleData) => Promise<any>
}) {
    const [form, setForm] = useState({
        course_code: schedule.course_code,
        course_name: schedule.course_name,
        section: schedule.section,
        instructor_name: schedule.instructor_name,
        day_of_week: schedule.day_of_week,
        start_time: schedule.start_time?.slice(0, 5) ?? '',
        end_time: schedule.end_time?.slice(0, 5) ?? '',
        reason: '',
    })
    const [saving, setSaving] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            await onSave(schedule.id, {
                ...form,
                start_time: form.start_time + ':00',
                end_time: form.end_time + ':00',
            })
            onClose()
        } catch (err: any) {
            alert(err.message)
        }
        setSaving(false)
    }

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
            <DialogContent className="bg-white dark:bg-[#0a0f1e] border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">
                <DialogHeader className="space-y-0 p-6 border-b border-slate-200 dark:border-white/10 text-left">
                    <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">Edit Schedule</DialogTitle>
                    <DialogDescription className="text-sm text-slate-400">Editing will create a new version (v{(schedule.version ?? 1) + 1})</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Course Code</label>
                            <input value={form.course_code} onChange={e => setForm(p => ({ ...p, course_code: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white focus:border-ah-sti-cyan/50 focus:outline-none" required />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Section</label>
                            <input value={form.section} onChange={e => setForm(p => ({ ...p, section: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white focus:border-ah-sti-cyan/50 focus:outline-none" required />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-slate-400 mb-1.5">Course Name</label>
                        <input value={form.course_name} onChange={e => setForm(p => ({ ...p, course_name: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white focus:border-ah-sti-cyan/50 focus:outline-none" required />
                    </div>

                    <div>
                        <label className="block text-xs text-slate-400 mb-1.5">Instructor</label>
                        <input value={form.instructor_name} onChange={e => setForm(p => ({ ...p, instructor_name: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white focus:border-ah-sti-cyan/50 focus:outline-none" required />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Day</label>
                            <select value={form.day_of_week} onChange={e => setForm(p => ({ ...p, day_of_week: parseInt(e.target.value) }))} className="w-full px-3 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white focus:border-ah-sti-cyan/50 focus:outline-none">
                                {DAY_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Start</label>
                            <input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white focus:border-ah-sti-cyan/50 focus:outline-none" required />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">End</label>
                            <input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white focus:border-ah-sti-cyan/50 focus:outline-none" required />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-slate-400 mb-1.5">Reason for change</label>
                        <input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="e.g., Room reassignment" className="w-full px-3 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:border-ah-sti-cyan/50 focus:outline-none" />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-900 dark:hover:text-white">Cancel</button>
                        <button type="submit" disabled={saving} className="px-4 py-2 bg-ah-sti-cyan hover:bg-ah-sti-cyan/80 text-slate-900 dark:text-white rounded-lg text-sm font-medium disabled:opacity-50">
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
