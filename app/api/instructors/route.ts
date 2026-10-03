import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { sanitizeDbError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

/**
 * GET /api/instructors
 *
 * Returns a lightweight list of active faculty/teaching staff for use in
 * dropdowns (manual schedule entry, etc.). Available to any authenticated
 * internal user — no role gating, since this is read-only directory data
 * already surfaced elsewhere in the app.
 */
export async function GET() {
  const { error: authError } = await requireAuthenticatedUser()
  if (authError) return authError

  const supabase = createAdminClient()

  const { data, error: dbError } = await supabase
    .from('users')
    .select(`
      id,
      full_name,
      employee_id,
      department_id,
      department:departments!users_department_id_fkey(code),
      user_roles!user_roles_user_id_fkey(
        is_active,
        role:roles(name)
      )
    `)
    .eq('is_active', true)
    .order('full_name')

  if (dbError) {
    return NextResponse.json({ error: sanitizeDbError(dbError) }, { status: 500 })
  }

  const FACULTY_ROLES = new Set(['faculty', 'program_head', 'teacher', 'professor'])

  const instructors = (data ?? [])
    .filter((u: any) => {
      const userRoles = Array.isArray(u.user_roles) ? u.user_roles : []
      return userRoles.some((ur: any) =>
        ur?.is_active !== false &&
        ur?.role?.name &&
        FACULTY_ROLES.has(ur.role.name)
      )
    })
    .map((u: any) => {
      const dept = Array.isArray(u.department) ? u.department[0] : u.department
      return {
        id: u.id,
        full_name: u.full_name,
        employee_id: u.employee_id ?? null,
        department_id: u.department_id ?? null,
        department_code: dept?.code ?? null,
      }
    })

  return NextResponse.json({ instructors })
}
