import { NextResponse } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingSettingsService } from '@/backend/admin/building'
import { apiUnexpectedError } from '@/lib/api/response'

export async function GET() {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const usage = await BuildingSettingsService.getStorageUsage()
    return NextResponse.json(usage)
  } catch (err) {
    return apiUnexpectedError('GET /api/admin/building/settings/storage-usage', err)
  }
}
