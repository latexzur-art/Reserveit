'use client'

import { useState, useCallback } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { statusColors } from '@/backend/admin/admin.types'

interface RoleUser {
  id: string
  fullName: string
  email: string
  status: string
}

interface RoleUsersExpandableProps {
  roleId: string
  userCount: number
}

const statusDisplay: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
  pending: 'Pending',
}

export const RoleUsersExpandable = ({ roleId, userCount }: RoleUsersExpandableProps) => {
  const [expanded, setExpanded] = useState(false)
  const [users, setUsers] = useState<RoleUser[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const fetchUsers = useCallback(async () => {
    if (loaded) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/roles/${roleId}/users`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
        setLoaded(true)
      }
    } catch (err) {
      console.error('Failed to fetch role users:', err)
    } finally {
      setLoading(false)
    }
  }, [roleId, loaded])

  const handleToggle = () => {
    if (!expanded && !loaded) fetchUsers()
    setExpanded(prev => !prev)
  }

  if (userCount === 0) {
    return <span className="text-muted-foreground text-sm">0 users</span>
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto p-0 font-normal text-sm hover:text-primary"
        onClick={handleToggle}
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5 mr-1" /> : <ChevronRight className="h-3.5 w-3.5 mr-1" />}
        {userCount} user{userCount !== 1 ? 's' : ''}
      </Button>

      {expanded && (
        <div className="mt-2 ml-4 space-y-1.5">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading...
            </div>
          )}
          {!loading && users.map(user => (
            <div key={user.id} className="flex items-center gap-2 text-sm py-0.5">
              <span className="font-medium">{user.fullName}</span>
              <span className="text-muted-foreground">{user.email}</span>
              <Badge variant="outline" className={`text-xs ${statusColors[statusDisplay[user.status] || 'Active'] || ''}`}>
                {statusDisplay[user.status] || user.status}
              </Badge>
            </div>
          ))}
          {!loading && users.length === 0 && loaded && (
            <p className="text-sm text-muted-foreground">No users found.</p>
          )}
        </div>
      )}
    </div>
  )
}
