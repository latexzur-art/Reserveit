'use client'

/**
 * Academic Terms Management
 * Manage semester schedules and academic periods.
 */

import { useState, useMemo } from 'react'
import { Plus, Calendar, AlertCircle, Trash2, Search, CheckCircle2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAcademicTerms } from '@/hooks/shared/useAcademicTerms'
import { TermsTable } from '@/components/shared/terms/TermsTable'
import { TermFormModal } from '@/components/shared/terms/TermFormModal'
import type { AcademicTerm } from '@/hooks/shared/useAcademicTerms'
import { SkeletonList } from "@/components/ui/SkeletonList"
import { toast } from 'sonner'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function AcademicTermsPage() {
  const { terms, activeTerm, loading, error, createTerm, updateTerm, deleteTerm, setActiveTerm } = useAcademicTerms()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [selectedTerm, setSelectedTerm] = useState<AcademicTerm | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [termToDelete, setTermToDelete] = useState<AcademicTerm | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const handleCreate = () => {
    setModalMode('create')
    setSelectedTerm(null)
    setModalOpen(true)
  }

  const handleEdit = (term: AcademicTerm) => {
    setModalMode('edit')
    setSelectedTerm(term)
    setModalOpen(true)
  }

  const handleDelete = (term: AcademicTerm) => {
    setTermToDelete(term)
    setDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!termToDelete) return

    try {
      await deleteTerm(termToDelete.id)
      toast.success(`Academic term "${termToDelete.term_name}" deleted.`)
      setDeleteConfirmOpen(false)
      setTermToDelete(null)
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete academic term')
    }
  }

  const handleSetActive = async (term: AcademicTerm) => {
    try {
      await setActiveTerm(term.id)
      toast.success(`"${term.term_name}" is now set as the active academic period.`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to update active term')
    }
  }

  const handleFormSubmit = async (data: any) => {
    try {
      if (modalMode === 'create') {
        await createTerm(data)
        toast.success('New academic term created.')
      } else if (selectedTerm) {
        await updateTerm(selectedTerm.id, data)
        toast.success('Academic term updated.')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save academic term')
    }
  }

  // Filter terms by search query
  const filteredTerms = useMemo(() => {
    if (!searchQuery.trim()) return terms
    const q = searchQuery.toLowerCase()
    return terms.filter(
      (t) =>
        t.term_name.toLowerCase().includes(q) ||
        t.academic_year.toLowerCase().includes(q) ||
        t.term_code.toLowerCase().includes(q)
    )
  }, [terms, searchQuery])

  // Separate filtered terms by type
  const mainTerms = useMemo(
    () => filteredTerms.filter((t) => t.term_type === 'first_semester' || t.term_type === 'second_semester'),
    [filteredTerms]
  )
  const otherTerms = useMemo(
    () => filteredTerms.filter((t) => t.term_type !== 'first_semester' && t.term_type !== 'second_semester'),
    [filteredTerms]
  )

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#0B0F17] transition-colors duration-200">
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
        
        {/* Header Section (Two-Tone Brand Rule) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-5">
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
              Academic <span className="text-accent-brand">Terms</span>
            </h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
              Manage semester schedules, academic years, and active school periods
            </p>
          </div>
          <Button 
            onClick={handleCreate} 
            className="w-full md:w-auto bg-[#003087] hover:bg-[#002266] dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg px-5 h-11 text-xs font-bold uppercase tracking-wider shadow-sm transition-all"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Term
          </Button>
        </div>

        {/* Active Term Highlight Banner */}
        {activeTerm && (
          <div className="relative overflow-hidden rounded-xl border border-blue-200 dark:border-blue-900/60 bg-white dark:bg-[#111827] shadow-sm p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                      <CheckCircle2 className="w-3 h-3" />
                      Active Period
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{activeTerm.term_name}</h3>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <span>{new Date(activeTerm.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <ChevronRight className="h-3 w-3 text-slate-400" />
                    <span>{new Date(activeTerm.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>
              <div className="w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 flex flex-col sm:items-end">
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Academic Year</span>
                <span className="text-base font-bold font-mono text-slate-900 dark:text-white mt-0.5">{activeTerm.academic_year}</span>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-xl p-4 flex items-center gap-3.5">
            <div className="p-2 bg-rose-500/10 rounded-lg shrink-0">
              <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-rose-700 dark:text-rose-300">Sync Error</p>
              <p className="text-xs text-rose-600/90 dark:text-rose-400/90">{error}</p>
            </div>
          </div>
        )}

        {/* Search & Content Bar */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by term name, code, or academic year..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs"
              />
            </div>
          </div>

          {loading ? (
            <SkeletonList />
          ) : (
            <>
              {/* Main Semesters Section */}
              {mainTerms.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-0.5">
                    <div className="w-1 h-3.5 bg-blue-600 rounded-full" />
                    <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Main Semesters
                    </h2>
                  </div>
                  <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <TermsTable
                      terms={mainTerms}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onSetActive={handleSetActive}
                    />
                  </div>
                </div>
              )}

              {/* Other Terms Section */}
              {otherTerms.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-0.5">
                    <div className="w-1 h-3.5 bg-slate-400 rounded-full" />
                    <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Summer & Midyear Terms
                    </h2>
                  </div>
                  <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <TermsTable
                      terms={otherTerms}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onSetActive={handleSetActive}
                    />
                  </div>
                </div>
              )}

              {/* Empty State */}
              {filteredTerms.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-[#111827] rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800/60 rounded-full flex items-center justify-center mb-3">
                    <Calendar className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {searchQuery ? 'No Terms Match Search' : 'No Academic Terms Defined'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm leading-relaxed mb-6">
                    {searchQuery
                      ? `No terms match "${searchQuery}". Try clearing your search input.`
                      : 'You haven\'t added any academic terms yet. Start by defining your first semester.'}
                  </p>
                  {!searchQuery && (
                    <Button 
                      onClick={handleCreate} 
                      className="bg-[#003087] hover:bg-[#002266] dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg px-6 h-10 text-xs font-bold uppercase tracking-wider"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Term
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Form Modal */}
        <TermFormModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSubmit={handleFormSubmit}
          term={selectedTerm}
          mode={modalMode}
        />

        {/* Delete Confirmation Dialog */}
        {deleteConfirmOpen && termToDelete && (
          <AlertDialog open onOpenChange={(o) => { if (!o) setDeleteConfirmOpen(false) }}>
            <AlertDialogContent className="max-w-md p-6 bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 rounded-xl">
              <AlertDialogHeader className="flex-row items-center gap-3 space-y-0 text-left">
                <div className="p-2 bg-rose-500/10 rounded-lg">
                  <Trash2 className="h-5 w-5 text-rose-500" />
                </div>
                <AlertDialogTitle className="text-base font-bold text-slate-900 dark:text-white">Delete Academic Term</AlertDialogTitle>
              </AlertDialogHeader>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-3">
                Are you sure you want to delete <strong className="text-slate-900 dark:text-white">{termToDelete.term_name}</strong>?
                This action will remove all schedule entries associated with this term and cannot be undone.
              </p>
              <AlertDialogFooter className="mt-6 flex-col sm:flex-row items-center justify-end gap-2">
                <AlertDialogCancel
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="w-full sm:w-auto h-10 rounded-lg text-xs font-semibold border-slate-200 dark:border-slate-800 m-0"
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => { e.preventDefault(); confirmDelete() }}
                  className="w-full sm:w-auto h-10 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider m-0"
                >
                  Delete Term
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  )
}