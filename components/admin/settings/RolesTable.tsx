'use client'

import { MoreHorizontal, Pencil, Ban, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { RoleDetail } from '@/backend/admin/admin.types'
import { RoleUsersExpandable } from './RoleUsersExpandable'

const badgeColorMap: Record<string, string> = {
  gray: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700',
  red: 'bg-red-50 text-red-700 ring-1 ring-red-600/20 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  blue: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  green: 'bg-green-50 text-green-700 ring-1 ring-green-600/20 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800',
  yellow: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  teal: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800',
  orange: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
}

interface RolesTableProps {
  roles: RoleDetail[]
  onEdit: (role: RoleDetail) => void
  onDeactivate: (role: RoleDetail) => void
  onReactivate: (role: RoleDetail) => void
}

export const RolesTable = ({ roles, onEdit, onDeactivate, onReactivate }: RolesTableProps) => {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Role</TableHead>
            <TableHead className="hidden md:table-cell">Description</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Users</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                No roles found.
              </TableCell>
            </TableRow>
          )}
          {roles.map(role => (
            <TableRow key={role.id} className={!role.isActive ? 'opacity-60' : ''}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={badgeColorMap[role.badgeColor] || badgeColorMap.gray}>
                    {role.displayName}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono hidden lg:inline">
                    {role.name}
                  </span>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                {role.description || '—'}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="text-xs">
                  {role.isInternalOnly ? 'Internal' : 'All'}
                </Badge>
              </TableCell>
              <TableCell>
                <RoleUsersExpandable roleId={role.id} userCount={role.userCount} />
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={
                    role.isActive
                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700'
                  }
                >
                  {role.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(role)}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    {role.isActive ? (
                      <DropdownMenuItem
                        onClick={() => onDeactivate(role)}
                        className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                      >
                        <Ban className="mr-2 h-4 w-4" /> Deactivate
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => onReactivate(role)}>
                        <RotateCcw className="mr-2 h-4 w-4" /> Reactivate
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
