'use client'

import { useState, useEffect, useMemo } from 'react'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import type { User, Message, Broadcast, MessageTemplate } from '@/backend/admin/admin.types'
import {
  Mail, Bell, Send, ChevronsUpDown, X, Users, Building, Globe, Shield,
  UserPlus, UserX, KeyRound, ShieldCheck, Lightbulb, Plus, Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { userRoleLabel } from '@/lib/enum-labels'

interface UnifiedMessageCenterProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  users: User[]
  onSendMessage: (message: Omit<Message, 'id' | 'sentAt' | 'status'>) => void
  onSendBroadcast: (broadcast: Omit<Broadcast, 'id' | 'createdAt' | 'sentAt'>) => void
  preselectedUser?: User | null
}

const messageSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(100),
  body: z.string().min(1, 'Message is required').max(1000),
  sendAs: z.enum(['email', 'in-app', 'both']),
})

const templateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(50),
  subject: z.string().min(1, 'Subject is required').max(100),
  body: z.string().min(1, 'Body is required').max(1000),
})

const audiences = [
  { id: 'all', label: 'All Users', icon: Users, description: 'Send to everyone in the system' },
  { id: 'internal', label: 'Internal Only', icon: Building, description: 'STI staff, faculty & students' },
  { id: 'external', label: 'External Only', icon: Globe, description: 'External clients' },
  { id: 'admins', label: 'Admins Only', icon: Shield, description: 'IT Admins & Building Admins' },
]

const defaultTemplates: MessageTemplate[] = [
  { id: 'welcome', name: 'Welcome Message', icon: 'UserPlus', subject: 'Welcome to ReserveIT!', body: 'Welcome to ReserveIT! Your account has been successfully created.\n\nTo get started:\n1. Complete your profile\n2. Browse available facilities\n3. Make your first reservation\n\nIf you have any questions, please contact our support team.' },
  { id: 'account-deactivation', name: 'Account Deactivation', icon: 'UserX', subject: 'Your ReserveIT Account Has Been Deactivated', body: 'Dear [User Name],\n\nWe are writing to inform you that your ReserveIT account has been deactivated.\n\nReason: [reason]\n\nIf you believe this was done in error, please contact the administration.' },
  { id: 'password-reset', name: 'Password Reset', icon: 'KeyRound', subject: 'Password Reset Instructions', body: 'Dear [User Name],\n\nA password reset has been initiated for your ReserveIT account.\n\nTo reset your password:\n1. Click the link below (valid for 24 hours)\n2. Enter your new password\n3. Confirm your new password\n\nIf you did not request this reset, please contact the administrator.' },
  { id: 'role-change', name: 'Role Change Notice', icon: 'ShieldCheck', subject: 'Your Role Has Been Updated', body: 'Dear [User Name],\n\nYour role in ReserveIT has been updated.\n\nPrevious role: [old role]\nNew role: [new role]\n\nThis change may affect your permissions and access to certain features.' },
]

const getTemplateIcon = (iconName: string) => {
  const icons: Record<string, typeof UserPlus> = { UserPlus, UserX, KeyRound, ShieldCheck }
  return icons[iconName] || Lightbulb
}

interface CustomTemplate extends MessageTemplate { isCustom: true }

const CUSTOM_TEMPLATES_KEY = 'reserveit-custom-message-templates'

const loadCustomTemplates = (): CustomTemplate[] => {
  try {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(CUSTOM_TEMPLATES_KEY) : null
    return stored ? JSON.parse(stored) : []
  } catch { return [] }
}

const saveCustomTemplates = (templates: CustomTemplate[]) => {
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates))
}

