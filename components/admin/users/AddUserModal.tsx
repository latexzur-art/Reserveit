'use client'

import { useState, useEffect } from 'react'
import { z } from 'zod'
import { Copy, Check, AlertTriangle, Eye, EyeOff, Sparkles } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { RoleOption, DepartmentOption } from '@/backend/admin/admin.types'
import { rolesByType } from '@/backend/admin/admin.types'
import { INTERNAL_DOMAINS } from '@/backend/auth/auth.constants'

type AddUserSubmitResult =
  | {
      success: boolean
      userId?: string
      temporaryPassword?: string
      entra?: { userPrincipalName: string; temporaryPassword: string }
    }
  | void

interface AddUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: {
    fullName: string
    email: string
    phone?: string
    userType: 'internal' | 'external'
    roleId: string
    departmentId?: string
    organization?: string
    notificationEmail?: string
    provisionEntra?: boolean
    temporaryPassword?: string
  }) => Promise<AddUserSubmitResult> | AddUserSubmitResult
  roles: RoleOption[]
  departments: DepartmentOption[]
}

function generateRandomPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

const userSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  type: z.enum(['Internal', 'External']),
  role: z.string().min(1, 'Role is required'),
  department: z.string().optional(),
  organization: z.string().optional(),
  notificationEmail: z.union([z.literal(''), z.string().email('Invalid notification email')]).optional(),
  temporaryPassword: z.string().optional(),
})

