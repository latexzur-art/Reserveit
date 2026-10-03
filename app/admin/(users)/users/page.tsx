'use client'

import { useReducer, lazy, Suspense, useEffect } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { Plus, Loader2, Users, Archive, History, Upload, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAdminUsers } from '@/hooks/admin/useAdminUsers'
import { useAdminNotifications } from '@/hooks/admin/useAdminNotifications'
import { useUI } from '@/contexts/UIContext'
import type { User } from '@/backend/admin/admin.types'

// Core components (always visible)
import { UserStatsCards } from '@/components/admin/users/UserStatsCards'
import { UserFilters } from '@/components/admin/users/UserFilters'
import { UsersTable } from '@/components/admin/users/UsersTable'
import { SkeletonList } from "@/components/ui/SkeletonList";

// Lazy-loaded modals (only rendered when open)
const AddUserModal = lazy(() => import('@/components/admin/users/AddUserModal').then(m => ({ default: m.AddUserModal })))
const EditUserModal = lazy(() => import('@/components/admin/users/EditUserModal').then(m => ({ default: m.EditUserModal })))
const AssignRoleModal = lazy(() => import('@/components/admin/users/AssignRoleModal').then(m => ({ default: m.AssignRoleModal })))
const SendMessageModal = lazy(() => import('@/components/admin/users/SendMessageModal').then(m => ({ default: m.SendMessageModal })))
const UnifiedMessageCenter = lazy(() => import('@/components/admin/users/UnifiedMessageCenter').then(m => ({ default: m.UnifiedMessageCenter })))
const DeleteConfirmDialog = lazy(() => import('@/components/admin/users/DeleteConfirmDialog').then(m => ({ default: m.DeleteConfirmDialog })))
const AuditLogsPanel = lazy(() => import('@/components/admin/users/AuditLogsPanel').then(m => ({ default: m.AuditLogsPanel })))
const BulkUploadModal = lazy(() => import('@/components/admin/users/BulkUploadModal').then(m => ({ default: m.BulkUploadModal })))
const ResetPasswordResultDialog = lazy(() => import('@/components/admin/users/ResetPasswordResultDialog').then(m => ({ default: m.ResetPasswordResultDialog })))
const WipeUsersPanel = lazy(() => import('@/components/admin/users/WipeUsersPanel').then(m => ({ default: m.WipeUsersPanel })))


