'use client'

import { useState, useEffect } from 'react'
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
import type { User } from '@/backend/admin/admin.types'
import { useToast } from '@/hooks/use-toast'
import { Mail, Bell, Send } from 'lucide-react'

interface SendMessageModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  onSendMessage?: (data: { recipientId: string; recipientName: string; subject: string; body: string; sendAs: 'email' | 'in-app' | 'both' }) => void
}

const messageSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(100),
  body: z.string().min(1, 'Message is required').max(1000),
  sendAs: z.enum(['email', 'in-app', 'both']),
})

export const SendMessageModal = ({ open, onOpenChange, user, onSendMessage }: SendMessageModalProps) => {
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    subject: '',
    body: '',
    sendAs: 'both' as 'email' | 'in-app' | 'both',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setFormData({ subject: '', body: '', sendAs: 'both' })
      setErrors({})
    }
  }, [open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      messageSchema.parse(formData)

      if (onSendMessage) {
        onSendMessage({
          recipientId: user.id,
          recipientName: `${user.firstName} ${user.lastName}`,
          subject: formData.subject.trim(),
          body: formData.body.trim(),
          sendAs: formData.sendAs,
        })
      } else {
        toast({
          title: 'Message Sent',
          description: `Message sent to ${user.firstName} ${user.lastName}.`,
        })
      }
      onOpenChange(false)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {}
        error.issues.forEach(err => {
          if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message
        })
        setErrors(fieldErrors)
      }
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Message</DialogTitle>
          <DialogDescription>Send a direct message to {user.firstName} {user.lastName}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm">
              <span className="text-muted-foreground">To:</span>{' '}
              <span className="font-medium">{user.firstName} {user.lastName}</span>{' '}
              <span className="text-muted-foreground">({user.email})</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input id="subject" value={formData.subject} onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))} placeholder="Message subject" />
            {errors.subject && <p className="text-xs text-red-600 dark:text-red-400">{errors.subject}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Message *</Label>
            <Textarea id="body" value={formData.body} onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))} placeholder="Type your message here..." rows={5} className="resize-none" />
            {errors.body && <p className="text-xs text-red-600 dark:text-red-400">{errors.body}</p>}
            <p className="text-xs text-muted-foreground text-right">{formData.body.length}/1000 characters</p>
          </div>

          <div className="space-y-2">
            <Label>Send As</Label>
            <Select value={formData.sendAs} onValueChange={(v: 'email' | 'in-app' | 'both') => setFormData(prev => ({ ...prev, sendAs: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email"><div className="flex items-center gap-2"><Mail className="h-4 w-4" /><span>Email only</span></div></SelectItem>
                <SelectItem value="in-app"><div className="flex items-center gap-2"><Bell className="h-4 w-4" /><span>In-app notification only</span></div></SelectItem>
                <SelectItem value="both"><div className="flex items-center gap-2"><Send className="h-4 w-4" /><span>Both email and in-app</span></div></SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit"><Send className="h-4 w-4 mr-2" />Send Message</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
