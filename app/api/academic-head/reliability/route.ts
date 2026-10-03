import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
const ALLOWED_REVIEWER_ROLES = ['academic_head', 'building_admin', 'admin', 'it_administrator']
const TEACHING_ROLES = ['faculty', 'program_head', 'teacher', 'professor']

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const roles = ((user!.roles ?? []) as Array<{ name: string }>).map((r) => r.name.toLowerCase())
  if (!roles.some((r) => ALLOWED_REVIEWER_ROLES.includes(r))) {
    return NextResponse.json(
      { error: 'Forbidden: academic head or admin role required' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const departmentId = searchParams.get('department_id')
  const search = searchParams.get('search')?.toLowerCase() ?? ''
  const minCount = parseInt(searchParams.get('min_count') ?? '0', 10) || 0

  const supabase = createAdminClient()

  let query = supabase
    .from('users')
    .select(`
      id,
      full_name,
      email,
      employee_id,
      avatar_url,
      department_id,
      consecutive_cancellations,
      account_status,
      department:departments!users_department_id_fkey(id, code, name),
      user_roles!user_roles_user_id_fkey(is_active, role:roles(id, name))
    `)
  if (departmentId) query = query.eq('department_id', departmentId)

  const { data: users, error: dbError } = await query
  if (dbError) {
    console.error('[api/academic-head/reliability] users query failed:', dbError.message)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  const staff = (users ?? [])
    .map((u: any) => {
      const rawUserRoles = Array.isArray(u.user_roles) ? u.user_roles : []
      const userRoleNames: string[] = rawUserRoles
        .filter((ur: any) => ur && ur.is_active !== false && ur.role && typeof ur.role.name === 'string')
        .map((ur: any) => ur.role.name as string)
      const dept = Array.isArray(u.department) ? u.department[0] : u.department
      return {
        id: u.id as string,
        name: (u.full_name as string) ?? '',
        email: (u.email as string) ?? '',
        employeeId: (u.employee_id as string | null) ?? null,
        avatarUrl: (u.avatar_url as string | null) ?? null,
        departmentId: (u.department_id as string | null) ?? null,
        departmentName: dept?.name ?? 'Unknown',
        departmentCode: dept?.code ?? 'N/A',
        roles: userRoleNames,
        isProgramHead: userRoleNames.some((r) => r.toLowerCase().includes('program')),
        count: (u.consecutive_cancellations as number | null) ?? 0,
        accountStatus: (u.account_status as string | null) ?? 'active',
      }
    })
    .filter((s) => s.roles.map((r) => r.toLowerCase()).some((r) => TEACHING_ROLES.includes(r)))
    .filter((s) => (minCount > 0 ? s.count >= minCount : true))
    .filter((s) => {
      if (!search) return true
      return (
        s.name.toLowerCase().includes(search) ||
        s.email.toLowerCase().includes(search) ||
        s.departmentName.toLowerCase().includes(search) ||
        s.departmentCode.toLowerCase().includes(search)
      )
    })
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      if (a.isProgramHead && !b.isProgramHead) return -1
      if (!a.isProgramHead && b.isProgramHead) return 1
      return a.name.localeCompare(b.name)
    })

  const { data: pendingRows } = await supabase
    .from('score_reset_requests')
    .select(`
      id,
      user_id,
      count_at_request,
      reset_type,
      reason,
      created_at,
      user:users!score_reset_requests_user_id_fkey(id, full_name, email, department:departments!users_department_id_fkey(code, name), user_roles!user_roles_user_id_fkey(is_active, role:roles(name)))
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  const pendingRequests = (pendingRows ?? []).map((row: any) => {
    const u = Array.isArray(row.user) ? row.user[0] : row.user
    const dept = u ? (Array.isArray(u.department) ? u.department[0] : u.department) : null
    const userRoles = u
      ? (Array.isArray(u.user_roles) ? u.user_roles : [])
          .filter((ur: any) => ur && ur.is_active !== false && ur.role)
          .map((ur: any) => ur.role.name as string)
      : []
    return {
      id: row.id as string,
      userId: row.user_id as string,
      userName: (u?.full_name as string) ?? '',
      userEmail: (u?.email as string) ?? '',
      departmentCode: dept?.code ?? 'N/A',
      departmentName: dept?.name ?? 'Unknown',
      roles: userRoles,
      countAtRequest: (row.count_at_request as number | null) ?? 0,
      resetType: ((row.reset_type as string | null) ?? 'consecutive') as 'consecutive' | 'cancellation_rate',
      reason: (row.reason as string) ?? '',
      createdAt: row.created_at as string,
    }
  })

  return NextResponse.json({ staff, pendingRequests })
}
