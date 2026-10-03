'use client'

import { Pencil, Trash2, Inbox } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { FAQItem } from '@/backend/admin/building'
import { cn } from '@/lib/utils'
import { formatEnumLabel } from '@/lib/enum-labels'

interface Props {
  items: FAQItem[]
  onEdit: (item: FAQItem) => void
  onDelete: (item: FAQItem) => void
}

const ROLE_LABELS: Record<string, string> = {
  all: 'All',
  external_client: 'Client',
  faculty: 'Faculty',
  program_head: 'Prog. Head',
  academic_head: 'Acad. Head',
  building_admin: 'Bldg. Admin',
  it_admin: 'User Mgr',
}

export function FAQManagementTable({ items, onEdit, onDelete }: Props) {
  if (items.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center">
        <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3 border border-border/50">
          <Inbox className="w-6 h-6 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-semibold text-foreground">
          Knowledge Base Empty
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Click &quot;Add FAQ&quot; to create the first entry
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-5 py-3.5 text-xs font-semibold uppercase text-muted-foreground">Question</th>
            <th className="px-5 py-3.5 text-xs font-semibold uppercase text-muted-foreground">Category</th>
            <th className="px-5 py-3.5 text-xs font-semibold uppercase text-muted-foreground">Roles</th>
            <th className="px-5 py-3.5 text-xs font-semibold uppercase text-muted-foreground text-center">Order</th>
            <th className="px-5 py-3.5 text-xs font-semibold uppercase text-muted-foreground text-center">Status</th>
            <th className="px-5 py-3.5 text-xs font-semibold uppercase text-muted-foreground text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {items.map((item) => (
            <tr 
              key={item.id} 
              className="group hover:bg-muted/30 transition-all duration-200"
            >
              <td className="px-5 py-3.5 max-w-md">
                <span className="text-xs font-semibold text-foreground line-clamp-2 leading-relaxed group-hover:text-primary transition-colors">
                  {item.question}
                </span>
              </td>
              <td className="px-5 py-3.5">
                <Badge 
                  variant="outline" 
                  className="text-xs font-medium uppercase bg-background border-border/60 text-muted-foreground rounded-md px-2 py-0.5"
                >
                  {formatEnumLabel(item.category)}
                </Badge>
              </td>
              <td className="px-5 py-3.5">
                <div className="flex flex-wrap gap-1">
                  {item.role_tags.map(tag => (
                    <Badge 
                      key={tag} 
                      variant="secondary" 
                      className="text-xs font-medium px-2 py-0.5 bg-muted text-foreground border-0 rounded-md"
                    >
                      {ROLE_LABELS[tag] ?? formatEnumLabel(tag)}
                    </Badge>
                  ))}
                </div>
              </td>
              <td className="px-5 py-3.5 text-center">
                <span className="text-xs font-medium text-muted-foreground font-mono">{item.sort_order}</span>
              </td>
              <td className="px-5 py-3.5 text-center">
                <Badge 
                  variant={item.is_active ? 'default' : 'secondary'}
                  className={cn(
                    "text-xs font-medium px-2.5 py-0.5 rounded-full border-0 capitalize",
                    item.is_active 
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                      : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-500"
                  )}
                >
                  {item.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </td>
              <td className="px-5 py-3.5 text-right">
                <div className="flex items-center justify-end gap-1 transition-all">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-all" 
                    onClick={() => onEdit(item)}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-lg text-red-600 dark:text-red-400 hover:bg-destructive/10 hover:text-red-600 dark:hover:text-red-400 transition-all" 
                    onClick={() => onDelete(item)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
