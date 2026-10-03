'use client'

import { AuditLogsPanel } from '@/components/admin/users/AuditLogsPanel'

export const ActivityTimelineReport = () => {
  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        View recent admin activity and user management actions
      </div>
      <AuditLogsPanel />
    </div>
  )
}
