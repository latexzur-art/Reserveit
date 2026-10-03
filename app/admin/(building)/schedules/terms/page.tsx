'use client'

import { useState } from 'react'
import { Plus, Calendar, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUI } from '@/contexts/UIContext'
import { useAdminNotifications } from '@/hooks/admin/useAdminNotifications'
import { useAcademicTerms } from '@/hooks/shared/useAcademicTerms'
import { TermsTable } from '@/components/shared/terms/TermsTable'
import { TermFormModal } from '@/components/shared/terms/TermFormModal'
import type { AcademicTerm } from '@/hooks/shared/useAcademicTerms'
import { SkeletonList } from "@/components/ui/SkeletonList";


export default function AcademicTermsPage() {
  const { toggleMobileMenu } = useUI()
  const { terms, activeTerm, loading, error, createTerm, updateTerm, deleteTerm, setActiveTerm } = useAcademicTerms()
  const {
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    clearAllNotifications,
  } = useAdminNotifications()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [selectedTerm, setSelectedTerm] = useState<AcademicTerm | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [termToDelete, setTermToDelete] = useState<AcademicTerm | null>(null)

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
      setDeleteConfirmOpen(false)
      setTermToDelete(null)
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleSetActive = async (term: AcademicTerm) => {
    try {
      await setActiveTerm(term.id)
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleFormSubmit = async (data: any) => {
    if (modalMode === 'create') {
      await createTerm(data)
    } else if (selectedTerm) {
      await updateTerm(selectedTerm.id, data)
    }
  }

  // Separate terms by type for better organization
  const mainTerms = terms.filter((t) => t.term_type === 'first_semester' || t.term_type === 'second_semester')
  const otherTerms = terms.filter((t) => t.term_type !== 'first_semester' && t.term_type !== 'second_semester')

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">Academic <span className="text-accent-brand">Terms</span></h1>
            <p className="text-sm text-muted-foreground mt-1">Manage semester schedules and academic periods</p>
          </div>
          <Button onClick={handleCreate} className="bg-emerald-500 hover:bg-emerald-600 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Add Term
          </Button>
        </div>

        {/* Active Term Card */}
        {activeTerm && (
          <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-xl p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">Current Active Term</h3>
                  <p className="text-2xl font-bold text-emerald-500 dark:text-emerald-400">{activeTerm.term_name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(activeTerm.start_date).toLocaleDateString()} -{' '}
                    {new Date(activeTerm.end_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Academic Year</p>
                <p className="text-lg font-semibold text-foreground">{activeTerm.academic_year}</p>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">Error loading terms</p>
              <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <SkeletonList />
        ) : (
          <>
            {/* Main Terms (1st & 2nd Semester) */}
            {mainTerms.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-foreground">Main Semesters</h2>
                <TermsTable
                  terms={mainTerms}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onSetActive={handleSetActive}
                />
              </div>
            )}

            {/* Other Terms (Summer, Midyear) */}
            {otherTerms.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-foreground">Other Terms</h2>
                <TermsTable
                  terms={otherTerms}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onSetActive={handleSetActive}
                />
              </div>
            )}

            {/* Empty State */}
            {terms.length === 0 && !loading && (
              <div className="text-center py-20 bg-muted/50 rounded-xl border border-border">
                <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No Academic Terms</h3>
                <p className="text-muted-foreground text-sm mb-6">Get started by creating your first academic term</p>
                <Button onClick={handleCreate} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Term
                </Button>
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

      {/* Delete Confirmation */}
      {deleteConfirmOpen && termToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-card-foreground mb-2">Delete Academic Term?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete <span className="font-medium text-card-foreground">{termToDelete.term_name}</span>?
              This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button onClick={() => setDeleteConfirmOpen(false)} variant="ghost">
                Cancel
              </Button>
              <Button onClick={confirmDelete} variant="destructive">
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
