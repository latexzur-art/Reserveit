'use client'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search } from 'lucide-react'
import type { PersonCategory } from '@/backend/admin/building/building.types'

interface Props {
  search: string
  onSearchChange: (v: string) => void
  category: PersonCategory | 'all'
  onCategoryChange: (v: PersonCategory | 'all') => void
  status: 'active' | 'inactive' | 'all'
  onStatusChange: (v: 'active' | 'inactive' | 'all') => void
}

const CATEGORIES: { value: PersonCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'program_head', label: 'Program Head' },
  { value: 'academic_head', label: 'Academic Head' },
  { value: 'building_admin', label: 'Building Admin' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'it_admin', label: 'IT Admin' },
  { value: 'external_client', label: 'External Client' },
  { value: 'maintenance_staff', label: 'Maintenance Staff' },
]

export function DirectoryFilters({ search, onSearchChange, category, onCategoryChange, status, onStatusChange }: Props) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, ID, department..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={category} onValueChange={v => onCategoryChange(v as PersonCategory | 'all')}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIES.map(c => (
            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={v => onStatusChange(v as 'active' | 'inactive' | 'all')}>
        <SelectTrigger className="w-full sm:w-[130px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
          <SelectItem value="all">All Status</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