export const UnifiedMessageCenter = ({
  open,
  onOpenChange,
  users,
  onSendMessage,
  onSendBroadcast,
  preselectedUser,
}: UnifiedMessageCenterProps) => {
  const [recipientMode, setRecipientMode] = useState<'select' | 'audience'>('select')
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [userSearchOpen, setUserSearchOpen] = useState(false)
  const [targetAudience, setTargetAudience] = useState('all')
  const [formData, setFormData] = useState({ subject: '', body: '', sendAs: 'both' as 'email' | 'in-app' | 'both' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPreview, setShowPreview] = useState(false)
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(() => loadCustomTemplates())
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)
  const [newTemplate, setNewTemplate] = useState({ name: '', subject: '', body: '' })
  const [templateErrors, setTemplateErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      if (preselectedUser) {
        setRecipientMode('select')
        setSelectedUsers([preselectedUser])
      } else {
        setSelectedUsers([])
      }
      setFormData({ subject: '', body: '', sendAs: 'both' })
      setTargetAudience('all')
      setErrors({})
      setShowPreview(false)
      setShowCreateTemplate(false)
      setNewTemplate({ name: '', subject: '', body: '' })
      setTemplateErrors({})
    }
  }, [open, preselectedUser])

  const availableUsers = useMemo(() => users.filter(u => !selectedUsers.find(s => s.id === u.id)), [users, selectedUsers])

  const handleSelectUser = (user: User) => {
    setSelectedUsers(prev => [...prev, user])
    setUserSearchOpen(false)
  }

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId))
  }

  const handleApplyTemplate = (template: MessageTemplate) => {
    setFormData(prev => ({ ...prev, subject: template.subject, body: template.body }))
    setShowPreview(false)
  }

  const handleSaveCustomTemplate = () => {
    try {
      templateSchema.parse(newTemplate)
      const template: CustomTemplate = {
        id: `custom-${Date.now()}`,
        name: newTemplate.name.trim(),
        icon: 'Lightbulb',
        subject: newTemplate.subject.trim(),
        body: newTemplate.body.trim(),
        isCustom: true,
      }
      const updated = [...customTemplates, template]
      setCustomTemplates(updated)
      saveCustomTemplates(updated)
      setNewTemplate({ name: '', subject: '', body: '' })
      setTemplateErrors({})
      setShowCreateTemplate(false)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {}
        error.issues.forEach(err => { if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message })
        setTemplateErrors(fieldErrors)
      }
    }
  }

  const handleDeleteCustomTemplate = (templateId: string) => {
    const updated = customTemplates.filter(t => t.id !== templateId)
    setCustomTemplates(updated)
    saveCustomTemplates(updated)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (recipientMode === 'select' && selectedUsers.length === 0) {
      setErrors({ recipient: 'Please select at least one recipient' })
      return
    }
    try {
      messageSchema.parse(formData)
      if (recipientMode === 'audience' && !showPreview) {
        setShowPreview(true)
        return
      }
      if (recipientMode === 'select') {
        selectedUsers.forEach(user => {
          onSendMessage({
            recipientId: user.id,
            recipientName: `${user.firstName} ${user.lastName}`,
            subject: formData.subject.trim(),
            body: formData.body.trim(),
            sendAs: formData.sendAs,
          })
        })
      } else {
        onSendBroadcast({
          title: formData.subject.trim(),
          message: formData.body.trim(),
          targetAudience: targetAudience as 'all' | 'internal' | 'external',
        })
      }
      onOpenChange(false)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {}
        error.issues.forEach(err => { if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message })
        setErrors(fieldErrors)
      }
    }
  }

  const handleReset = () => {
    setFormData({ subject: '', body: '', sendAs: 'both' })
    setSelectedUsers(preselectedUser ? [preselectedUser] : [])
    setTargetAudience('all')
    setErrors({})
    setShowPreview(false)
  }

  const getSubmitButtonText = () => {
    if (recipientMode === 'audience') return showPreview ? 'Confirm & Send Broadcast' : 'Preview Broadcast'
    const count = selectedUsers.length
    return `Send to ${count} ${count === 1 ? 'user' : 'users'}`
  }

  const isSubmitDisabled = recipientMode === 'select' && selectedUsers.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Message Center</DialogTitle>
          <DialogDescription>Send messages to individual users or broadcast announcements</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <Tabs value={recipientMode} onValueChange={(v) => { setRecipientMode(v as 'select' | 'audience'); setShowPreview(false) }} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="select" className="flex items-center gap-2"><Users className="h-4 w-4" />Select Recipients</TabsTrigger>
              <TabsTrigger value="audience" className="flex items-center gap-2"><Building className="h-4 w-4" />Target Audience</TabsTrigger>
            </TabsList>

            <TabsContent value="select" className="space-y-3 mt-4">
              <div className="space-y-2">
                <Label>Recipients *</Label>
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {selectedUsers.map(user => (
                      <Badge key={user.id} variant="secondary" className="pl-2 pr-1 py-1 gap-1">
                        {user.firstName} {user.lastName}
                        <button type="button" onClick={() => handleRemoveUser(user.id)} className="ml-1 hover:bg-muted rounded-full p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={userSearchOpen} className="w-full justify-between">
                      <span className="text-muted-foreground">{selectedUsers.length === 0 ? 'Search and select users...' : 'Add more recipients...'}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search users by name or email..." />
                      <CommandList>
                        <CommandEmpty>No users found.</CommandEmpty>
                        <CommandGroup>
                          {availableUsers.map((user) => (
                            <CommandItem key={user.id} value={`${user.firstName} ${user.lastName} ${user.email}`} onSelect={() => handleSelectUser(user)}>
                              <div className="flex items-center gap-2 flex-1">
                                <div className="flex-1">
                                  <p className="font-medium">{user.firstName} {user.lastName}</p>
                                  <p className="text-xs text-muted-foreground">{user.email}</p>
                                </div>
                                <Badge variant="outline" className="text-xs">{userRoleLabel(user.role)}</Badge>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {errors.recipient && <p className="text-xs text-red-600 dark:text-red-400">{errors.recipient}</p>}
              </div>
            </TabsContent>

            <TabsContent value="audience" className="space-y-3 mt-4">
              <div className="space-y-2">
                <Label>Target Audience</Label>
                <div className="grid gap-2">
                  {audiences.map((audience) => (
                    <label key={audience.id} className={cn('flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors', targetAudience === audience.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50', showPreview && 'opacity-60 pointer-events-none')}>
                      <Checkbox checked={targetAudience === audience.id} onCheckedChange={() => { setTargetAudience(audience.id); setShowPreview(false) }} disabled={showPreview} />
                      <audience.icon className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{audience.label}</p>
                        <p className="text-xs text-muted-foreground">{audience.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Quick Templates */}
          <div className="space-y-2 pt-2 border-t">
            <Label className="flex items-center gap-2"><Lightbulb className="h-4 w-4" />Quick Templates</Label>
            <div className="flex flex-wrap gap-2">
              {defaultTemplates.map((template) => {
                const IconComponent = getTemplateIcon(template.icon)
                return (
                  <Button key={template.id} type="button" variant="outline" size="sm" onClick={() => handleApplyTemplate(template)} className="text-xs h-8" disabled={showPreview}>
                    <IconComponent className="h-3 w-3 mr-1" />{template.name}
                  </Button>
                )
              })}
              {customTemplates.map((template) => (
                <div key={template.id} className="flex items-center gap-0.5">
                  <Button type="button" variant="outline" size="sm" onClick={() => handleApplyTemplate(template)} className="text-xs h-8 rounded-r-none" disabled={showPreview}>
                    <Lightbulb className="h-3 w-3 mr-1" />{template.name}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => handleDeleteCustomTemplate(template.id)} className="text-xs h-8 px-1.5 rounded-l-none border-l-0 text-red-600 dark:text-red-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-destructive/10" disabled={showPreview}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateTemplate(!showCreateTemplate)} className="text-xs h-8 border-dashed" disabled={showPreview}>
                <Plus className="h-3 w-3 mr-1" />Create Template
              </Button>
            </div>

            {showCreateTemplate && (
              <div className="mt-3 p-3 border rounded-lg bg-muted/30 space-y-3">
                <p className="text-sm font-medium">New Custom Template</p>
                <div className="space-y-2">
                  <div>
                    <Input placeholder="Template name" value={newTemplate.name} onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))} className="h-8 text-sm" />
                    {templateErrors.name && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{templateErrors.name}</p>}
                  </div>
                  <div>
                    <Input placeholder="Subject line" value={newTemplate.subject} onChange={(e) => setNewTemplate(prev => ({ ...prev, subject: e.target.value }))} className="h-8 text-sm" />
                    {templateErrors.subject && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{templateErrors.subject}</p>}
                  </div>
                  <div>
                    <Textarea placeholder="Message body..." value={newTemplate.body} onChange={(e) => setNewTemplate(prev => ({ ...prev, body: e.target.value }))} rows={3} className="resize-none text-sm" />
                    {templateErrors.body && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{templateErrors.body}</p>}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setShowCreateTemplate(false); setNewTemplate({ name: '', subject: '', body: '' }); setTemplateErrors({}) }} className="text-xs h-7">Cancel</Button>
                  <Button type="button" size="sm" onClick={handleSaveCustomTemplate} className="text-xs h-7">Save Template</Button>
                </div>
              </div>
            )}
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="message-subject">Subject *</Label>
            <Input id="message-subject" value={formData.subject} onChange={(e) => { setFormData(prev => ({ ...prev, subject: e.target.value })); setShowPreview(false) }} placeholder="Message subject" disabled={showPreview} />
            {errors.subject && <p className="text-xs text-red-600 dark:text-red-400">{errors.subject}</p>}
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="message-body">Message *</Label>
            <Textarea id="message-body" value={formData.body} onChange={(e) => { setFormData(prev => ({ ...prev, body: e.target.value })); setShowPreview(false) }} placeholder="Type your message here..." rows={5} className="resize-none" disabled={showPreview} />
            {errors.body && <p className="text-xs text-red-600 dark:text-red-400">{errors.body}</p>}
            <p className="text-xs text-muted-foreground text-right">{formData.body.length}/1000 characters</p>
          </div>

          {/* Delivery Method */}
          <div className="space-y-2">
            <Label>Delivery Method</Label>
            <Select value={formData.sendAs} onValueChange={(v: 'email' | 'in-app' | 'both') => setFormData(prev => ({ ...prev, sendAs: v }))} disabled={showPreview}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email"><div className="flex items-center gap-2"><Mail className="h-4 w-4" /><span>Email only</span></div></SelectItem>
                <SelectItem value="in-app"><div className="flex items-center gap-2"><Bell className="h-4 w-4" /><span>In-app notification only</span></div></SelectItem>
                <SelectItem value="both"><div className="flex items-center gap-2"><Send className="h-4 w-4" /><span>Both email and in-app</span></div></SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          {showPreview && recipientMode === 'audience' && (
            <div className="p-4 bg-muted/50 rounded-lg border-2 border-primary/20 space-y-2">
              <p className="text-xs font-medium text-primary uppercase tracking-wide">Broadcast Preview</p>
              <h4 className="font-semibold">{formData.subject}</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{formData.body}</p>
              <p className="text-xs text-muted-foreground">
                Target: {audiences.find(a => a.id === targetAudience)?.label} {' \u2022 '} Delivery: {formData.sendAs === 'both' ? 'Email + In-app' : formData.sendAs === 'email' ? 'Email only' : 'In-app only'}
              </p>
            </div>
          )}

          <DialogFooter className="pt-4 gap-2">
            <Button type="button" variant="outline" onClick={handleReset}>Reset</Button>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitDisabled}><Send className="h-4 w-4 mr-2" />{getSubmitButtonText()}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
