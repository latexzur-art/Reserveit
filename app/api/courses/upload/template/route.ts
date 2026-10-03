import { NextRequest, NextResponse } from 'next/server'
import { generateExcelTemplate } from '@/backend/course/courseUpload.service'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { apiError } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthUserWithRoles()
  if (!user) return apiError(401, authError ?? 'Unauthorized')
  const roleNames = user.roles?.map((r: { name: string }) => r.name) ?? []
  if (!roleNames.some((r: string) => ['program_head', 'academic_head'].includes(r))) {
    return apiError(403, 'Forbidden: program_head or academic_head role required')
  }

  const { searchParams } = request.nextUrl
  const mixed     = searchParams.get('mixed') === 'true'
  const deptCode  = searchParams.get('department_code') ?? undefined
  const deptName  = searchParams.get('department_name') ?? undefined
  const allCodes  = mixed
    ? (searchParams.get('all_dept_codes') ?? '').split(',').map(s => s.trim()).filter(Boolean)
    : undefined

  const buffer = await generateExcelTemplate(deptCode, deptName, allCodes)

  const filename = mixed ? 'course_template_mixed.xlsx'
    : deptCode   ? `course_template_${deptCode}.xlsx`
    : 'course_template.xlsx'

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
