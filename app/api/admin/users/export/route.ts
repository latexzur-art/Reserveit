import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUserManager } from '@/lib/auth/guards'
import { AdminUsersService, dbUserToView } from '@/backend/admin'
import { parseQuery } from '@/lib/api/validate'
import { apiError } from '@/lib/api/response'
import { getErrorMessage } from '@/lib/errors'

const querySchema = z.object({
  search: z.string().optional(),
  type: z.enum(['internal', 'external']).optional(),
  status: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const { error } = await requireUserManager()
  if (error) return error

  const parsed = parseQuery(request, querySchema)
  if (!parsed.ok) return parsed.response

  const filters = {
    search: parsed.data.search || undefined,
    userType: parsed.data.type,
    accountStatus: parsed.data.status || undefined,
    page: 1,
    pageSize: 10000,
  }

  try {
    const { data } = await AdminUsersService.getAllUsers(filters)
    const users = (data || []).map(dbUserToView)

    const headers = ['ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Type', 'Role', 'Department', 'Status', 'Bookings']
    const rows = users.map((u) => [
      u.id,
      u.firstName,
      u.lastName,
      u.email,
      u.phone || '',
      u.type,
      u.role,
      u.department,
      u.status,
      u.bookingsCount.toString(),
    ])

    const csv = [headers.join(','), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="users-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (err) {
    console.error('[API] GET /admin/users/export error:', err)
    return apiError(500, getErrorMessage(err))
  }
}
