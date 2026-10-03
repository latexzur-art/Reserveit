'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { FAQManagementTable } from '@/components/admin/building/faq/FAQManagementTable'
import { FAQFormDialog, type FAQFormData } from '@/components/admin/building/faq/FAQFormDialog'
import type { FAQItem } from '@/backend/admin/building'

const ROLE_OPTIONS = [
  { value: 'all_filter', label: 'All Roles' },
  { value: 'external_client', label: 'External Client' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'program_head', label: 'Program Head' },
  { value: 'academic_head', label: 'Academic Head' },
  { value: 'building_admin', label: 'Building Admin' },
  { value: 'it_admin', label: 'IT Admin' },
]

export default function FAQManagementPage() {
  const [items, setItems] = useState<FAQItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all_filter')
  const [statusFilter, setStatusFilter] = useState('active')

  const [addOpen, setAddOpen] = useState(false)
  const [editItem, setEditItem] = useState<FAQItem | null>(null)
  const [deleteItem, setDeleteItem] = useState<FAQItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      // Fetch all (including inactive) for admin view
      const res = await fetch(`/api/faq/admin?${params}`)
      if (res.ok) {
        const data = await res.json()
        setItems(data.items ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { load() }, [load])

  const filtered = items.filter(item => {
    if (roleFilter !== 'all_filter' && !item.role_tags.includes(roleFilter) && !item.role_tags.includes('all')) {
      return false
    }
    if (statusFilter === 'active' && !item.is_active) return false
    if (statusFilter === 'inactive' && item.is_active) return false
    return true
  })

  async function handleAdd(data: FAQFormData) {
    const res = await fetch('/api/faq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to create FAQ')
    await load()
  }

  async function handleEdit(data: FAQFormData) {
    if (!editItem) return
    const res = await fetch(`/api/faq/${editItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to update FAQ')
    setEditItem(null)
    await load()
  }

  async function handleDelete() {
    if (!deleteItem) return
    setDeleting(true)
    try {
      await fetch(`/api/faq/${deleteItem.id}`, { method: 'DELETE' })
      setDeleteItem(null)
      await load()
    } finally {
      setDeleting(false)
    }
  }

  const editInitial: FAQFormData | undefined = editItem
    ? {
        question: editItem.question,
        answer: editItem.answer,
        category: editItem.category,
        role_tags: editItem.role_tags,
        sort_order: editItem.sort_order,
        is_active: editItem.is_active,
      }
    : undefined

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">FAQ <span className="text-accent-brand">Management</span></h1>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">
            Manage help content visible to each user role
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="rounded-xl bg-primary text-primary-foreground font-semibold text-xs h-9 px-4 hover:bg-primary/90 transition-all gap-1.5">
          <Plus size={14} />
          Add FAQ
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search questions or answers..."
            aria-label="Search questions or answers"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-lg text-xs bg-card border-border"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40 h-9 rounded-lg text-xs border-border bg-card">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border bg-card shadow-lg">
            {ROLE_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 h-9 rounded-lg text-xs border-border bg-card">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border bg-card shadow-lg">
            <SelectItem value="all" className="text-xs">All</SelectItem>
            <SelectItem value="active" className="text-xs">Active</SelectItem>
            <SelectItem value="inactive" className="text-xs">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span><span className="font-semibold text-foreground">{filtered.length}</span> shown</span>
        <span><span className="font-semibold text-foreground">{items.filter(i => i.is_active).length}</span> active</span>
        <span><span className="font-semibold text-foreground">{items.length}</span> total</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 size={20} className="animate-spin mr-2" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : (
        <FAQManagementTable
          items={filtered}
          onEdit={item => setEditItem(item)}
          onDelete={item => setDeleteItem(item)}
        />
      )}

      {/* Add dialog */}
      <FAQFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSave={handleAdd}
        title="Add FAQ"
      />

      {/* Edit dialog */}
      <FAQFormDialog
        open={!!editItem}
        onOpenChange={v => { if (!v) setEditItem(null) }}
        onSave={handleEdit}
        initial={editInitial}
        title="Edit FAQ"
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={v => { if (!v) setDeleteItem(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete FAQ?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="font-medium">"{deleteItem?.question}"</span>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 size={14} className="animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
