import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
// All possible specific-activity categories for specialized facilities.
// The form shows this dropdown only when the selected facility is specialized.
export const ALL_PURPOSE_CATEGORIES = [
  // Computer-use categories
  { value: 'internet_research', label: 'Internet Research', facilityTypes: ['computer_use'] },
  { value: 'data_encoding', label: 'Data Encoding / Data Entry', facilityTypes: ['computer_use'] },
  { value: 'presentation', label: 'Presentation / Demo', facilityTypes: ['computer_use', 'av_studio'] },
  { value: 'documentation', label: 'Documentation', facilityTypes: ['computer_use'] },
  { value: 'online_booking_simulation', label: 'Online Booking Simulation', facilityTypes: ['computer_use'] },
  { value: 'e_tourism_tools', label: 'E-Tourism Tools', facilityTypes: ['computer_use'] },
  { value: 'food_costing', label: 'Food Costing / Inventory', facilityTypes: ['computer_use'] },
  { value: 'inventory_management', label: 'Inventory Management', facilityTypes: ['computer_use'] },
  { value: 'spreadsheet_work', label: 'Spreadsheet Work', facilityTypes: ['computer_use'] },
  { value: 'business_simulation', label: 'Business Simulation', facilityTypes: ['computer_use'] },
  { value: 'programming_class', label: 'Programming / Coding Class', facilityTypes: ['computer_use'] },
  { value: 'networking_lab', label: 'Networking Lab Exercise', facilityTypes: ['computer_use'] },
  { value: 'graphic_design', label: 'Graphic Design', facilityTypes: ['computer_use', 'av_studio'] },
  { value: 'multimedia_production', label: 'Multimedia Production', facilityTypes: ['computer_use', 'av_studio'] },
  { value: 'video_editing', label: 'Video Editing', facilityTypes: ['computer_use', 'av_studio'] },
  { value: 'photography_editing', label: 'Photography / Photo Editing', facilityTypes: ['computer_use', 'av_studio'] },
  // AV studio categories
  { value: 'photo_shoot', label: 'Photo Shoot', facilityTypes: ['av_studio'] },
  { value: 'video_production', label: 'Video Production / Broadcasting', facilityTypes: ['av_studio'] },
  { value: 'recording', label: 'Audio / Video Recording', facilityTypes: ['av_studio'] },
  // Other
  { value: 'other', label: 'Other (requires justification)', facilityTypes: ['computer_use', 'science_lab', 'av_studio', 'gym'] },
] as const

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const facilityId = searchParams.get('facilityId')

  if (!facilityId) {
    return NextResponse.json({ error: 'facilityId is required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    // Get facility's purpose tags
    const { data: tags } = await supabase
      .from('facility_purpose_tags')
      .select('tag')
      .eq('facility_id', facilityId)

    const facilityTags = tags?.map((t: { tag: string }) => t.tag) ?? []
    const specializedTag = facilityTags.find((t: string) =>
      ['computer_use', 'science_lab', 'av_studio', 'gym'].includes(t)
    )

    // Not a specialized facility
    if (!specializedTag) {
      return NextResponse.json({ categories: [], isSpecialized: false, isPrimary: false })
    }

    // Check if user is the primary department for this facility
    const { data: facility } = await supabase
      .from('facilities')
      .select('primary_department_id')
      .eq('id', facilityId)
      .single()

    const userDeptId = user.department?.id ?? null
    const isPrimary = !!userDeptId && facility?.primary_department_id === userDeptId

    // Filter categories to only those relevant to this facility type
    const relevantCategories = ALL_PURPOSE_CATEGORIES.filter(c =>
      c.facilityTypes.includes(specializedTag as never)
    )

    if (isPrimary) {
      // Primary department — all categories are whitelisted automatically
      return NextResponse.json({
        categories: relevantCategories.map(c => ({
          value: c.value,
          label: c.label,
          isWhitelisted: true,
          requiresJustification: false,
        })),
        isSpecialized: true,
        isPrimary: true,
      })
    }

    // Check whitelist exception for this dept + facility type
    const { data: exception } = await supabase
      .from('department_facility_exceptions')
      .select('allowed_purpose_categories, auto_approve_eligible')
      .eq('department_id', userDeptId ?? '')
      .eq('facility_type', specializedTag)
      .single()

    const whitelistedValues: string[] = (exception?.allowed_purpose_categories ?? []) as string[]

    return NextResponse.json({
      categories: relevantCategories.map(c => {
        const isWhitelisted = whitelistedValues.includes(c.value) && (exception?.auto_approve_eligible ?? false)
        return {
          value: c.value,
          label: c.label,
          isWhitelisted,
          requiresJustification: !isWhitelisted,
        }
      }),
      isSpecialized: true,
      isPrimary: false,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] GET /facility-purpose-categories error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