export default function UsersManagement() {
  const { toggleMobileMenu } = useUI()
  const {
    // Data
    users,
    paginatedUsers,
    filteredUsers,
    stats,
    loading,
    switching,
    roles,
    departments,

    // Selection
    selectedUsers,
    toggleSelectUser,
    toggleSelectAll,
    clearSelection,

    // Filters
    filters,
    setFilters,

    // Archive
    viewArchived,
    setViewArchived,

    // Pagination
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    totalUsers,

    // Actions
    addUser,
    updateUser,
    deleteUser,
    restoreUser,
    permanentDeleteUser,
    bulkDelete,
    updateUserStatus,
    bulkSuspend,
    bulkActivate,
    updateUserRole,
    resetPassword,
    forceLogout,
    exportUsers,
    bulkUploadUsers,
    sendMessage,
    sendBroadcast,
    refreshUsers,
  } = useAdminUsers()

  const { toast } = useToast()

  const {
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    clearAllNotifications,
  } = useAdminNotifications()

  // Consolidated modal state via useReducer
  type ModalState = {
    add: boolean
    edit: boolean
    assignRole: boolean
    sendMessage: boolean
    messageCenter: boolean
    delete: boolean
    bulkDelete: boolean
    permanentDelete: boolean
    bulkPermanentDelete: boolean
    bulkUpload: boolean
    resetPassword: boolean
    resetPasswordTarget: { email: string; temporaryPassword: string; emailSent: boolean; notificationEmailUsed: string | null } | null
    selectedUser: User | null
    preselectedMessageUser: User | null
    activeTab: string
    confirmAction: { action: 'toggleStatus' | 'forceLogout'; targetUser: User | null; statusValue?: string }
  }

  type ModalAction =
    | { type: 'OPEN'; modal: keyof Pick<ModalState, 'add' | 'edit' | 'assignRole' | 'sendMessage' | 'messageCenter' | 'delete' | 'bulkDelete' | 'permanentDelete' | 'bulkPermanentDelete' | 'bulkUpload' | 'resetPassword' | 'confirmAction'>; user?: User | null; preselectedUser?: User | null }
    | { type: 'CLOSE'; modal: keyof Pick<ModalState, 'add' | 'edit' | 'assignRole' | 'sendMessage' | 'messageCenter' | 'delete' | 'bulkDelete' | 'permanentDelete' | 'bulkPermanentDelete' | 'bulkUpload' | 'resetPassword' | 'confirmAction'> }
    | { type: 'SET_RESET_TARGET'; target: ModalState['resetPasswordTarget'] }
    | { type: 'SET_TAB'; tab: string }
    | { type: 'SET_CONFIRM_ACTION'; action: 'toggleStatus' | 'forceLogout'; targetUser: User; statusValue?: string }

  const modalReducer = (state: ModalState, action: ModalAction): ModalState => {
    switch (action.type) {
      case 'OPEN':
        return {
          ...state,
          [action.modal]: true,
          ...(action.user !== undefined ? { selectedUser: action.user } : {}),
          ...(action.preselectedUser !== undefined ? { preselectedMessageUser: action.preselectedUser } : {}),
        }
      case 'CLOSE':
        return { ...state, [action.modal]: false }
      case 'SET_RESET_TARGET':
        return { ...state, resetPasswordTarget: action.target, resetPassword: !!action.target }
      case 'SET_TAB':
        return { ...state, activeTab: action.tab }
      case 'SET_CONFIRM_ACTION':
        return { ...state, confirmAction: { action: action.action, targetUser: action.targetUser, statusValue: action.statusValue } }
    }
  }

  const [modalState, dispatch] = useReducer(modalReducer, {
    add: false, edit: false, assignRole: false, sendMessage: false,
    messageCenter: false, delete: false, bulkDelete: false,
    permanentDelete: false, bulkPermanentDelete: false,
    bulkUpload: false, resetPassword: false, resetPasswordTarget: null,
    selectedUser: null, preselectedMessageUser: null, activeTab: 'active',
    confirmAction: { action: 'toggleStatus', targetUser: null },
  })

  // Destructure confirmAction for convenience
  const { confirmAction } = modalState

  // Handlers
  const handleEditUser = (user: User) => dispatch({ type: 'OPEN', modal: 'edit', user })
  const handleAssignRole = (user: User) => dispatch({ type: 'OPEN', modal: 'assignRole', user })
  const handleDeleteUser = (user: User) => dispatch({ type: 'OPEN', modal: 'delete', user })

  const handleConfirmDeleteUser = () => {
    if (modalState.selectedUser) {
      const user = modalState.selectedUser
      deleteUser(user.id)
      toast({
        title: 'User deactivated',
        description: `${user.firstName} ${user.lastName} has been deactivated.`,
        action: (
          <Button variant="outline" size="sm" onClick={() => {
            restoreUser(user.id)
            toast({ title: 'User restored', description: `${user.firstName} ${user.lastName} has been restored.` })
          }}>
            Undo
          </Button>
        ),
      })
    }
    dispatch({ type: 'CLOSE', modal: 'delete' })
  }

  const handlePermanentDeleteUser = (user: User) => dispatch({ type: 'OPEN', modal: 'permanentDelete', user })
  const handleRestoreUser = (user: User) => restoreUser(user.id)

  const handleResetPassword = async (userId: string) => {
    try {
      const result = await resetPassword(userId)
      const targetUser = users.find(u => u.id === userId)
      dispatch({
        type: 'SET_RESET_TARGET',
        target: {
          email: targetUser?.email ?? '',
          temporaryPassword: result.temporaryPassword,
          emailSent: result.email_sent,
          notificationEmailUsed: result.notification_email_used,
        },
      })
    } catch (err: any) {
      toast({
        title: 'Password Reset Failed',
        description: err?.message || 'Could not reset user password. Please try again or contact IT support.',
        variant: 'destructive',
      })
    }
  }

  const handleForceLogout = (user: User) => {
    dispatch({ type: 'SET_CONFIRM_ACTION', action: 'forceLogout', targetUser: user })
    dispatch({ type: 'OPEN', modal: 'confirmAction' })
  }

  const handleConfirmForceLogout = () => {
    if (confirmAction.targetUser) {
      forceLogout(confirmAction.targetUser.id)
    }
    dispatch({ type: 'CLOSE', modal: 'confirmAction' })
  }

  const handleSendMessage = (user: User) => dispatch({ type: 'OPEN', modal: 'sendMessage', user })
  const handleSendMessageFromRow = (user: User) => dispatch({ type: 'OPEN', modal: 'messageCenter', preselectedUser: user })
  const handleOpenMessageCenter = () => dispatch({ type: 'OPEN', modal: 'messageCenter', preselectedUser: null })

  const handleToggleStatus = (user: User) => {
    const newStatus = user.status === 'Active' ? 'Suspended' : 'Active'
    dispatch({ type: 'SET_CONFIRM_ACTION', action: 'toggleStatus', targetUser: user, statusValue: newStatus })
    dispatch({ type: 'OPEN', modal: 'confirmAction' })
  }

  const handleConfirmToggleStatus = () => {
    if (confirmAction.targetUser && confirmAction.statusValue) {
      updateUserStatus(confirmAction.targetUser.id, confirmAction.statusValue)
    }
    dispatch({ type: 'CLOSE', modal: 'confirmAction' })
  }

  const handleBulkDelete = () => {
    toast({ title: 'Deleting users...', description: `Processing ${selectedUsers.size} user(s).` })
    bulkDelete(Array.from(selectedUsers))
    dispatch({ type: 'CLOSE', modal: 'bulkDelete' })
  }

  const handleBulkSuspend = () => {
    toast({ title: 'Suspending users...', description: `Processing ${selectedUsers.size} user(s).` })
    bulkSuspend(Array.from(selectedUsers))
  }

  const handleBulkActivate = () => {
    toast({ title: 'Activating users...', description: `Processing ${selectedUsers.size} user(s).` })
    bulkActivate(Array.from(selectedUsers))
  }

  const handleExport = () => {
    exportUsers(selectedUsers.size > 0 ? Array.from(selectedUsers) : undefined)
  }

  const handleBulkRestore = () => Array.from(selectedUsers).forEach(id => restoreUser(id))
  const handleBulkPermanentDelete = () => {
    Array.from(selectedUsers).forEach(id => permanentDeleteUser(id))
    dispatch({ type: 'CLOSE', modal: 'bulkPermanentDelete' })
  }

  const handleTabChange = (value: string) => {
    dispatch({ type: 'SET_TAB', tab: value })
    setViewArchived(value === 'archived')
    clearSelection()
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // Ctrl+K or Cmd+K — focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        const searchInput = document.querySelector<HTMLInputElement>('[aria-label="Search users"]')
        searchInput?.focus()
      }

      // Ctrl+N or Cmd+N — new user
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        dispatch({ type: 'OPEN', modal: 'add' })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (loading && users.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <SkeletonList />
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Main Content */}
      <main className="px-4 lg:px-6 py-6 space-y-6 flex-1">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
            Users <span className="text-accent-brand">Management</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage staff, faculty, and external client accounts across ReserveIT.
          </p>
        </div>

        {/* Stats Cards */}
        <UserStatsCards
          total={stats.total}
          internal={stats.internal}
          external={stats.external}
          faculty={stats.faculty}
        />

        {/* Tabs */}
        <Tabs value={modalState.activeTab} onValueChange={handleTabChange}>
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <TabsList>
              <TabsTrigger value="active" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-b-accent data-[state=active]:rounded-b-none">
                <Users className="h-4 w-4" />
                Active Users
              </TabsTrigger>
              <TabsTrigger value="archived" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-b-accent data-[state=active]:rounded-b-none">
                <Archive className="h-4 w-4" />
                Archived
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-b-accent data-[state=active]:rounded-b-none">
                <History className="h-4 w-4" />
                Activity Log
              </TabsTrigger>
              <TabsTrigger value="danger" className="gap-2 text-red-600 dark:text-red-400 data-[state=active]:text-red-600 dark:data-[state=active]:text-red-400 data-[state=active]:border-b-2 data-[state=active]:border-b-destructive data-[state=active]:rounded-b-none">
                <ShieldOff className="h-4 w-4" />
                Danger Zone
              </TabsTrigger>
            </TabsList>

            {modalState.activeTab === 'active' && (
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" onClick={() => dispatch({ type: 'OPEN', modal: 'bulkUpload' })} className="shadow-sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Bulk Upload
                </Button>
                <Button onClick={() => dispatch({ type: 'OPEN', modal: 'add' })} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </div>
            )}
          </div>

          {/* Filters (show for active tab only) */}
          {modalState.activeTab === 'active' && (
            <div className="mt-4">
              <UserFilters filters={filters} onFiltersChange={setFilters} />
            </div>
          )}

          {/* Content */}
          <div className="mt-4">
            {modalState.activeTab === 'activity' ? (
              <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                <AuditLogsPanel />
              </Suspense>
            ) : modalState.activeTab === 'danger' ? (
              <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                <WipeUsersPanel onWiped={refreshUsers} />
              </Suspense>
            ) : switching ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <UsersTable
                users={paginatedUsers}
                selectedUsers={selectedUsers}
                onSelectUser={toggleSelectUser}
                onSelectAll={toggleSelectAll}
                onEditUser={handleEditUser}
                onAssignRole={handleAssignRole}
                onDeleteUser={handleDeleteUser}
                onResetPassword={handleResetPassword}
                onForceLogout={handleForceLogout}
                onToggleStatus={handleToggleStatus}
                onSendMessage={handleSendMessageFromRow}
                onBulkDelete={viewArchived ? handleBulkRestore : () => dispatch({ type: 'OPEN', modal: 'bulkDelete' })}
                onBulkSuspend={viewArchived ? () => dispatch({ type: 'OPEN', modal: 'bulkPermanentDelete' }) : handleBulkSuspend}
                onBulkActivate={handleBulkActivate}
                onExport={handleExport}
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalUsers={totalUsers}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1) }}
                archiveMode={viewArchived}
                onRestoreUser={handleRestoreUser}
                onPermanentDeleteUser={handlePermanentDeleteUser}
              />
            )}
          </div>
        </Tabs>
      </main>

      {/* Modals (lazy-loaded) */}
      <Suspense fallback={null}>
        {modalState.add && (
          <AddUserModal open onOpenChange={() => dispatch({ type: 'CLOSE', modal: 'add' })} onSubmit={addUser} roles={roles} departments={departments} />
        )}

        {modalState.bulkUpload && (
          <BulkUploadModal open onOpenChange={() => dispatch({ type: 'CLOSE', modal: 'bulkUpload' })} onUpload={bulkUploadUsers} onComplete={() => {}} roles={roles} departments={departments} />
        )}

        {modalState.edit && (
          <EditUserModal open onOpenChange={() => dispatch({ type: 'CLOSE', modal: 'edit' })} user={modalState.selectedUser} onSubmit={updateUser} roles={roles} departments={departments} />
        )}

        {modalState.assignRole && (
          <AssignRoleModal open onOpenChange={() => dispatch({ type: 'CLOSE', modal: 'assignRole' })} user={modalState.selectedUser} onSubmit={updateUserRole} roles={roles} />
        )}

        {modalState.sendMessage && (
          <SendMessageModal open onOpenChange={() => dispatch({ type: 'CLOSE', modal: 'sendMessage' })} user={modalState.selectedUser} onSendMessage={sendMessage} />
        )}

        {modalState.messageCenter && (
          <UnifiedMessageCenter open onOpenChange={() => dispatch({ type: 'CLOSE', modal: 'messageCenter' })} users={users} onSendMessage={sendMessage} onSendBroadcast={sendBroadcast} preselectedUser={modalState.preselectedMessageUser} />
        )}

        {modalState.delete && (
          <DeleteConfirmDialog open onOpenChange={() => dispatch({ type: 'CLOSE', modal: 'delete' })} user={modalState.selectedUser} onConfirm={handleConfirmDeleteUser} />
        )}

        {modalState.bulkDelete && (
          <DeleteConfirmDialog open onOpenChange={() => dispatch({ type: 'CLOSE', modal: 'bulkDelete' })} user={null} isBulk count={selectedUsers.size} onConfirm={handleBulkDelete} />
        )}

        {modalState.permanentDelete && (
          <DeleteConfirmDialog open onOpenChange={() => dispatch({ type: 'CLOSE', modal: 'permanentDelete' })} user={modalState.selectedUser} onConfirm={() => modalState.selectedUser && permanentDeleteUser(modalState.selectedUser.id)} permanent />
        )}

        {modalState.bulkPermanentDelete && (
          <DeleteConfirmDialog open onOpenChange={() => dispatch({ type: 'CLOSE', modal: 'bulkPermanentDelete' })} user={null} isBulk count={selectedUsers.size} onConfirm={handleBulkPermanentDelete} permanent />
        )}

        {modalState.resetPasswordTarget && (
          <ResetPasswordResultDialog
            open={modalState.resetPassword}
            onOpenChange={(open) => { if (!open) dispatch({ type: 'SET_RESET_TARGET', target: null }) }}
            userEmail={modalState.resetPasswordTarget.email}
            temporaryPassword={modalState.resetPasswordTarget.temporaryPassword}
            emailSent={modalState.resetPasswordTarget.emailSent}
            notificationEmailUsed={modalState.resetPasswordTarget.notificationEmailUsed}
          />
        )}

        {/* Confirm Action Dialog (status toggle / force logout) */}
        <AlertDialog open={modalState.confirmAction.targetUser !== null && modalState.activeTab === 'active'} onOpenChange={(open) => { if (!open) dispatch({ type: 'CLOSE', modal: 'confirmAction' }) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {modalState.confirmAction.action === 'toggleStatus'
                  ? (modalState.confirmAction.statusValue === 'Suspended' ? 'Suspend User?' : 'Activate User?')
                  : 'Force Logout?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {modalState.confirmAction.action === 'toggleStatus'
                  ? modalState.confirmAction.statusValue === 'Suspended'
                    ? <>You are about to suspend <strong>{modalState.confirmAction.targetUser?.firstName} {modalState.confirmAction.targetUser?.lastName}</strong>. They will no longer be able to sign in.</>
                    : <>You are about to activate <strong>{modalState.confirmAction.targetUser?.firstName} {modalState.confirmAction.targetUser?.lastName}</strong>. They will be able to sign in again.</>
                  : <>You are about to force logout <strong>{modalState.confirmAction.targetUser?.firstName} {modalState.confirmAction.targetUser?.lastName}</strong>. All their active sessions will be terminated.</>}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={modalState.confirmAction.action === 'toggleStatus' ? handleConfirmToggleStatus : handleConfirmForceLogout}
                className={modalState.confirmAction.action === 'toggleStatus' && modalState.confirmAction.statusValue === 'Active' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'}
              >
                {modalState.confirmAction.action === 'toggleStatus'
                  ? (modalState.confirmAction.statusValue === 'Suspended' ? 'Suspend' : 'Activate')
                  : 'Force Logout'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Suspense>

      {/* Minimal Footer */}
      <footer className="px-4 lg:px-6 py-3 border-t border-border text-xs text-muted-foreground text-right">
        &copy; {new Date().getFullYear()} <span className="text-sti-yellow-muted font-medium">STI</span> Colleges &middot; ReserveIT
      </footer>
    </div>
  )
}
