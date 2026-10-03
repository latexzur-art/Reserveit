'use client'

import { Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { UserDistributionData } from '@/backend/admin/admin.types'
import { roleColors, statusColors } from '@/backend/admin/admin.types'
import { userRoleLabel, accountStatusLabel, formatEnumLabel } from '@/lib/enum-labels'

interface UserDistributionReportProps {
  data: UserDistributionData | null
  onExport: () => void
}

export const UserDistributionReport = ({ data, onExport }: UserDistributionReportProps) => {
  if (!data) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No distribution data available
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Export Button */}
      <div className="flex justify-end">
        <Button onClick={onExport} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export Distribution Report
        </Button>
      </div>

      {/* By User Type */}
      <Card>
        <CardHeader>
          <CardTitle>Distribution by User Type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.byType.map((item) => (
            <div key={item.type} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{formatEnumLabel(item.type)}</span>
                <span className="text-muted-foreground">
                  {item.count} ({item.percentage}%)
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-4 rounded-full transition-all ${
                    item.type === 'Internal'
                      ? 'bg-[#0072bc] dark:bg-[#3b9ede]'
                      : 'bg-[#8007e6] dark:bg-[#a855f7]'
                  }`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* By Role */}
      <Card>
        <CardHeader>
          <CardTitle>Distribution by Role</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byRole.length > 0 ? (
                data.byRole
                  .sort((a, b) => b.count - a.count)
                  .map((item) => (
                    <TableRow key={item.roleName}>
                      <TableCell>
                        <Badge variant="outline" className={roleColors[item.role] || 'bg-slate-100'}>
                          {userRoleLabel(item.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{item.count}</TableCell>
                    </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    No role data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* By Status */}
      <Card>
        <CardHeader>
          <CardTitle>Distribution by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {data.byStatus.map((item) => (
              <div key={item.status} className="flex-1 min-w-[120px]">
                <Badge variant="outline" className={`${statusColors[item.status]} w-full justify-center`}>
                  {accountStatusLabel(item.status)}
                </Badge>
                <p className="text-center text-2xl font-bold mt-2">{item.count}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* By Department */}
      <Card>
        <CardHeader>
          <CardTitle>Top Departments (by user count)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.byDepartment.length > 0 ? (
            data.byDepartment.map((item, index) => {
              const maxCount = Math.max(...data.byDepartment.map(d => d.count))
              const percentage = (item.count / maxCount) * 100

              return (
                <div key={item.code} className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-muted-foreground">
                        #{index + 1}
                      </span>
                      <span className="font-medium">{item.code}</span>
                      <span className="text-muted-foreground">- {item.name}</span>
                    </div>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-[#0072bc] to-[#0cbc87] transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })
          ) : (
            <p className="text-center text-muted-foreground">No department data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