export const AddUserModal = ({ open, onOpenChange, onSubmit, roles, departments }: AddUserModalProps) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    type: 'Internal' as 'Internal' | 'External',
    role: '',
    department: '',
    organization: '',
    notificationEmail: '',
    temporaryPassword: '',
    provisionEntra: true,
  })
  const [showTempPassword, setShowTempPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [phase, setPhase] = useState<'form' | 'credentials'>('form')
  const [credentials, setCredentials] = useState<{ upn: string; temporaryPassword: string } | null>(null)
  const [copied, setCopied] = useState<'upn' | 'password' | null>(null)

  useEffect(() => {
    if (open) {
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        type: 'Internal',
        role: '',
        department: '',
        organization: '',
        notificationEmail: '',
        temporaryPassword: '',
        provisionEntra: true,
      })
      setShowTempPassword(false)
      setErrors({})
      setPhase('form')
      setCredentials(null)
      setCopied(null)
      setSubmitting(false)
    }
  }, [open])

  const copyToClipboard = async (value: string, kind: 'upn' | 'password') => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // ignore
    }
  }

  const handleDialogOpenChange = (next: boolean) => {
    // Block accidental close while credentials are still on screen.
    if (!next && phase === 'credentials') return
    onOpenChange(next)
  }

  const filteredRoles = roles.filter(r => {
    if (formData.type === 'Internal') return r.name !== 'external_client'
    return r.name === 'external_client'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      userSchema.parse(formData)

      if (formData.type === 'Internal' && !INTERNAL_DOMAINS.some(domain => formData.email.toLowerCase().endsWith(domain))) {
        setErrors({ email: `Internal users must use an authorized domain (${INTERNAL_DOMAINS.join(', ')}) email` })
        return
      }

      // Check if email already exists
      const trimmedEmail = formData.email.trim()
      const checkRes = await fetch(`/api/admin/users/check-email?email=${encodeURIComponent(trimmedEmail)}`)
      const { exists } = await checkRes.json()

      if (exists) {
        setErrors({ email: 'A user with this email already exists' })
        return
      }

      const selectedRole = roles.find(r => r.id === formData.role)
      if (!selectedRole) return

      const finalTempPassword =
        formData.type === 'External'
          ? (formData.temporaryPassword.trim() || generateRandomPassword())
          : undefined

      setSubmitting(true)
      setErrors({})
      try {
        const result = await onSubmit({
          fullName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
          email: trimmedEmail,
          phone: formData.phone?.trim() || undefined,
          userType: formData.type === 'Internal' ? 'internal' : 'external',
          roleId: selectedRole.id,
          departmentId: formData.department || undefined,
          organization: formData.organization?.trim() || undefined,
          notificationEmail: formData.type === 'Internal' ? (formData.notificationEmail?.trim() || undefined) : undefined,
          provisionEntra: formData.type === 'Internal' ? formData.provisionEntra : false,
          temporaryPassword: finalTempPassword,
        })

        if (result && 'temporaryPassword' in result && result.temporaryPassword) {
          setCredentials({
            upn: trimmedEmail,
            temporaryPassword: result.temporaryPassword,
          })
          setPhase('credentials')
        } else if (result && 'entra' in result && result.entra?.temporaryPassword) {
          setCredentials({
            upn: result.entra.userPrincipalName,
            temporaryPassword: result.entra.temporaryPassword,
          })
          setPhase('credentials')
        } else {
          onOpenChange(false)
        }
      } catch (submitErr: any) {
        setErrors({ form: submitErr?.message || 'Failed to create user' })
      } finally {
        setSubmitting(false)
      }
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

  if (phase === 'credentials' && credentials) {
    return (
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-[500px]" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Account created — copy these credentials now</DialogTitle>
            <DialogDescription>
              The temporary password will not be shown again. Share it with the user via a secure channel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Sign-in email</Label>
              <div className="flex gap-2">
                <Input value={credentials.upn} readOnly className="font-mono text-sm" />
                <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(credentials.upn, 'upn')} aria-label="Copy email">
                  {copied === 'upn' ? <Check size={16} /> : <Copy size={16} />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Temporary password</Label>
              <div className="flex gap-2">
                <Input value={credentials.temporaryPassword} readOnly className="font-mono text-sm tracking-wider" />
                <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(credentials.temporaryPassword, 'password')} aria-label="Copy password">
                  {copied === 'password' ? <Check size={16} /> : <Copy size={16} />}
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <p className="text-xs leading-relaxed">
                This temporary password will not be shown again. The user must sign in using this temporary password and set a new permanent password on their first login.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => onOpenChange(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pr-6">
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>Create a new user account. Internal users must have an authorized domain ({INTERNAL_DOMAINS.join(', ')}) email.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input id="firstName" value={formData.firstName} onChange={(e) => setFormData(p => ({ ...p, firstName: e.target.value }))} />
              {errors.firstName && <p className="text-xs text-red-600 dark:text-red-400">{errors.firstName}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input id="lastName" value={formData.lastName} onChange={(e) => setFormData(p => ({ ...p, lastName: e.target.value }))} />
              {errors.lastName && <p className="text-xs text-red-600 dark:text-red-400">{errors.lastName}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} placeholder={formData.type === 'Internal' ? `user${INTERNAL_DOMAINS[0]}` : 'user@example.com'} />
            {errors.email && <p className="text-xs text-red-600 dark:text-red-400">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" value={formData.phone} onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="+63 XXX XXX XXXX" />
          </div>

          <div className="space-y-2">
            <Label>User Classification *</Label>
            <Select value={formData.type} onValueChange={(v) => setFormData(p => ({ ...p, type: v as 'Internal' | 'External', role: '', department: '', organization: '', temporaryPassword: '' }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Internal">Internal (STI)</SelectItem>
                <SelectItem value="External">External</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Role *</Label>
            <Select value={formData.role} onValueChange={(v) => setFormData(p => ({ ...p, role: v }))}>
              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>
                {filteredRoles.map(r => <SelectItem key={r.id} value={r.id}>{r.displayName}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.role && <p className="text-xs text-red-600 dark:text-red-400">{errors.role}</p>}
          </div>

          {formData.type === 'Internal' ? (
            <>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={formData.department} onValueChange={(v) => setFormData(p => ({ ...p, department: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.code} - {d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notificationEmail">Notification Email</Label>
                <Input
                  id="notificationEmail"
                  type="email"
                  placeholder="e.g. user@gmail.com"
                  value={formData.notificationEmail}
                  onChange={(e) => setFormData(p => ({ ...p, notificationEmail: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Personal inbox (e.g. Gmail) where booking emails are sent, since STI sign-in addresses don't receive external mail. Can be added later if left blank.</p>
                {errors.notificationEmail && <p className="text-xs text-red-600 dark:text-red-400">{errors.notificationEmail}</p>}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="organization">Organization</Label>
                <Input id="organization" value={formData.organization} onChange={(e) => setFormData(p => ({ ...p, organization: e.target.value }))} placeholder="Company or organization name" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="temporaryPassword">Temporary Password</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="temporaryPassword"
                      type={showTempPassword ? 'text' : 'password'}
                      placeholder="Enter or auto-generate temporary password"
                      value={formData.temporaryPassword}
                      onChange={(e) => setFormData(p => ({ ...p, temporaryPassword: e.target.value }))}
                      className="pr-10 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTempPassword(!showTempPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showTempPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFormData(p => ({ ...p, temporaryPassword: generateRandomPassword() }))}
                    className="shrink-0 gap-1.5"
                  >
                    <Sparkles size={14} />
                    Auto-Generate
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  The user will sign in using this temporary password and will be prompted to set a new password on their first login. If left blank, one will be auto-generated.
                </p>
                {errors.temporaryPassword && <p className="text-xs text-red-600 dark:text-red-400">{errors.temporaryPassword}</p>}
              </div>
            </>
          )}

          {formData.type === 'Internal' && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border accent-blue-600"
                  checked={formData.provisionEntra}
                  onChange={(e) => setFormData(p => ({ ...p, provisionEntra: e.target.checked }))}
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">Create Microsoft Entra account</span>
                  <span className="block text-xs text-muted-foreground">
                    Provisions an Azure AD user on the STI tenant via Microsoft Graph. A temporary password is shown to you once after creation — copy it and share it with the user. Uncheck only if the Entra account already exists.
                  </span>
                </span>
              </label>
            </div>
          )}

          {errors.form && (
            <p className="text-xs text-red-600 dark:text-red-400">{errors.form}</p>
          )}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create User'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
