import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { getErrorMessage } from '@/lib/errors'
import { deliveryModesMatching } from '@/backend/course/course.service'
import type { DeliveryMode } from '@/types/course.types'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { user, error: authErr } = await getAuthUserWithRoles()
  if (!user) return NextResponse.json({ error: authErr ?? 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const roles = (user.roles ?? []).map((r: any) => r.name)

  try {
    const supabase = createAdminClient()
    
    // Build filters (similar to main API but without pagination)
    let query = supabase
      .from('courses')
      .select('*')

    const yearLevel = searchParams.get('year_level') ? parseInt(searchParams.get('year_level')!) : undefined
    const term = searchParams.get('term') ? parseInt(searchParams.get('term')!) : undefined
    const deliveryMode = searchParams.get('delivery_mode') || undefined
    const approvalStatus = searchParams.get('approval_status') || undefined
    const search = searchParams.get('search') || undefined
    const batchUploadId = searchParams.get('batch_upload_id') || undefined
    
    let deptCode = searchParams.get('department_code') || undefined
    if (roles.includes('program_head') && !roles.includes('academic_head')) {
      deptCode = user.department?.code
    }

    if (deptCode) query = query.eq('department_code', deptCode)
    if (yearLevel) query = query.eq('year_level', yearLevel)
    if (term) query = query.eq('term', term)
    if (deliveryMode) query = query.in('delivery_mode', deliveryModesMatching(deliveryMode as DeliveryMode))
    if (approvalStatus) query = query.eq('approval_status', approvalStatus)
    if (search) {
      query = query.or(`course_code.ilike.%${search}%,course_name.ilike.%${search}%`)
    }
    if (batchUploadId) query = query.eq('batch_upload_id', batchUploadId)

    const { data: courses, error } = await query
      .order('department_code')
      .order('year_level')
      .order('term')
      .order('course_code')

    if (error) throw new Error(`Failed to fetch courses for export: ${error.message}`)

    // Generate Excel
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Course Catalog')

    worksheet.columns = [
      { header: 'Dept Code', key: 'department_code', width: 12 },
      { header: 'Course Code', key: 'course_code', width: 15 },
      { header: 'Course Name', key: 'course_name', width: 35 },
      { header: 'Units', key: 'units', width: 8 },
      { header: 'Year Level', key: 'year_level', width: 12 },
      { header: 'Term', key: 'term', width: 15 },
      { header: 'Delivery Mode', key: 'delivery_mode', width: 15 },
      { header: 'Active', key: 'is_active', width: 10 },
      { header: 'Status', key: 'approval_status', width: 15 },
    ]

    courses?.forEach(course => {
      worksheet.addRow({
        ...course,
        is_active: course.is_active ? 'Yes' : 'No',
        term: course.term === 1 ? '1st Semester' : course.term === 2 ? '2nd Semester' : 'Summer/Midyear'
      })
    })

    // Styling
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' } // STI Navy/Blue
    }
    worksheet.getRow(1).alignment = { horizontal: 'center' }

    // Add some borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      })
    })

    const buffer = await workbook.xlsx.writeBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Course_Catalog_Export_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    })

  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
