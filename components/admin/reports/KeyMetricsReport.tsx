'use client'

import { Users, UserPlus, Activity, Clock, Building } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { KeyMetricsData } from '@/backend/admin/admin.types'

interface KeyMetricsReportProps {
  data: KeyMetricsData | null
}

export const KeyMetricsReport = ({ data }: KeyMetricsReportProps) => {
  if (!data) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No metrics data available
      </div>
    )
  }

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4" />
    if (change < 0) return <TrendingDown className="h-4 w-4" />
    return <Minus className="h-4 w-4" />
  }

  const getTrendColor = (change: number) => {
    if (change > 0) return 'text-green-600 dark:text-green-400'
    if (change < 0) return 'text-red-600 dark:text-red-400'
    return 'text-slate-600 dark:text-slate-400'
  }

  const metricsConfig = [
    {
      label: 'Total Users',
      value: data.totalUsers.current,
      icon: Users,
      description: 'All registered users',
      color: 'bg-sti-yellow-muted',
      borderColor: 'border-t-sti-yellow-muted',
      iconText: 'text-sti-navy dark:text-sti-navy',
      trend: {
        change: data.totalUsers.change,
        text: `${Math.abs(data.totalUsers.change)}% vs last month`,
      },
    },
    {
      label: 'New Users',
      value: data.newUsersThisMonth,
      icon: UserPlus,
      description: 'Registered this month',
      color: 'bg-[#0072bc] dark:bg-[#3b9ede]',
      borderColor: 'border-t-[#0072bc] dark:border-t-[#3b9ede]',
      iconText: 'text-white',
      trend: null,
    },
    {
      label: 'Active Users',
      value: data.activeUsers,
      icon: Activity,
      description: 'Logged in last 30 days',
      color: 'bg-[#0cbc87] dark:bg-[#10d49a]',
      borderColor: 'border-t-[#0cbc87] dark:border-t-[#10d49a]',
      iconText: 'text-white',
      trend: null,
    },
    {
      label: 'Pending Approvals',
      value: data.pendingApprovals,
      icon: Clock,
      description: 'Awaiting approval',
      color: 'bg-[#ff9800] dark:bg-[#fb8c00]',
      borderColor: 'border-t-[#ff9800] dark:border-t-[#fb8c00]',
      iconText: 'text-white',
      trend: null,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricsConfig.map((metric) => (
          <Card
            key={metric.label}
            className={`overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all border-t-2 ${metric.borderColor}`}
          >
            <CardContent className="p-0">
              <div className="flex items-center gap-4 p-4">
                <div className={`p-3.5 rounded-lg ${metric.color} ${metric.iconText} shrink-0`}>
                  <metric.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <p className="text-3xl font-bold tracking-tight">{metric.value}</p>
                  {metric.trend ? (
                    <div className={`flex items-center gap-1 text-xs mt-1 ${getTrendColor(metric.trend.change)}`}>
                      {getTrendIcon(metric.trend.change)}
                      <span className="font-medium">{metric.trend.text}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground truncate">{metric.description}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top Department Card */}
      {data.topDepartment && (
        <Card className="border-t-2 border-t-[#8007e6]">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-lg bg-[#8007e6] dark:bg-[#a855f7] text-white">
                <Building className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Top Department</p>
                <p className="text-2xl font-bold">
                  {data.topDepartment.code} - {data.topDepartment.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {data.topDepartment.userCount} users
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
