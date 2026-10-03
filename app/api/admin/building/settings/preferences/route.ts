import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingSettingsService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

export async function GET(request: NextRequest) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const category = request.nextUrl.searchParams.get('category') as any
    const prefs = await BuildingSettingsService.getPreferences(user.id, category || undefined)
    return NextResponse.json(prefs)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { category, preferences } = await request.json()
    if (!category || !preferences) {
      return NextResponse.json({ error: 'category and preferences are required' }, { status: 400 })
    }
    const result = await BuildingSettingsService.updatePreferences(user.id, category, preferences)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
