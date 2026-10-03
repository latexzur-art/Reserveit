'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { HardDrive, Image as ImageIcon, RefreshCw, FileText, QrCode, Receipt } from 'lucide-react'
import { useStorageUsage } from '@/hooks/admin/building'

// ponytail: no real quota API — Supabase doesn't expose a per-project storage
// limit via the client SDK, so this is only a reference line for the free tier.
const FREE_TIER_BYTES = 1024 * 1024 * 1024 // 1 GB

const BUCKET_LABEL: Record<string, { label: string; icon: typeof ImageIcon }> = {
  avatars: { label: 'Profile Avatars', icon: ImageIcon },
  'facility-photos': { label: 'Facility Photos', icon: ImageIcon },
  'schedule-report-attachments': { label: 'Schedule Attachments', icon: FileText },
  'payment-qr-codes': { label: 'Payment QR Codes', icon: QrCode },
  'payment-screenshots': { label: 'Payment Proof Screenshots', icon: Receipt },
  'payment-pictures': { label: 'Payment Pictures', icon: Receipt },
  'payment-proofs': { label: 'Payment Proofs', icon: Receipt },
  'payment-receipts': { label: 'Payment Receipts', icon: Receipt },
}

function formatBucketLabel(bucketName: string): string {
  if (BUCKET_LABEL[bucketName]) return BUCKET_LABEL[bucketName].label
  return bucketName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function StorageUsageCard() {
  const { usage, loading, error, refetch } = useStorageUsage()

  const pctOfFreeTier = usage ? Math.min(100, (usage.totalBytes / FREE_TIER_BYTES) * 100) : 0

  return (
    <Card className="p-6 rounded-2xl border-border/50 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-[#0072bc]" />
          <h3 className="text-sm font-black uppercase tracking-tight">Storage Usage</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {loading && !usage ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : usage ? (
        <>
          <div className="flex items-baseline justify-between">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black">{formatBytes(usage.totalBytes)}</span>
                <span className="text-xs font-bold text-muted-foreground">/ 1 GB</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {usage.totalFiles} file{usage.totalFiles === 1 ? '' : 's'} across Supabase Storage · {usage.buckets.length} tracked buckets
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Free Tier Quota
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0072bc] transition-all"
                style={{ width: `${pctOfFreeTier}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
              <span>{pctOfFreeTier.toFixed(1)}% OF 1 GB STORAGE USED</span>
              <span>MAX 50 MB / UPLOAD</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {usage.buckets.map(b => {
              const meta = BUCKET_LABEL[b.bucket] ?? { label: formatBucketLabel(b.bucket), icon: Receipt }
              const Icon = meta.icon
              return (
                <div key={b.bucket} className="rounded-xl border border-border/40 p-3 flex items-center gap-3">
                  <div className="p-2 bg-muted/50 rounded-lg shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.exists ? `${formatBytes(b.bytes)} · ${b.fileCount} file${b.fileCount === 1 ? '' : 's'}` : 'No uploads yet'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="pt-2 border-t border-border/40 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-muted/30 border border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Storage Cap</p>
              <p className="font-extrabold text-foreground">1 GB</p>
            </div>
            <div className="p-2 rounded-xl bg-muted/30 border border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Max File Size</p>
              <p className="font-extrabold text-foreground">50 MB</p>
            </div>
            <div className="p-2 rounded-xl bg-muted/30 border border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Database Cap</p>
              <p className="font-extrabold text-foreground">500 MB</p>
            </div>
            <div className="p-2 rounded-xl bg-muted/30 border border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Monthly Egress</p>
              <p className="font-extrabold text-foreground">5 GB</p>
            </div>
          </div>
        </>
      ) : null}
    </Card>
  )
}
