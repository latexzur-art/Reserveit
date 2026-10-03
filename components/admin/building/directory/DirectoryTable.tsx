'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ChevronUp, ChevronDown, ChevronsUpDown, Loader2 } from 'lucide-react'
import type { DirectoryPerson } from '@/backend/admin/building/building.types'
import { cn } from '@/lib/utils'
import { formatEnumLabel } from '@/lib/enum-labels'

const CATEGORY_COLORS: Record<string, string> = {
  faculty: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  program_head: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  academic_head: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  building_admin: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  cashier: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  it_admin: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  external_client: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  maintenance_staff: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

const CATEGORY_LABELS: Record<string, string> = {
  faculty: 'Faculty',
  program_head: 'Program Head',
  academic_head: 'Academic Head',
  building_admin: 'Building Admin',
  cashier: 'Cashier',
  it_admin: 'IT Admin',
  external_client: 'External Client',
  maintenance_staff: 'Maintenance',
}

interface Props {
  items: DirectoryPerson[]
  loading: boolean
  sortBy: string
  sortOrder: 'asc' | 'desc'
  onSort: (col: string) => void
  onRowClick: (person: DirectoryPerson) => void
}

function SortIcon({ col, sortBy, sortOrder }: { col: string; sortBy: string; sortOrder: string }) {
  if (sortBy !== col) return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-40" />
  return sortOrder === 'asc'
    ? <ChevronUp className="w-3 h-3 ml-1" />
    : <ChevronDown className="w-3 h-3 ml-1" />
}

export function DirectoryTable({ items, loading, sortBy, sortOrder, onSort, onRowClick }: Props) {
  const th = (col: string, label: string) => (
    <TableHead
      className="cursor-pointer select-none whitespace-nowrap h-11"
      role="button"
      tabIndex={0}
      aria-sort={sortBy === col ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
      onClick={() => onSort(col)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort(col) } }}
    >
      <span className="flex items-center text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
        {label}
        <SortIcon col={col} sortBy={sortBy} sortOrder={sortOrder} />
      </span>
    </TableHead>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No people found matching your filters.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border">
            {th('name', 'Name')}
            {th('category', 'Role Category')}
            {th('department', 'Department / Org')}
            <TableHead className="text-xs font-semibold text-muted-foreground h-11">Contact</TableHead>
            {th('status', 'Status')}
            {th('lastActivity', 'Last Activity')}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(person => (
            <TableRow
              key={`${person.source}-${person.id}`}
              className="cursor-pointer hover:bg-accent/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              role="button"
              tabIndex={0}
              onClick={() => onRowClick(person)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(person) } }}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarImage src={person.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs font-bold bg-muted">
                      {person.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate max-w-[180px]">{person.name}</p>
                    {person.employeeId && (
                      <p className="text-[10px] text-muted-foreground font-mono">{person.employeeId}</p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge className={cn('text-[10px] font-bold border-none', CATEGORY_COLORS[person.category] ?? 'bg-muted text-muted-foreground')}>
                  {CATEGORY_LABELS[person.category] ?? formatEnumLabel(person.category)}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground truncate max-w-[160px]">
                {person.departmentName ?? person.organizationName ?? '—'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {person.email ?? person.phone ?? '—'}
              </TableCell>
              <TableCell>
                <Badge variant={person.isActive ? 'default' : 'secondary'} className="text-[10px]">
                  {person.isActive ? 'Active' : 'Inactive'}
                </Badge>
                {person.isBlacklisted && (
                  <Badge variant="destructive" className="ml-1 text-[10px]">Blacklisted</Badge>
                )}
                {person.isVerified === false && person.category === 'external_client' && (
                  <Badge variant="outline" className="ml-1 text-[10px] text-amber-600 border-amber-300">Unverified</Badge>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {person.lastActivityAt
                  ? new Date(person.lastActivityAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: '2-digit' })
                  : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
