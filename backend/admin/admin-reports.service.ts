/**
 * Admin Reports Service
 *
 * Provides aggregated data for admin reports with accurate SQL queries
 */

import { createAdminClient } from '@/lib/supabase/server'
import type { UserDistributionData, KeyMetricsData } from './admin.types'

export const AdminReportsService = {
  /**
   * Get user distribution breakdown by type, role, status, and department
   */
  async getUserDistribution(): Promise<UserDistributionData> {
    const supabase = createAdminClient()

    // Get total active users count for percentage calculations
    const { count: totalUsers } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)

    const total = totalUsers || 0

    // 1. By User Type
    const { data: typeData } = await supabase
      .from('users')
      .select('user_type')
      .eq('is_active', true)

    const typeCounts = typeData?.reduce((acc, row) => {
      const type = row.user_type === 'internal' ? 'Internal' : 'External'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const byType = Object.entries(typeCounts).map(([type, count]) => ({
      type,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))

    // 2. By Role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select(`
        role:roles(id, name, display_name, badge_color)
      `)
      .eq('is_active', true)

    const roleCounts = roleData?.reduce((acc, row: any) => {
      if (row.role) {
        const key = row.role.display_name
        if (!acc[key]) {
          acc[key] = {
            role: row.role.display_name,
            roleName: row.role.name,
            badgeColor: row.role.badge_color || 'gray',
            count: 0,
          }
        }
        acc[key].count++
      }
      return acc
    }, {} as Record<string, any>) || {}

    const byRole = Object.values(roleCounts)

    // 3. By Status
    const { data: statusData } = await supabase
      .from('users')
      .select('account_status')
      .eq('is_active', true)

    const statusCounts = statusData?.reduce((acc, row) => {
      const status = row.account_status.charAt(0).toUpperCase() + row.account_status.slice(1)
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const byStatus = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
    }))

    // 4. By Department (top 10)
    const { data: deptData } = await supabase
      .from('users')
      .select(`
        department:departments(code, name)
      `)
      .eq('is_active', true)
      .not('department_id', 'is', null)

    const deptCounts = deptData?.reduce((acc, row: any) => {
      if (row.department) {
        const key = row.department.code
        if (!acc[key]) {
          acc[key] = {
            code: row.department.code,
            name: row.department.name,
            count: 0,
          }
        }
        acc[key].count++
      }
      return acc
    }, {} as Record<string, any>) || {}

    const byDepartment = Object.values(deptCounts)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10)

    return {
      byType,
      byRole,
      byStatus,
      byDepartment,
    }
  },

  /**
   * Get key metrics with historical comparison for trends
   */
  async getKeyMetrics(): Promise<KeyMetricsData> {
    const supabase = createAdminClient()
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Total users (current)
    const { count: currentTotal } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)

    // Total users as of end of previous month
    const { count: previousTotal } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .lte('created_at', previousMonthEnd.toISOString())

    const current = currentTotal || 0
    const previous = previousTotal || 0
    const change = previous > 0 ? ((current - previous) / previous) * 100 : 0

    // New users this month
    const { count: newUsers } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', currentMonthStart.toISOString())

    // Active users (logged in within last 30 days)
    const { count: activeUsers } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .gte('last_login', thirtyDaysAgo.toISOString())

    // Pending approvals (users with pending status)
    const { count: pendingApprovals } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('account_status', 'pending')

    // Top department by user count
    const { data: deptData } = await supabase
      .from('users')
      .select(`
        department:departments(code, name)
      `)
      .eq('is_active', true)
      .not('department_id', 'is', null)

    const deptCounts = deptData?.reduce((acc, row: any) => {
      if (row.department) {
        const key = row.department.code
        if (!acc[key]) {
          acc[key] = {
            code: row.department.code,
            name: row.department.name,
            userCount: 0,
          }
        }
        acc[key].userCount++
      }
      return acc
    }, {} as Record<string, any>) || {}

    const topDepartment = Object.values(deptCounts).sort(
      (a: any, b: any) => b.userCount - a.userCount
    )[0] as { code: string; name: string; userCount: number } | undefined

    return {
      totalUsers: {
        current,
        previousMonth: previous,
        change: Math.round(change * 10) / 10, // Round to 1 decimal
      },
      newUsersThisMonth: newUsers || 0,
      activeUsers: activeUsers || 0,
      pendingApprovals: pendingApprovals || 0,
      topDepartment: topDepartment || null,
    }
  },

  /**
   * Export report data as CSV
   */
  async exportReportData(reportType: 'distribution' | 'metrics'): Promise<string> {
    if (reportType === 'distribution') {
      const data = await this.getUserDistribution()

      let csv = 'Report Type,Category,Value,Count,Percentage\n'

      // By Type
      data.byType.forEach(item => {
        csv += `User Type,${item.type},,${item.count},${item.percentage}%\n`
      })

      csv += '\n'

      // By Role
      data.byRole.forEach(item => {
        csv += `User Role,${item.role},,${item.count},\n`
      })

      csv += '\n'

      // By Status
      data.byStatus.forEach(item => {
        csv += `Status,${item.status},,${item.count},\n`
      })

      csv += '\n'

      // By Department
      data.byDepartment.forEach(item => {
        csv += `Department,${item.code},${item.name},${item.count},\n`
      })

      return csv
    } else {
      const data = await this.getKeyMetrics()

      let csv = 'Metric,Current,Previous Month,Change (%)\n'
      csv += `Total Users,${data.totalUsers.current},${data.totalUsers.previousMonth},${data.totalUsers.change}%\n`
      csv += `New Users This Month,${data.newUsersThisMonth},,\n`
      csv += `Active Users (30d),${data.activeUsers},,\n`
      csv += `Pending Approvals,${data.pendingApprovals},,\n`

      if (data.topDepartment) {
        csv += `\nTop Department,${data.topDepartment.code},${data.topDepartment.name},${data.topDepartment.userCount} users\n`
      }

      return csv
    }
  },
}
