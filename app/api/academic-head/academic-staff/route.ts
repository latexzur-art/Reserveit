import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
export async function GET(request: NextRequest) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const hasRole = user.roles?.some((r: { name: string }) => 
    ['academic_head', 'building_admin', 'admin', 'it_administrator'].includes(r.name.toLowerCase())
  )
  if (!hasRole) {
    console.warn(`[API] User ${user.id} denied access. Roles:`, user.roles?.map((r: any) => r.name))
    return NextResponse.json({ error: 'Forbidden: academic_head or admin role required' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const departmentId = searchParams.get('department_id')
  const search = searchParams.get('search')?.toLowerCase()

  const supabase = createAdminClient()

  try {
    // 1. Fetch users with roles joined directly
    // This is the most reliable way to get users and their roles in one go
    let query = supabase
      .from('users')
      .select(`
        *,
        department:departments!users_department_id_fkey(id, code, name),
        user_roles!user_roles_user_id_fkey(
          is_active,
          role:roles(id, name)
        )
      `)

    if (departmentId) {
      query = query.eq('department_id', departmentId)
    }

    const { data: users, error: dbError } = await query
    if (dbError) throw dbError

    // 2. Process and filter data
    const staff = (users ?? [])
      .map(u => {
        const rawUserRoles = Array.isArray(u.user_roles) ? u.user_roles : []
        
        // Extract role names safely
        const roles: string[] = rawUserRoles
          .filter((ur: any) => ur && ur.is_active !== false && ur.role && typeof ur.role.name === 'string')
          .map((ur: any) => ur.role.name as string)

        const dept = Array.isArray(u.department) ? u.department[0] : u.department

        return {
          id: u.id,
          name: u.full_name,
          email: u.email,
          employeeId: u.employee_id,
          avatarUrl: u.avatar_url,
          departmentId: u.department_id,
          departmentName: dept?.name ?? 'Unknown',
          departmentCode: dept?.code ?? 'N/A',
          roles,
          isProgramHead: roles.some(r => r.toLowerCase().includes('program')),
          isActive: u.is_active
        }
      })
      .filter(s => {
        const roleName = s.roles.map(r => r.toLowerCase())
        return roleName.some(r => ['faculty', 'program_head', 'teacher', 'professor'].includes(r))
      })

    // 3. Client-side search
    let filteredStaff = staff
    if (search) {
      filteredStaff = staff.filter(s => 
        s.name.toLowerCase().includes(search) || 
        s.email.toLowerCase().includes(search) ||
        s.departmentName.toLowerCase().includes(search) ||
        s.departmentCode.toLowerCase().includes(search)
      )
    }

    // 4. Sort: Program Heads first, then by name
    filteredStaff.sort((a, b) => {
      if (a.isProgramHead && !b.isProgramHead) return -1
      if (!a.isProgramHead && b.isProgramHead) return 1
      return a.name.localeCompare(b.name)
    })

    console.log(`[API] Returning ${filteredStaff.length} staff out of ${users?.length ?? 0} total users`)

    return NextResponse.json({ staff: filteredStaff })
  } catch (err: any) {
    console.error('[API] GET /academic-head/academic-staff error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
