'use client'

import { Search, Filter, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { UserFilters as UserFiltersType, UserType, UserRole, UserStatus } from '@/backend/admin/admin.types'
import { cn } from '@/lib/utils'

const roles: UserRole[] = [
  'IT Admin', 'Building Admin', 'Academic Head', 'Program Head',
  'Faculty', 'External Client',
]

const statuses: UserStatus[] = ['Active', 'Inactive', 'Suspended', 'Pending']
const types: UserType[] = ['Internal', 'External']

interface UserFiltersProps {
  filters: UserFiltersType
  onFiltersChange: (filters: UserFiltersType) => void
}

export const UserFilters = ({ filters, onFiltersChange }: UserFiltersProps) => {
  const hasActiveFilters = filters.search || filters.type !== 'all' || filters.role !== 'all' || filters.status !== 'all'

  const handleClear = () => {
    onFiltersChange({ search: '', type: 'all', role: 'all', status: 'all' })
  }

  const isFacultyActive = filters.role === 'Faculty' && filters.type === 'all' && filters.status === 'all'
  const isPendingActive = filters.status === 'Pending' && filters.role === 'all' && filters.type === 'all'
  const isExternalActive = filters.type === 'External' && filters.role === 'all' && filters.status === 'all'
  const isSuspendedActive = filters.status === 'Suspended' && filters.role === 'all' && filters.type === 'all'
  const isAllActive = !hasActiveFilters

  return (
    <div className="bg-card rounded-xl border border-border/80 p-4 space-y-3 shadow-xs">
      {/* Quick filter pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mr-1">Quick Filters:</span>
        <Button
          variant={isAllActive ? 'secondary' : 'ghost'}
          size="sm"
          className={cn(
            "h-7 text-xs rounded-lg transition-all",
            isAllActive && "bg-primary/10 text-primary font-bold border border-primary/20"
          )}
          onClick={handleClear}
        >
          All Users
        </Button>
        <Button
          variant={isFacultyActive ? 'secondary' : 'ghost'}
          size="sm"
          className={cn(
            "h-7 text-xs rounded-lg transition-all",
            isFacultyActive && "bg-primary/10 text-primary font-bold border border-primary/20"
          )}
          onClick={() => onFiltersChange({ search: '', type: 'all', role: 'Faculty', status: 'all' })}
        >
          Faculty
        </Button>
        <Button
          variant={isPendingActive ? 'secondary' : 'ghost'}
          size="sm"
          className={cn(
            "h-7 text-xs rounded-lg transition-all",
            isPendingActive && "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20"
          )}
          onClick={() => onFiltersChange({ search: '', type: 'all', role: 'all', status: 'Pending' })}
        >
          Pending
        </Button>
        <Button
          variant={isExternalActive ? 'secondary' : 'ghost'}
          size="sm"
          className={cn(
            "h-7 text-xs rounded-lg transition-all",
            isExternalActive && "bg-primary/10 text-primary font-bold border border-primary/20"
          )}
          onClick={() => onFiltersChange({ search: '', type: 'External', role: 'all', status: 'all' })}
        >
          External
        </Button>
        <Button
          variant={isSuspendedActive ? 'secondary' : 'ghost'}
          size="sm"
          className={cn(
            "h-7 text-xs rounded-lg transition-all",
            isSuspendedActive && "bg-destructive/10 text-destructive font-bold border border-destructive/20"
          )}
          onClick={() => onFiltersChange({ search: '', type: 'all', role: 'all', status: 'Suspended' })}
        >
          Suspended
        </Button>
      </div>

      {/* Search and select dropdowns */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="h-11 pl-9 pr-12 rounded-xl"
            aria-label="Search users"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border bg-muted/60 text-[10px] font-mono text-muted-foreground">
            <span className="text-[9px]">⌘</span>K
          </div>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <Select
            value={filters.type}
            onValueChange={(v) => onFiltersChange({ ...filters, type: v as UserType | 'all' })}
          >
            <SelectTrigger className="h-11 w-[130px] rounded-xl" aria-label="Filter by type">
              <Filter className="h-4 w-4 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select
            value={filters.role}
            onValueChange={(v) => onFiltersChange({ ...filters, role: v as UserRole | 'all' })}
          >
            <SelectTrigger className="h-11 w-[150px] rounded-xl" aria-label="Filter by role">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {roles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select
            value={filters.status}
            onValueChange={(v) => onFiltersChange({ ...filters, status: v as UserStatus | 'all' })}
          >
            <SelectTrigger className="h-11 w-[140px] rounded-xl" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={handleClear} className="h-11 px-3 rounded-xl gap-1 text-muted-foreground hover:text-foreground" aria-label="Clear all filters">
              <X className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Clear</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
