'use client'

import { useState, useEffect } from 'react'
import { Server, Check, Loader2, Sparkles, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'

interface TenantInfo {
  mode: 'sti' | 'test' | 'unknown'
  name: string
  tenantId: string
  clientId: string
}

export const TenantSwitcherBadge = () => {
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const { toast } = useToast()

  const fetchTenant = async () => {
    try {
      const res = await fetch('/api/admin/tenant-switch')
      if (res.ok) {
        const data = await res.json()
        setTenant(data)
      }
    } catch {
      // ignore error
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTenant()
  }, [])

  const handleSwitch = async (targetMode: 'sti' | 'test') => {
    if (!tenant || tenant.mode === targetMode || switching) return
    setSwitching(true)
    try {
      const res = await fetch('/api/admin/tenant-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: targetMode }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        setTenant({
          mode: data.mode,
          name: data.name,
          tenantId: data.tenantId,
          clientId: data.clientId,
        })
        toast({
          title: 'Active Tenant Switched',
          description: `Now connected to ${data.name}`,
        })
      } else {
        toast({
          title: 'Switch Failed',
          description: data.error || 'Could not switch active tenant',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to switch tenant',
        variant: 'destructive',
      })
    } finally {
      setSwitching(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border border-border bg-muted/50 text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Loading tenant…</span>
      </div>
    )
  }

  const isSti = tenant?.mode === 'sti'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={switching}>
        <Button
          variant="outline"
          size="sm"
          className={`h-8 gap-2 rounded-full text-xs font-semibold px-3 transition-all ${
            isSti
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
          }`}
        >
          {switching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Server className="w-3.5 h-3.5" />
          )}
          <span>{isSti ? '⚡ STI Lucena (Live)' : '🧪 ReserveIT Dev Test'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Active Microsoft Tenant
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => handleSwitch('sti')}
          className="flex items-center justify-between cursor-pointer py-2"
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 font-medium text-xs text-emerald-600 dark:text-emerald-400">
              <span>⚡ STI College Lucena</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Live tenant (STI Faculty sign-in)</p>
          </div>
          {isSti && <Check className="w-4 h-4 text-emerald-600" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleSwitch('test')}
          className="flex items-center justify-between cursor-pointer py-2"
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 font-medium text-xs text-amber-600 dark:text-amber-400">
              <span>🧪 ReserveIT Test Tenant</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Dev tenant (Account creation test)</p>
          </div>
          {!isSti && <Check className="w-4 h-4 text-amber-600" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
