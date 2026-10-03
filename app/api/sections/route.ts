import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { user, error: authErr } = await getAuthUserWithRoles()
  if (!user) return NextResponse.json({ error: authErr ?? 'Unauthorized' }, { status: 401 })

  const roles = (user.roles ?? []).map((r: any) => r.name)
  if (!roles.includes('program_head') && !roles.includes('academic_head')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const supabase = createAdminClient()
    
    // Build query
    let query = supabase
      .from('class_schedules')
      .select('section, departments!inner(name, code)')
      .eq('is_active', true)
      .is('superseded_by', null)
      
    // Filter by department if program_head (and not academic_head)
    if (roles.includes('program_head') && !roles.includes('academic_head')) {
      if (user.department?.id) {
        query = query.eq('department_id', user.department.id)
      } else {
        return NextResponse.json({ sections: [] }) // No department assigned
      }
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error fetching sections:', error)
      return NextResponse.json({ error: 'Failed to fetch sections' }, { status: 500 })
    }
    
    // Deduplicate sections
    const uniqueSectionsMap = new Map<string, any>()
    data?.forEach((row: any) => {
      if (!uniqueSectionsMap.has(row.section)) {
        uniqueSectionsMap.set(row.section, {
          section: row.section,
          department_name: row.departments?.name,
          department_code: row.departments?.code
        })
      }
    })
    
    const sections = Array.from(uniqueSectionsMap.values()).sort((a, b) => a.section.localeCompare(b.section))
    
    return NextResponse.json({ sections })
  } catch (err) {
    console.error('Sections API error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
