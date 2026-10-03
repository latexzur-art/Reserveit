'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, Calendar, Clock, MapPin } from 'lucide-react'
import { DrawerStaff } from './StaffScheduleDrawer'
import { toast } from 'sonner'
import { useAcademicReservations } from '@/hooks/academic-head/useAcademicReservations'
import { useAcademicTerms } from '@/hooks/shared/useAcademicTerms'

interface Props {
  staff: DrawerStaff
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface Section {
  id: string
  course_code: string
  course_name: string
  section: string
  day_of_week: number
  start_time: string
  end_time: string
  department_id: string
  academic_term_id: string
}

export function AssignStaffClassModal({ staff, open, onOpenChange, onSuccess }: Props) {
  const { departments } = useAcademicReservations()
  const { terms: academicTerms } = useAcademicTerms()
  const [mode, setMode] = useState<'catalog' | 'custom'>('catalog')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Catalog Mode State
  const [unassignedSections, setUnassignedSections] = useState<Section[]>([])
  const [selectedSectionId, setSelectedSectionId] = useState<string>('')

  // Custom Mode State
  const [customTermId, setCustomTermId] = useState<string>('')
  const [customCourseCode, setCustomCourseCode] = useState('')
  const [customCourseName, setCustomCourseName] = useState('')
  const [customSection, setCustomSection] = useState('')
  const [customDayOfWeek, setCustomDayOfWeek] = useState<string>('1')
  const [customStartTime, setCustomStartTime] = useState('08:00')
  const [customEndTime, setCustomEndTime] = useState('09:00')

  useEffect(() => {
    if (open && mode === 'catalog') {
      fetchUnassignedSections()
    }
  }, [open, mode])

  const fetchUnassignedSections = async () => {
    setLoading(true)
    try {
      // Find the staff's department ID
      const dept = departments.find(d => d.code === staff.departmentCode)
      const qs = dept ? `?unassigned=true&department_id=${dept.id}` : '?unassigned=true'
      const res = await fetch(`/api/schedules/live${qs}`)
      const data = await res.json()
      if (res.ok) {
        setUnassignedSections(data.schedules || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleAssignCatalog = async () => {
    if (!selectedSectionId) return
    setSubmitting(true)
    try {
      // Create a lineup assignment for this section immediately approving it
      // Wait, AH can approve immediately using /api/schedules/manage/[id] PATCH to set instructor_id
      const res = await fetch(`/api/schedules/manage/${selectedSectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructor_id: staff.id,
          instructor_name: staff.name
        })
      })
      
      if (!res.ok) throw new Error('Failed to assign section')
      
      toast.success('Class assigned successfully!')
      onSuccess?.()
      onOpenChange(false)
    } catch (e) {
      toast.error('Failed to assign class')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateCustom = async () => {
    if (!customTermId || !customCourseCode || !customCourseName || !customSection || !customStartTime || !customEndTime) {
      toast.error('Please fill in all required fields')
      return
    }

    setSubmitting(true)
    try {
      const dept = departments.find(d => d.code === staff.departmentCode)
      
      const res = await fetch('/api/schedules/all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_term_id: customTermId,
          department_id: dept?.id, // Should exist
          course_code: customCourseCode,
          course_name: customCourseName,
          section: customSection,
          day_of_week: parseInt(customDayOfWeek),
          start_time: customStartTime,
          end_time: customEndTime,
          instructor_name: staff.name,
          instructor_id: staff.id,
        })
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to create schedule')
      }

      toast.success('Custom schedule created!')
      onSuccess?.()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || 'Failed to create custom schedule')
    } finally {
      setSubmitting(false)
    }
  }

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Class to {staff.name}</DialogTitle>
          <DialogDescription>
            Assign an existing unassigned section from the catalog, or create a custom schedule block.
          </DialogDescription>
        </DialogHeader>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mb-4">
          <button
            onClick={() => setMode('catalog')}
            className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${mode === 'catalog' ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            From Catalog
          </button>
          <button
            onClick={() => setMode('custom')}
            className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${mode === 'custom' ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            Custom Schedule
          </button>
        </div>

        {mode === 'catalog' && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Unassigned Sections (Department: {staff.departmentCode})</Label>
              {loading ? (
                <div className="flex items-center justify-center p-4 border rounded-md border-dashed">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400 mr-2" />
                  <span className="text-sm text-slate-500">Loading catalog...</span>
                </div>
              ) : unassignedSections.length === 0 ? (
                <div className="p-4 border rounded-md border-dashed text-center text-sm text-slate-500">
                  No unassigned sections found for this department.
                </div>
              ) : (
                <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a section to assign..." />
                  </SelectTrigger>
                  <SelectContent>
                    {unassignedSections.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.course_code} {s.section} - {s.course_name} ({days[s.day_of_week]} {s.start_time}-{s.end_time})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex justify-end pt-4">
              <Button disabled={!selectedSectionId || submitting} onClick={handleAssignCatalog}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Assign Selected
              </Button>
            </div>
          </div>
        )}

        {mode === 'custom' && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Academic Term</Label>
              <Select value={customTermId} onValueChange={setCustomTermId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select term..." />
                </SelectTrigger>
                <SelectContent>
                  {academicTerms.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.term_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Course Code</Label>
                <Input value={customCourseCode} onChange={e => setCustomCourseCode(e.target.value)} placeholder="e.g. CS101" />
              </div>
              <div className="space-y-2">
                <Label>Section</Label>
                <Input value={customSection} onChange={e => setCustomSection(e.target.value)} placeholder="e.g. A" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Course Name</Label>
              <Input value={customCourseName} onChange={e => setCustomCourseName(e.target.value)} placeholder="e.g. Intro to Programming" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Day</Label>
                <Select value={customDayOfWeek} onValueChange={setCustomDayOfWeek}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {days.map((d, i) => <SelectItem key={i} value={i.toString()}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={customStartTime} onChange={e => setCustomStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={customEndTime} onChange={e => setCustomEndTime(e.target.value)} />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button disabled={submitting} onClick={handleCreateCustom}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Custom Schedule
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
