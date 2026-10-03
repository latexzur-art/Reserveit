'use client'

/**
 * Schedule History & Management — Academic Head
 * Three tabbed panels: Upload History, Published Schedules, Change Log
 */

import { useState } from 'react'
import { Upload, Calendar, FileSpreadsheet, RotateCcw, GitCompare, FileText } from 'lucide-react'
import { useScheduleHistory } from '@/hooks/academic-head/useScheduleHistory'
import type { ScheduleRecord, ModificationEntry } from '@/hooks/academic-head/useScheduleHistory'
import { EditScheduleModal } from './_components/EditScheduleModal'
import { CompareModal } from './_components/CompareModal'
import { UploadHistoryTab } from './_components/UploadHistoryTab'
import { PublishedSchedulesTab } from './_components/PublishedSchedulesTab'
import { ChangeLogTab } from './_components/ChangeLogTab'
import { DraftsTab } from './_components/DraftsTab'
import { RolledBackTab } from './_components/RolledBackTab'
import { ConfirmActionModal } from './_components/ConfirmActionModal'
import { HistoryHeader } from './_components/HistoryHeader'
import { ActivityLogsTab } from './_components/ActivityLogsTab'
import { useScheduleHistoryFilters } from '@/hooks/academic-head/useScheduleHistoryFilters'

type TabKey = 'uploads' | 'schedules' | 'drafts' | 'rolledback' | 'changelog' | 'activitylogs'

