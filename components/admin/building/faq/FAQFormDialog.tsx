'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Loader2, HelpCircle, Eye, Edit3, Layers, Settings2, Check, X } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export interface FAQFormData {
  question: string
  answer: string
  category: string
  role_tags: string[]
  sort_order: number
  is_active: boolean
}

interface FAQFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: FAQFormData) => Promise<void>
  initial?: FAQFormData
  title: string
}

const ALL_ROLES = [
  { value: 'all', label: 'All Roles' },
  { value: 'external_client', label: 'External Client' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'program_head', label: 'Program Head' },
  { value: 'academic_head', label: 'Academic Head' },
  { value: 'building_admin', label: 'Building Admin' },
  { value: 'it_admin', label: 'IT Admin' },
]

const EMPTY: FAQFormData = {
  question: '',
  answer: '',
  category: '',
  role_tags: [],
  sort_order: 0,
  is_active: true,
}

export function FAQFormDialog({ open, onOpenChange, onSave, initial, title }: FAQFormDialogProps) {
  const [form, setForm] = useState<FAQFormData>(initial ?? EMPTY)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write')

  useEffect(() => {
    if (open) {
      setForm(initial ?? EMPTY)
      setActiveTab('write')
    }
  }, [open, initial])

  function toggleRole(value: string) {
    if (value === 'all') {
      setForm(f => ({ ...f, role_tags: f.role_tags.includes('all') ? [] : ['all'] }))
      return
    }
    setForm(f => {
      const without = f.role_tags.filter(r => r !== 'all' && r !== value)
      const has = f.role_tags.includes(value)
      return { ...f, role_tags: has ? without : [...without, value] }
    })
  }

  async function handleSave() {
    if (!form.question.trim() || !form.answer.trim() || !form.category.trim() || form.role_tags.length === 0) return
    setSaving(true)
    try {
      await onSave(form)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const isValid = form.question.trim().length > 0 && 
                  form.answer.trim().length > 0 && 
                  form.category.trim().length > 0 && 
                  form.role_tags.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        aria-describedby="faq-dialog-description"
        className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] flex flex-col p-0 overflow-hidden border border-border bg-card shadow-2xl rounded-2xl [&>button]:hidden"
      >
        {/* Sticky Header */}
        <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between shrink-0 sticky top-0 z-10">
          <DialogHeader className="space-y-0.5 text-left">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-foreground">
                  {title}
                </DialogTitle>
                <p id="faq-dialog-description" className="text-xs text-muted-foreground mt-0.5">
                  Manage question details and role visibility for STI College Lucena
                </p>
              </div>
            </div>
          </DialogHeader>
          <DialogClose 
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </DialogClose>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Question Content */}
          <div className="space-y-2">
            <Label htmlFor="faq-question" className="text-xs font-semibold text-foreground">
              Question Content <span className="text-red-500">*</span>
            </Label>
            <Input
              id="faq-question"
              placeholder="e.g. How do I request lab equipment?"
              value={form.question}
              onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
              className="h-11 bg-background border-border rounded-xl focus-visible:ring-2 focus-visible:ring-primary text-sm"
            />
          </div>

          {/* Subject Category */}
          <div className="space-y-2">
            <Label htmlFor="faq-category" className="text-xs font-semibold text-foreground">
              Subject Category <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="faq-category"
                placeholder="e.g. Reservations, Account, Payments"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="h-11 pl-10 bg-background border-border rounded-xl focus-visible:ring-2 focus-visible:ring-primary text-sm"
              />
            </div>
          </div>

          {/* Access Permissions (Role Tags) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">
                Access Permissions (Target Roles) <span className="text-red-500">*</span>
              </Label>
              <span className="text-xs text-muted-foreground">
                Select roles authorized to see this FAQ
              </span>
            </div>

            <div className="flex flex-wrap gap-2 p-3.5 bg-muted/40 rounded-xl border border-border">
              {ALL_ROLES.map(role => {
                const checked = form.role_tags.includes(role.value)
                return (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => toggleRole(role.value)}
                    aria-pressed={checked}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      checked
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-background border-border text-foreground hover:bg-muted hover:border-border/80"
                    )}
                  >
                    {checked && <Check className="h-3.5 w-3.5 shrink-0" />}
                    {role.label}
                  </button>
                )
              })}
            </div>
            {form.role_tags.length === 0 && (
              <p className="text-xs text-destructive font-medium ml-0.5">
                Please select at least one role.
              </p>
            )}
          </div>

          {/* Answer Composition (Markdown Editor & Preview) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="faq-answer" className="text-xs font-semibold text-foreground">
                Answer Content (Markdown Supported) <span className="text-red-500">*</span>
              </Label>

              {/* Segmented Tab Switcher */}
              <div className="inline-flex p-1 bg-muted rounded-lg border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('write')}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all",
                    activeTab === 'write'
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all",
                    activeTab === 'preview'
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </button>
              </div>
            </div>

            {activeTab === 'preview' ? (
              <div className="min-h-[180px] rounded-xl border border-border bg-muted/20 p-4 prose prose-sm dark:prose-invert max-w-none text-foreground text-sm">
                {form.answer.trim() ? (
                  <ReactMarkdown>{form.answer}</ReactMarkdown>
                ) : (
                  <p className="text-muted-foreground italic text-xs">No answer text entered yet.</p>
                )}
              </div>
            ) : (
              <textarea
                id="faq-answer"
                className="w-full min-h-[180px] rounded-xl border border-border bg-background px-3.5 py-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground/60 transition-all"
                placeholder={`Provide step-by-step instructions. Markdown formatting supported:
• **bold text**
• 1. Step one
• > Helpful notes or Azure/SSO reminders`}
                value={form.answer}
                onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
              />
            )}
          </div>

          {/* Settings Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
            <div className="space-y-1.5">
              <Label htmlFor="faq-sort" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                Display Priority Order
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="faq-sort"
                  type="number"
                  min={0}
                  max={999}
                  value={form.sort_order}
                  onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                  className="h-10 w-24 bg-background border-border rounded-lg text-sm font-medium"
                />
                <span className="text-xs text-muted-foreground">
                  Lower numbers appear first in list
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 sm:pt-6">
              <div className="text-right">
                <Label htmlFor="faq-active" className="text-xs font-semibold text-foreground cursor-pointer block">
                  Publish Status
                </Label>
                <span className="text-[11px] text-muted-foreground block">
                  {form.is_active ? 'Visible to users' : 'Hidden draft'}
                </span>
              </div>
              <Switch
                id="faq-active"
                checked={form.is_active}
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Sticky Footer with Clear CTAs */}
        <DialogFooter className="bg-muted/30 px-6 py-4 border-t border-border flex flex-row items-center justify-end gap-3 shrink-0">
          <Button 
            type="button"
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            disabled={saving}
            className="rounded-xl px-5 font-medium text-xs h-10 hover:bg-background transition-all"
          >
            Cancel
          </Button>
          <Button 
            type="button"
            onClick={handleSave} 
            disabled={!isValid || saving}
            className="rounded-xl bg-primary text-primary-foreground font-semibold text-xs h-10 px-6 hover:bg-primary/90 shadow-sm transition-all"
          >
            {saving && <Loader2 size={14} className="animate-spin mr-2" />}
            {initial ? 'Save Changes' : 'Create FAQ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}