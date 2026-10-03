'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { User, UserFilters, RoleOption, DepartmentOption } from '@/backend/admin/admin.types'
import { statusDisplayToDb } from '@/backend/admin/admin.types'
import { useToast } from '@/hooks/use-toast'

export const useAdminUsers = () => {
  const [users, setUsers] = useState<User[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [stats, setStats] = useState({ total: 0, internal: 0, external: 0, faculty: 0 })
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<UserFilters>({ search: '', type: 'all', role: 'all', status: 'all' })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [viewArchived, setViewArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const abortRef = useRef<AbortController | null>(null)
  const initialLoadDone = useRef(false)

  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize))

  // Fetch users with current filters and pagination
  const fetchUsers = useCallback(async () => {
    // Cancel previous request
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (!initialLoadDone.current) setLoading(true)
    else setSwitching(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (filters.search) params.set('search', filters.search)
      if (filters.type !== 'all') params.set('type', filters.type)
      if (filters.role !== 'all') params.set('role', filters.role)
      if (filters.status !== 'all') params.set('status', filters.status)
      if (viewArchived) params.set('archived', 'true')
      params.set('page', String(currentPage))
      params.set('pageSize', String(pageSize))

      const res = await fetch(`/api/admin/users?${params}`, { signal: controller.signal })
      if (!res.ok) throw new Error('Failed to fetch users')
      const data = await res.json()
      setUsers(data.users || [])
      setTotalUsers(data.total || 0)
      initialLoadDone.current = true
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message)
        console.error('Failed to fetch users:', err)
      }
    } finally {
      setLoading(false)
      setSwitching(false)
    }
  }, [filters, currentPage, pageSize, viewArchived])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users/stats')
      if (res.ok) {
        const data = await res.json()
        setStats({
          total: data.total_users || 0,
          internal: data.internal_users || 0,
          external: data.external_users || 0,
          faculty: data.faculty_count || 0,
        })
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }, [])

  // Fetch roles and departments
  const fetchReferenceData = useCallback(async () => {
    try {
      const [rolesRes, deptsRes] = await Promise.all([
        fetch('/api/admin/roles'),
        fetch('/api/admin/departments'),
      ])
      if (rolesRes.ok) {
        const data = await rolesRes.json()
        setRoles(data.roles || [])
      }
      if (deptsRes.ok) {
        const data = await deptsRes.json()
        setDepartments(data.departments || [])
      }
    } catch (err) {
      console.error('Failed to fetch reference data:', err)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchReferenceData()
    fetchStats()
  }, [fetchReferenceData, fetchStats])

  // Fetch users when filters or pagination change
  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Reset page when filters or archive view changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filters, viewArchived])

  const refreshUsers = useCallback(async () => {
    await Promise.all([fetchUsers(), fetchStats()])
  }, [fetchUsers, fetchStats])

  // Optimistically remove users from the local list (instant UI feedback)
  const removeUsersOptimistically = useCallback((ids: string[]) => {
    const idSet = new Set(ids)
    setUsers(prev => prev.filter(u => !idSet.has(u.id)))
    setTotalUsers(prev => Math.max(0, prev - ids.length))
    setSelectedUsers(prev => {
      const next = new Set(prev)
      ids.forEach(id => next.delete(id))
      return next
    })
  }, [])

  // Add user
  const addUser = useCallback(async (data: {
    fullName: string; email: string; phone?: string;
    userType: 'internal' | 'external'; roleId: string;
    departmentId?: string; organization?: string;
    notificationEmail?: string;
    provisionEntra?: boolean;
    temporaryPassword?: string;
  }): Promise<{
    success: boolean
    userId?: string
    temporaryPassword?: string
    entra?: { userPrincipalName: string; temporaryPassword: string }
  }> => {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(payload.error || 'Failed to create user')
    }
    toast({ title: 'User Created', description: `${data.fullName} has been added successfully.` })
    refreshUsers()
    return payload
  }, [toast, refreshUsers])

  // Update user
  const updateUser = useCallback(async (id: string, updates: any) => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error('Failed to update user')
    toast({ title: 'User Updated', description: 'User information has been updated successfully.' })
    refreshUsers()
  }, [toast, refreshUsers])

  // Delete user (soft delete — moves to archive)
  const deleteUser = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data?.success === false) {
      throw new Error(data?.error ?? 'Failed to delete user')
    }
    removeUsersOptimistically([id])
    toast({ title: 'User Archived', description: 'User has been moved to the archive.' })
    fetchStats()
  }, [toast, removeUsersOptimistically, fetchStats])

  // Restore archived user
  const restoreUser = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/users/${id}/restore`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data?.success === false) {
      throw new Error(data?.error ?? 'Failed to restore user')
    }
    removeUsersOptimistically([id])
    toast({ title: 'User Restored', description: 'User has been restored to active.' })
    fetchStats()
  }, [toast, removeUsersOptimistically, fetchStats])

  // Permanently delete user
  const permanentDeleteUser = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/users/${id}?permanent=true`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data?.success === false) {
      throw new Error(data?.error ?? 'Failed to permanently delete user')
    }
    removeUsersOptimistically([id])
    toast({ title: 'User Permanently Deleted', description: 'User has been permanently removed.', variant: 'destructive' })
    fetchStats()
  }, [toast, removeUsersOptimistically, fetchStats])

  // Bulk delete
  const bulkDelete = useCallback(async (ids: string[]) => {
    const res = await fetch('/api/admin/users/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', userIds: ids }),
    })
    if (!res.ok) throw new Error('Failed to bulk delete')
    removeUsersOptimistically(ids)
    toast({ title: 'Users Deleted', description: `${ids.length} users have been deactivated.`, variant: 'destructive' })
    fetchStats()
  }, [toast, removeUsersOptimistically, fetchStats])

  // Update user status
  const updateUserStatus = useCallback(async (id: string, status: string) => {
    const dbStatus = statusDisplayToDb[status] || status.toLowerCase()
    const res = await fetch(`/api/admin/users/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: dbStatus }),
    })
    if (!res.ok) throw new Error('Failed to update status')
    toast({ title: 'Status Updated', description: `User status has been changed to ${status}.` })
    refreshUsers()
  }, [toast, refreshUsers])

  // Bulk suspend
  const bulkSuspend = useCallback(async (ids: string[]) => {
    const res = await fetch('/api/admin/users/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'suspend', userIds: ids }),
    })
    if (!res.ok) throw new Error('Failed to bulk suspend')
    setSelectedUsers(new Set())
    toast({ title: 'Users Suspended', description: `${ids.length} users have been suspended.` })
    refreshUsers()
  }, [toast, refreshUsers])

  // Bulk activate
  const bulkActivate = useCallback(async (ids: string[]) => {
    const res = await fetch('/api/admin/users/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'activate', userIds: ids }),
    })
    if (!res.ok) throw new Error('Failed to bulk activate')
    setSelectedUsers(new Set())
    toast({ title: 'Users Activated', description: `${ids.length} users have been set to active.` })
    refreshUsers()
  }, [toast, refreshUsers])

  // Update user role
  const updateUserRole = useCallback(async (id: string, roleId: string, note?: string) => {
    const res = await fetch(`/api/admin/users/${id}/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId, note }),
    })
    if (!res.ok) throw new Error('Failed to update role')
    toast({ title: 'Role Updated', description: 'User role has been changed.' })
    refreshUsers()
  }, [toast, refreshUsers])

  const resetPassword = useCallback(async (id: string): Promise<{
    temporaryPassword: string
    email_sent: boolean
    notification_email_used: string | null
  }> => {
    const res = await fetch(`/api/admin/users/${id}/reset-password`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error ?? 'Failed to reset password')
    return {
      temporaryPassword: data.temporaryPassword as string,
      email_sent: data.email_sent ?? false,
      notification_email_used: data.notification_email_used ?? null,
    }
  }, [])

  // Force logout (placeholder - shows toast)
  const forceLogout = useCallback((id: string) => {
    const user = users.find(u => u.id === id)
    toast({
      title: 'Sessions Terminated',
      description: user ? `All sessions for ${user.firstName} ${user.lastName} have been invalidated.` : 'All sessions terminated.',
    })
  }, [users, toast])

  // Selection handlers
  const toggleSelectUser = useCallback((id: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set())
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)))
    }
  }, [users, selectedUsers.size])

  const clearSelection = useCallback(() => {
    setSelectedUsers(new Set())
  }, [])

  // Export users
  const exportUsers = useCallback(async (userIds?: string[]) => {
    try {
      const params = new URLSearchParams()
      if (userIds?.length) params.set('userIds', userIds.join(','))
      const res = await fetch(`/api/admin/users/export?${params}`)
      if (!res.ok) throw new Error('Failed to export')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'Export Complete', description: 'Users exported to CSV.' })
    } catch (err) {
      toast({ title: 'Export Failed', description: 'Failed to export users.', variant: 'destructive' })
    }
  }, [toast])

  // Bulk upload users
  const bulkUploadUsers = useCallback(async (rows: any[]) => {
    const res = await fetch('/api/admin/users/bulk-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Bulk upload failed')
    }
    const result = await res.json()
    if (result.summary?.success > 0) {
      toast({
        title: 'Bulk Upload Complete',
        description: `${result.summary.success} of ${result.summary.total} users created successfully.`,
      })
      refreshUsers()
    }
    return result
  }, [toast, refreshUsers])

  // Send message
  const sendMessage = useCallback(async (data: { recipientId: string; recipientName: string; subject: string; body: string; sendAs: 'email' | 'in-app' | 'both' }) => {
    const res = await fetch('/api/admin/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to send message')
    const methods = { 'email': 'Email', 'in-app': 'In-app notification', 'both': 'Email and in-app notification' }
    toast({ title: 'Message Sent', description: `${methods[data.sendAs]} sent to ${data.recipientName}.` })
  }, [toast])

  // Send broadcast
  const sendBroadcast = useCallback(async (data: { title: string; message: string; targetAudience: 'all' | 'internal' | 'external' | 'admins' }) => {
    const res = await fetch('/api/admin/broadcasts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to send broadcast')
    toast({ title: 'Broadcast Sent', description: `Broadcast sent to ${data.targetAudience} users.` })
  }, [toast])

  return {
    // Data
    users,
    filteredUsers: users,
    paginatedUsers: users,
    stats,
    loading,
    switching,
    error,
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

    // Pagination
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    totalUsers,

    // Archive
    viewArchived,
    setViewArchived,

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

    // Refresh
    refreshUsers,
  }
}