export default function ScheduleHistoryPage() {
    const {
        uploads, schedules, modifications, deletions, drafts, rolledBack,
        loading, rollbackUpload, rollbackSchedules, permanentDeleteSchedules, deleteDrafts, publishDrafts, deleteUpload, editSchedule, deleteSchedule,
    } = useScheduleHistory()

    const [activeTab, setActiveTab] = useState<TabKey>('uploads')
    const [searchQuery, setSearchQuery] = useState('')
    const [confirmAction, setConfirmAction] = useState<{ type: string; id: string; label: string } | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)
    const [editModal, setEditModal] = useState<ScheduleRecord | null>(null)
    const [compareModal, setCompareModal] = useState<ModificationEntry | null>(null)

    // Batch Selection States
    const [selectedUploads, setSelectedUploads] = useState<Set<string>>(new Set())
    const [selectedSchedules, setSelectedSchedules] = useState<Set<string>>(new Set())
    const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set())
    const [selectedRolledBack, setSelectedRolledBack] = useState<Set<string>>(new Set())

    const tabs: { key: TabKey; label: string; icon: any; count?: number }[] = [
        { key: 'activitylogs', label: 'Activity Logs', icon: FileText },
        { key: 'uploads', label: 'Upload History', icon: Upload, count: uploads.length },
        { key: 'schedules', label: 'Published Schedules', icon: Calendar, count: schedules.length },
        { key: 'drafts', label: 'Drafts', icon: FileSpreadsheet, count: drafts?.length || 0 },
        { key: 'rolledback', label: 'Rolled Back', icon: RotateCcw, count: rolledBack.length },
        { key: 'changelog', label: 'Change Log', icon: GitCompare, count: modifications.length + deletions.length },
    ]

    // ── Actions ──
    const handleConfirmedAction = async () => {
        if (!confirmAction) return
        setActionLoading(confirmAction.type)
        setActionError(null)
        try {
            switch (confirmAction.type) {
                case 'rollback':
                    await rollbackUpload(confirmAction.id)
                    break
                case 'delete-upload':
                    await deleteUpload(confirmAction.id)
                    break
                case 'delete-schedule':
                    await deleteSchedule(confirmAction.id)
                    break
                case 'batch-delete-uploads': {
                    const ids = Array.from(selectedUploads)
                    const errors: string[] = []
                    for (const id of ids) {
                        try { await deleteUpload(id) } catch (err: any) { errors.push(err.message) }
                    }
                    setSelectedUploads(new Set())
                    if (errors.length > 0) {
                        const unique = [...new Set(errors)]
                        const succeeded = ids.length - errors.length
                        const summary = succeeded > 0
                            ? `${succeeded} deleted, ${errors.length} could not be deleted:\n\n${unique.join('\n')}`
                            : unique.join('\n')
                        setActionError(summary)
                        return
                    }
                    break
                }
                case 'batch-rollback':
                    await rollbackSchedules(Array.from(selectedSchedules))
                    setSelectedSchedules(new Set())
                    break
                case 'batch-delete-drafts':
                    await deleteDrafts(Array.from(selectedDrafts))
                    setSelectedDrafts(new Set())
                    break
                case 'batch-publish-drafts': {
                    const res = await publishDrafts(Array.from(selectedDrafts))
                    setSelectedDrafts(new Set())
                    if (res.errors && res.errors.length > 0) {
                        alert(`Published ${res.count} drafts with ${res.errors.length} errors:\n\n${res.errors.join('\n')}`)
                    }
                    break
                }
                case 'batch-permanent-delete':
                    await permanentDeleteSchedules(Array.from(selectedRolledBack))
                    setSelectedRolledBack(new Set())
                    break
                case 'publish-draft': {
                    const res = await publishDrafts([confirmAction.id])
                    if (res.errors?.length > 0) alert(res.errors[0])
                    break
                }
                case 'delete-draft':
                    await deleteDrafts([confirmAction.id])
                    break
                case 'rollback-single':
                    await rollbackSchedules([confirmAction.id])
                    break
                case 'permanent-delete-single':
                    await permanentDeleteSchedules([confirmAction.id])
                    break
            }
            setActionLoading(null)
            setConfirmAction(null)
        } catch (err: any) {
            setActionError(err.message)
            setActionLoading(null)
        }
    }

    // ── Upload batch helpers ──
    const toggleSelectUpload = (id: string) => {
        setSelectedUploads(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleAllUploads = () => {
        if (selectedUploads.size === uploads.length) {
            setSelectedUploads(new Set())
        } else {
            setSelectedUploads(new Set(uploads.map(u => u.id)))
        }
    }

    const handleBatchDeleteUploads = () => {
        if (selectedUploads.size === 0) return
        setConfirmAction({ type: 'batch-delete-uploads', id: '', label: `Delete ${selectedUploads.size} upload${selectedUploads.size !== 1 ? 's' : ''}` })
    }

    // New Batch Handlers
    const handleBatchRollbackSchedules = () => {
        if (selectedSchedules.size === 0) return
        setConfirmAction({
            type: 'batch-rollback',
            id: '',
            label: `Rollback ${selectedSchedules.size} schedules`
        })
    }

    const handleBatchDeleteDrafts = () => {
        if (selectedDrafts.size === 0) return
        setConfirmAction({
            type: 'batch-delete-drafts',
            id: '',
            label: `Permanently delete ${selectedDrafts.size} drafts`
        })
    }

    const handleBatchPublishDrafts = () => {
        if (selectedDrafts.size === 0) return
        setConfirmAction({
            type: 'batch-publish-drafts',
            id: '',
            label: `Publish ${selectedDrafts.size} drafts`
        })
    }

    const handleBatchPermanentDelete = () => {
        if (selectedRolledBack.size === 0) return
        setConfirmAction({
            type: 'batch-permanent-delete',
            id: '',
            label: `Permanently delete ${selectedRolledBack.size} rolled-back schedule(s)`
        })
    }

    const toggleSelectSchedule = (id: string) => {
        setSelectedSchedules(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleSelectDraft = (id: string) => {
        setSelectedDrafts(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleSelectRolledBack = (id: string) => {
        setSelectedRolledBack(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    // ── Filtered schedules ──
    const { filteredSchedules, filteredDrafts, filteredRolledBack } = useScheduleHistoryFilters(
        schedules, drafts, rolledBack, searchQuery
    )

    const toggleAllSchedules = () => {
        if (selectedSchedules.size === filteredSchedules.length) {
            setSelectedSchedules(new Set())
        } else {
            setSelectedSchedules(new Set(filteredSchedules.map(s => s.id)))
        }
    }

    const toggleAllDrafts = () => {
        if (selectedDrafts.size === filteredDrafts.length) {
            setSelectedDrafts(new Set())
        } else {
            setSelectedDrafts(new Set(filteredDrafts.map(d => d.id)))
        }
    }

    const toggleAllRolledBack = () => {
        if (selectedRolledBack.size === filteredRolledBack.length) {
            setSelectedRolledBack(new Set())
        } else {
            setSelectedRolledBack(new Set(filteredRolledBack.map(s => s.id)))
        }
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] transition-colors duration-300">
        <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
            <HistoryHeader tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB: Activity Logs */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'activitylogs' && <ActivityLogsTab />}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB 1: Upload History */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'uploads' && (
                <UploadHistoryTab
                    uploads={uploads}
                    loading={loading.uploads}
                    selectedUploads={selectedUploads}
                    actionLoading={actionLoading}
                    onToggleSelect={toggleSelectUpload}
                    onToggleAll={toggleAllUploads}
                    onBatchDelete={handleBatchDeleteUploads}
                    onClearSelection={() => setSelectedUploads(new Set())}
                    onSetConfirmAction={setConfirmAction}
                />
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB 2: Published Schedules */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'schedules' && (
                <PublishedSchedulesTab
                    schedules={schedules}
                    filteredSchedules={filteredSchedules}
                    loading={loading.schedules}
                    searchQuery={searchQuery}
                    selectedSchedules={selectedSchedules}
                    actionLoading={actionLoading}
                    onSearchChange={setSearchQuery}
                    onToggleSelect={toggleSelectSchedule}
                    onToggleAll={toggleAllSchedules}
                    onBatchRollback={handleBatchRollbackSchedules}
                    onEdit={setEditModal}
                    onSetConfirmAction={setConfirmAction}
                />
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB 3: Change Log */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'changelog' && (
                <ChangeLogTab
                    modifications={modifications}
                    deletions={deletions}
                    loading={loading.changelog}
                    onCompare={setCompareModal}
                />
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB 4: Drafts */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'drafts' && (
                <DraftsTab
                    drafts={drafts || []}
                    filteredDrafts={filteredDrafts}
                    loading={loading.drafts}
                    searchQuery={searchQuery}
                    selectedDrafts={selectedDrafts}
                    actionLoading={actionLoading}
                    onSearchChange={setSearchQuery}
                    onToggleSelect={toggleSelectDraft}
                    onToggleAll={toggleAllDrafts}
                    onBatchPublish={handleBatchPublishDrafts}
                    onBatchDelete={handleBatchDeleteDrafts}
                    onSetConfirmAction={setConfirmAction}
                />
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB 5: Rolled Back */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'rolledback' && (
                <RolledBackTab
                    rolledBack={rolledBack}
                    filteredRolledBack={filteredRolledBack}
                    loading={loading.rolledBack}
                    searchQuery={searchQuery}
                    selectedRolledBack={selectedRolledBack}
                    actionLoading={actionLoading}
                    onSearchChange={setSearchQuery}
                    onToggleSelect={toggleSelectRolledBack}
                    onToggleAll={toggleAllRolledBack}
                    onBatchPermanentDelete={handleBatchPermanentDelete}
                    onSetConfirmAction={setConfirmAction}
                />
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* CONFIRM ACTION MODAL */}
            {/* ═══════════════════════════════════════════════════════ */}
            {confirmAction && (
                <ConfirmActionModal
                    confirmAction={confirmAction}
                    actionError={actionError}
                    actionLoading={actionLoading}
                    selectedSchedulesSize={selectedSchedules.size}
                    selectedUploadsSize={selectedUploads.size}
                    selectedDraftsSize={selectedDrafts.size}
                    selectedRolledBackSize={selectedRolledBack.size}
                    onConfirm={handleConfirmedAction}
                    onDismiss={() => { setConfirmAction(null); setActionError(null) }}
                />
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* EDIT SCHEDULE MODAL */}
            {/* ═══════════════════════════════════════════════════════ */}
            {editModal && (
                <EditScheduleModal
                    schedule={editModal}
                    onClose={() => setEditModal(null)}
                    onSave={editSchedule}
                />
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* COMPARE MODAL */}
            {/* ═══════════════════════════════════════════════════════ */}
            {compareModal && (
                <CompareModal
                    entry={compareModal}
                    onClose={() => setCompareModal(null)}
                />
            )}
        </div>
        </div>
    )
}

