'use client'

import { useState } from 'react'
import { BarChart3, Users, Activity, Loader2, RefreshCw } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useAdminReports } from '@/hooks/admin/useAdminReports'
import { useAdminNotifications } from '@/hooks/admin/useAdminNotifications'
import { useUI } from '@/contexts/UIContext'

// Components
import { KeyMetricsReport } from '@/components/admin/reports/KeyMetricsReport'
import { UserDistributionReport } from '@/components/admin/reports/UserDistributionReport'
import { ActivityTimelineReport } from '@/components/admin/reports/ActivityTimelineReport'
import { SkeletonList } from "@/components/ui/SkeletonList";


export default function ReportsPage() {
  const { toggleMobileMenu } = useUI()
  const {
    distribution,
    metrics,
    loading,
    exportReport,
    refresh,
  } = useAdminReports()

  const {
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    clearAllNotifications,
  } = useAdminNotifications()

  const [activeTab, setActiveTab] = useState('overview')
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  const handleExportDistribution = () => {
    exportReport('distribution')
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <SkeletonList />
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Main Content */}
      <main className="px-4 lg:px-6 py-6 space-y-6 flex-1">
        {/* Header with Refresh Button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Analytics & Reports</h2>
            <p className="text-muted-foreground">
              View user statistics, distribution, and activity trends
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger
              value="overview"
              className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-b-accent data-[state=active]:rounded-b-none"
            >
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="distribution"
              className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-b-accent data-[state=active]:rounded-b-none"
            >
              <Users className="h-4 w-4" />
              User Distribution
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-b-accent data-[state=active]:rounded-b-none"
            >
              <Activity className="h-4 w-4" />
              Activity Timeline
            </TabsTrigger>
          </TabsList>

          {/* Tab Content */}
          <div className="mt-6">
            {activeTab === 'overview' && <KeyMetricsReport data={metrics} />}
            {activeTab === 'distribution' && (
              <UserDistributionReport data={distribution} onExport={handleExportDistribution} />
            )}
            {activeTab === 'activity' && <ActivityTimelineReport />}
          </div>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="px-4 lg:px-6 py-3 border-t border-border text-xs text-muted-foreground text-right">
        &copy; {new Date().getFullYear()} <span className="text-sti-yellow-muted font-medium">STI</span> Colleges &middot; ReserveIT
      </footer>
    </div>
  )
}
