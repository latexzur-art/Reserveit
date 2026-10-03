'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  ShieldAlert, ShieldCheck, AlertCircle, RefreshCw, UserCheck,
  Loader2, Ban, History, UserX, ChevronsUpDown, Check, Search, User,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { accountStatusLabel } from '@/lib/enum-labels'

interface RestrictedUser {
  id: string
  full_name: string
  email: string
  account_status: 'restricted' | 'probation'
  consecutive_cancellations: number
  restricted_at: string | null
  restricted_reason: string | null
  probation_started_at: string | null
}

export default function RestrictedUsersPage() {
  const { toast } = useToast()
  const [users, setUsers] = useState<RestrictedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionUser, setActionUser] = useState<RestrictedUser | null>(null)
  const [actionType, setActionType] = useState<'lift' | 'end_probation' | null>(null)
  const [acting, setActing] = useState(false)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'restricted' | 'probation'>('all')

  // Enforce modal state
  const [enforceOpen, setEnforceOpen] = useState(false)
  const [enforcePickerOpen, setEnforcePickerOpen] = useState(false)
  const [allUsers, setAllUsers] = useState<Array<{ id: string; full_name: string; email: string }>>([])
  const [allUsersLoading, setAllUsersLoading] = useState(false)
  const [enforceTarget, setEnforceTarget] = useState<{ id: string; full_name: string; email: string } | null>(null)
  const [enforceStatus, setEnforceStatus] = useState<'probation' | 'restricted'>('probation')
  const [enforceReason, setEnforceReason] = useState('')
  const [enforceSubmitting, setEnforceSubmitting] = useState(false)
  const [touched, setTouched] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/building/restricted-users')
      if (!res.ok) throw new Error('Failed to fetch restricted users')
      const data = await res.json()
      setUsers(data.users || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load restricted users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const loadAllUsers = useCallback(async () => {
    if (allUsers.length > 0) return
    setAllUsersLoading(true)
    try {
      const res = await fetch('/api/admin/building/directory?status=active&pageSize=200')
      const data = await res.json()
      setAllUsers((data.items ?? []).map((p: any) => ({
        id: p.id,
        full_name: p.name ?? '',
        email: p.email ?? '',
      })))
    } catch { setAllUsers([]) }
    finally { setAllUsersLoading(false) }
  }, [allUsers.length])

  const handleEnforceSubmit = async () => {
    setTouched(true)
    if (!enforceTarget || !enforceReason.trim()) return
    setEnforceSubmitting(true)
    try {
      const res = await fetch(`/api/admin/building/restricted-users/${enforceTarget.id}/enforce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: enforceStatus, reason: enforceReason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      toast({ title: 'Success', description: data.message })
      setEnforceOpen(false)
      setEnforceTarget(null)
      setEnforceReason('')
      setEnforceStatus('probation')
      setTouched(false)
      fetchUsers()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setEnforceSubmitting(false)
    }
  }

  const handleAction = async () => {
    if (!actionUser || !actionType) return
    setActing(true)
    try {
      const endpoint = actionType === 'lift'
        ? `/api/admin/building/restricted-users/${actionUser.id}/lift`
        : `/api/admin/building/restricted-users/${actionUser.id}/end-probation`

      const res = await fetch(endpoint, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Action failed')

      toast({ title: 'Success', description: data.message })
      fetchUsers()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setActing(false)
      setActionUser(null)
      setActionType(null)
    }
  }

  const restrictedCount = users.filter(u => u.account_status === 'restricted').length
  const probationCount = users.filter(u => u.account_status === 'probation').length

  const filteredUsers = users.filter(u => {
    const matchesStatus = statusFilter === 'all' || u.account_status === statusFilter
    const q = searchQuery.toLowerCase().trim()
    const matchesSearch = !q ||
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.restricted_reason && u.restricted_reason.toLowerCase().includes(q))
    return matchesStatus && matchesSearch
  })

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
        <p className="text-xs font-medium text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={fetchUsers} className="rounded-xl font-semibold text-xs">
          <RefreshCw className="w-4 h-4 mr-2" /> Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10 px-4 lg:px-0">
      
      {/* BRAND HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">Restricted <span className="text-accent-brand">Users</span></h1>
          <p className="text-xs font-medium text-muted-foreground mt-1">
            Manage automated booking restrictions, account probation, and manual overrides for STI College Lucena
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            onClick={fetchUsers}
            variant="outline"
            aria-label="Synchronize database records"
            className="font-semibold text-xs h-10 px-4 rounded-xl border-border bg-card hover:bg-muted text-foreground transition-all active:scale-95 shadow-xs"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-2 text-primary", loading && "animate-spin")} />
            Sync Records
          </Button>

          <Button
            onClick={() => setEnforceOpen(true)}
            variant="outline"
            className="font-semibold text-xs h-10 px-4 rounded-xl border-destructive/30 bg-destructive/5 hover:bg-destructive/10 text-destructive transition-all active:scale-95 shadow-xs"
          >
            <UserX className="w-3.5 h-3.5 mr-2" />
            Restrict User
          </Button>
        </div>
      </div>

      {/* STATS OVERVIEW - CLEAN DESIGN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border bg-card rounded-2xl overflow-hidden shadow-xs hover:border-border/80 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                <Ban className="w-3.5 h-3.5" />
              </div>
              Fully Restricted Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{restrictedCount}</div>
            <p className="text-xs font-medium text-muted-foreground mt-1">Accounts blocked from facility booking access</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card rounded-2xl overflow-hidden shadow-xs hover:border-border/80 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
                <History className="w-3.5 h-3.5" />
              </div>
              Accounts on Probation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{probationCount}</div>
            <p className="text-xs font-medium text-muted-foreground mt-1">Manual administrative approval required for reservations</p>
          </CardContent>
        </Card>
      </div>

      {/* TABLE CONTROLS & SEARCH TOOLBAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <Tabs value={statusFilter} onValueChange={(val) => setStatusFilter(val as any)} className="w-full sm:w-auto">
          <TabsList className="bg-muted/60 border border-border p-1 rounded-xl h-10">
            <TabsTrigger value="all" className="text-xs font-semibold rounded-lg px-3">
              All Accounts ({users.length})
            </TabsTrigger>
            <TabsTrigger value="restricted" className="text-xs font-semibold rounded-lg px-3">
              Restricted ({restrictedCount})
            </TabsTrigger>
            <TabsTrigger value="probation" className="text-xs font-semibold rounded-lg px-3">
              Probation ({probationCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, or reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 text-xs rounded-xl bg-card border-border focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
      </div>

      {/* RESTRICTED USERS TABLE */}
      <Card className="border-border bg-card rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs font-semibold pl-6 h-12 text-muted-foreground">User Name</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground">Email</TableHead>
                <TableHead className="text-xs font-semibold text-center text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs font-semibold text-center text-muted-foreground">Cancellations</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground">Restricted Date</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground">Reason</TableHead>
                <TableHead className="text-right text-xs font-semibold pr-6 text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-20 border-border">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto text-primary mb-3" />
                    <span className="text-xs font-medium text-muted-foreground">Synchronizing records...</span>
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-20 border-border">
                    <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm font-semibold text-foreground">No Restricted Users Found</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      {searchQuery || statusFilter !== 'all'
                        ? "No user records match your search or filter settings."
                        : "All facility access controls and user accounts are operating normally."}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map(u => (
                  <TableRow key={u.id} className="hover:bg-muted/40 border-border transition-colors group">
                    <TableCell className="pl-6 py-4">
                      <span className="text-xs font-semibold text-foreground">{u.full_name}</span>
                    </TableCell>
                    
                    <TableCell>
                      <span className="text-xs text-muted-foreground font-mono">
                        {u.email}
                      </span>
                    </TableCell>

                    <TableCell className="text-center">
                      <Badge className={cn(
                        "rounded-full px-3 py-0.5 text-[11px] font-semibold capitalize border shadow-none",
                        u.account_status === 'restricted' 
                          ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" 
                          : "bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-500/20"
                      )}>
                        {accountStatusLabel(u.account_status)}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-center">
                      <span className="font-bold text-xs text-foreground">{u.consecutive_cancellations}</span>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs font-medium text-muted-foreground">
                        {u.restricted_at ? new Date(u.restricted_at).toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </span>
                    </TableCell>

                    <TableCell className="max-w-[180px]">
                      <span className="text-xs font-medium text-muted-foreground italic truncate block">
                        {u.restricted_reason || 'Policy Violation'}
                      </span>
                    </TableCell>

                    <TableCell className="text-right pr-6">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setActionUser(u);
                          setActionType(u.account_status === 'restricted' ? 'lift' : 'end_probation');
                        }}
                        className="h-9 px-4 rounded-xl font-semibold text-xs gap-2 hover:bg-primary/10 text-primary transition-all"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Modify Status
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* RESTRICT USER MODAL */}
      <Dialog 
        open={enforceOpen} 
        onOpenChange={(o) => { 
          if (!o) { 
            setEnforceOpen(false); 
            setEnforceTarget(null); 
            setEnforceReason(''); 
            setEnforceStatus('probation'); 
            setTouched(false);
          } 
        }}
      >
        <DialogContent className="sm:max-w-[500px] rounded-2xl p-6 border border-border bg-card shadow-2xl">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <div className="p-2 rounded-lg bg-red-500/10 text-red-500 shrink-0">
                <UserX className="w-5 h-5" />
              </div>
              Apply User Restriction
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Select an active user and apply probation (requires manual approval) or full restriction (blocks facility bookings).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* User dropdown */}
            <div className="space-y-1.5">
              <Label id="enforce-user-label" className="text-xs font-semibold text-foreground flex items-center justify-between">
                Target User <span className="text-red-500">*</span>
              </Label>
              <Popover open={enforcePickerOpen} onOpenChange={(o) => { setEnforcePickerOpen(o); if (o) loadAllUsers() }}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    id="enforce-user-trigger"
                    aria-labelledby="enforce-user-label"
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-left transition-all',
                      'border-border bg-background hover:border-border/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      !enforceTarget && 'text-muted-foreground',
                      touched && !enforceTarget && 'border-destructive ring-1 ring-destructive'
                    )}
                  >
                    <div className="min-w-0 flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        {enforceTarget ? (
                          <>
                            <p className="text-xs font-bold text-foreground truncate">{enforceTarget.full_name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{enforceTarget.email}</p>
                          </>
                        ) : (
                          <span className="text-xs font-medium">Select an active user…</span>
                        )}
                      </div>
                    </div>
                    {allUsersLoading
                      ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />
                      : <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    }
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" sideOffset={4} className="p-0 w-[var(--radix-popover-trigger-width)] rounded-xl border border-border bg-card shadow-lg">
                  <Command className="rounded-xl">
                    <CommandInput placeholder="Search by name or email…" className="text-xs h-10" />
                    <CommandList className="max-h-56">
                      <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No active users found.</CommandEmpty>
                      <CommandGroup>
                        {allUsers.map((u) => (
                          <CommandItem
                            key={u.id}
                            value={`${u.full_name} ${u.email}`}
                            onSelect={() => { setEnforceTarget(u); setEnforcePickerOpen(false) }}
                            className="cursor-pointer py-2 px-3 text-xs"
                          >
                            <Check className={cn('mr-2 h-4 w-4 shrink-0 text-primary', enforceTarget?.id === u.id ? 'opacity-100' : 'opacity-0')} />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold truncate">{u.full_name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {touched && !enforceTarget && (
                <p className="text-xs text-destructive font-medium">Please select a target user.</p>
              )}
            </div>

            {/* Status selector */}
            <div className="space-y-1.5">
              <Label id="enforce-restriction-type-label" className="text-xs font-semibold text-foreground">Restriction Type</Label>
              <div role="radiogroup" aria-labelledby="enforce-restriction-type-label" className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  role="radio"
                  aria-checked={enforceStatus === 'probation'}
                  onClick={() => setEnforceStatus('probation')}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setEnforceStatus('restricted')
                  }}
                  className={cn(
                    'p-3.5 rounded-xl border-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary relative',
                    enforceStatus === 'probation'
                      ? 'border-amber-500 bg-amber-500/10 shadow-xs'
                      : 'border-border bg-background hover:border-border/80'
                  )}
                >
                  {enforceStatus === 'probation' && (
                    <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                  <History className="w-4 h-4 text-amber-600 dark:text-amber-400 mb-1.5" />
                  <p className="text-xs font-bold text-foreground">Probation</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">Manual approval required</p>
                </button>
                
                <button
                  type="button"
                  role="radio"
                  aria-checked={enforceStatus === 'restricted'}
                  onClick={() => setEnforceStatus('restricted')}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setEnforceStatus('probation')
                  }}
                  className={cn(
                    'p-3.5 rounded-xl border-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary relative',
                    enforceStatus === 'restricted'
                      ? 'border-red-500 bg-red-500/10 shadow-xs'
                      : 'border-border bg-background hover:border-border/80'
                  )}
                >
                  {enforceStatus === 'restricted' && (
                    <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px]">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                  <Ban className="w-4 h-4 text-red-500 mb-1.5" />
                  <p className="text-xs font-bold text-foreground">Full Restriction</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">All bookings blocked</p>
                </button>
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <Label htmlFor="enforce-reason" className="text-xs font-semibold text-foreground">
                Reason <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="enforce-reason"
                value={enforceReason}
                onChange={(e) => setEnforceReason(e.target.value)}
                placeholder="Explain why this user is being restricted…"
                rows={3}
                maxLength={500}
                className={cn(
                  "resize-none text-xs rounded-xl bg-background border-border focus-visible:ring-2 focus-visible:ring-primary",
                  touched && !enforceReason.trim() && "border-destructive ring-1 ring-destructive"
                )}
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                {touched && !enforceReason.trim() ? (
                  <span className="text-destructive font-medium">Reason description is required.</span>
                ) : (
                  <span>Provide clear justification for the audit log.</span>
                )}
                <span aria-live="polite">{enforceReason.length}/500</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="ghost" onClick={() => setEnforceOpen(false)} disabled={enforceSubmitting} className="rounded-xl text-xs h-10 font-medium">
              Cancel
            </Button>
            <Button
              onClick={handleEnforceSubmit}
              disabled={enforceSubmitting || !enforceTarget || !enforceReason.trim()}
              className={cn(
                'font-semibold text-xs h-10 px-5 rounded-xl text-white transition-all shadow-sm',
                enforceStatus === 'restricted' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
              )}
            >
              {enforceSubmitting && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
              Apply {enforceStatus === 'restricted' ? 'Restriction' : 'Probation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ACTION DIALOG */}
      <AlertDialog open={!!actionUser} onOpenChange={(o) => { if(!o) setActionUser(null) }}>
        <AlertDialogContent className="rounded-2xl p-6 bg-card border border-border shadow-2xl">
          <AlertDialogHeader>
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <AlertDialogTitle className="text-lg font-bold text-foreground">
              Modify User Status
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-medium text-muted-foreground mt-2 leading-relaxed">
              You are overriding the current restriction status for <span className="text-foreground font-semibold">{actionUser?.full_name}</span> ({actionUser?.email}). This action will be logged in the audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel disabled={acting} className="rounded-xl font-semibold text-xs h-10 border-border bg-card hover:bg-muted text-foreground">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              disabled={acting}
              className="rounded-xl font-semibold text-xs h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
            >
              {acting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserCheck className="w-4 h-4 mr-2" />}
              Confirm Status Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}