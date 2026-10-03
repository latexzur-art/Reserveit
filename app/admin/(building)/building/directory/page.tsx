"use client"

import { useState } from 'react'
import { Card } from "@/components/ui/card";
import { Button } from '@/components/ui/button'
import { 
  UserPlus, ChevronLeft, ChevronRight, 
  Loader2, Users
} from 'lucide-react'
import { useBuildingDirectory } from '@/hooks/admin/building/useBuildingDirectory'
import { DirectoryFilters } from '@/components/admin/building/directory/DirectoryFilters'
import { DirectoryTable } from '@/components/admin/building/directory/DirectoryTable'
import { PersonDetailDrawer } from '@/components/admin/building/directory/PersonDetailDrawer'
import { AddMaintenanceStaffDialog } from '@/components/admin/building/directory/AddMaintenanceStaffDialog'
import type { DirectoryPerson } from '@/backend/admin/building/building.types'
import { SkeletonList } from "@/components/ui/SkeletonList";

export default function DirectoryPage() {
  const dir = useBuildingDirectory()
  const [selectedPerson, setSelectedPerson] = useState<DirectoryPerson | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const handleSort = (col: string) => {
    if (dir.sortBy === col) {
      dir.setSortOrder(dir.sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      dir.setSortBy(col)
      dir.setSortOrder('asc')
    }
    dir.setPage(1)
  }

  return (
    <div className="space-y-6 pb-10 px-4 lg:px-6 max-w-7xl mx-auto w-full pt-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
            Personnel <span className="text-accent-brand">Directory</span>
          </h1>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
             {dir.loading ? 'Loading personnel records...' : `Showing ${dir.total} registered personnel across all departments.`}
          </p>
        </div>

        <Button 
          onClick={() => setAddOpen(true)} 
          className="bg-sti-blue hover:bg-sti-blue/90 text-white shadow-sm font-medium"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add Maintenance Staff
        </Button>
      </div>

      {/* SEARCH & FILTERS SECTION */}
      <div className="w-full bg-card p-3 rounded-xl border border-border shadow-sm">
        <DirectoryFilters
          search={dir.search}
          onSearchChange={dir.setSearch}
          category={dir.category}
          onCategoryChange={v => { dir.setCategory(v); dir.setPage(1) }}
          status={dir.status}
          onStatusChange={v => { dir.setStatus(v); dir.setPage(1) }}
        />
      </div>

      {/* ERROR FEEDBACK */}
      {dir.error && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm font-medium text-red-600 dark:text-red-400">
          Failed to load directory: {dir.error}
        </div>
      )}

      {/* DIRECTORY DATA TABLE */}
      <div className="border border-border bg-card rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {dir.loading && dir.items.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-sti-blue mb-4" />
              <span className="text-sm font-medium text-muted-foreground">Loading directory...</span>
            </div>
          ) : (
            <DirectoryTable
              items={dir.items}
              loading={dir.loading}
              sortBy={dir.sortBy}
              sortOrder={dir.sortOrder}
              onSort={handleSort}
              onRowClick={setSelectedPerson}
            />
          )}
        </div>
      </div>

      {/* PAGINATION */}
      {dir.totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            Page <span className="font-medium text-foreground">{dir.page}</span> of <span className="font-medium text-foreground">{dir.totalPages}</span>
          </p>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={dir.page <= 1}
              onClick={() => dir.setPage(dir.page - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={dir.page >= dir.totalPages}
              onClick={() => dir.setPage(dir.page + 1)}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* OVERLAY COMPONENTS */}
      <PersonDetailDrawer
        person={selectedPerson}
        onClose={() => setSelectedPerson(null)}
        onRefreshList={dir.refresh}
      />

      <AddMaintenanceStaffDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={() => { setAddOpen(false); dir.refresh() }}
      />
    </div>
  )
}