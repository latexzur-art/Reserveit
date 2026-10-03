import { NextRequest, NextResponse } from 'next/server'
import { requireUserManager } from '@/lib/auth/guards'
import fs from 'fs'
import path from 'path'

const STI_CONFIG = {
  clientId: process.env.AZURE_STI_CLIENT_ID || '',
  clientSecret: process.env.AZURE_STI_CLIENT_SECRET || '',
  tenantId: process.env.AZURE_STI_TENANT_ID || '',
  name: 'STI',
}

const TEST_CONFIG = {
  clientId: process.env.AZURE_TEST_CLIENT_ID || '',
  clientSecret: process.env.AZURE_TEST_CLIENT_SECRET || '',
  tenantId: process.env.AZURE_TEST_TENANT_ID || '',
  name: 'Test',
}

function getActiveTenantInfo() {
  const currentTenantId = process.env.AZURE_TENANT_ID || ''
  if (currentTenantId === STI_CONFIG.tenantId) {
    return { mode: 'sti' as const, ...STI_CONFIG }
  } else if (currentTenantId === TEST_CONFIG.tenantId) {
    return { mode: 'test' as const, ...TEST_CONFIG }
  }
  return {
    mode: 'unknown' as const,
    name: 'Custom / Unknown Tenant',
    tenantId: currentTenantId,
    clientId: process.env.AZURE_CLIENT_ID || '',
    clientSecret: '',
  }
}

export async function GET() {
  const { error } = await requireUserManager()
  if (error) return error

  const tenant = getActiveTenantInfo()
  return NextResponse.json({
    mode: tenant.mode,
    name: tenant.name,
    tenantId: tenant.tenantId,
    clientId: tenant.clientId,
  })
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireUserManager()
  if (error) return error

  try {
    const body = await request.json()
    const targetMode = body.mode === 'test' ? 'test' : 'sti'
    const targetConfig = targetMode === 'sti' ? STI_CONFIG : TEST_CONFIG
    if (!targetConfig.clientId || !targetConfig.clientSecret || !targetConfig.tenantId) {
      return NextResponse.json({ success: false, error: `Azure ${targetMode} tenant profile is not configured` }, { status: 503 })
    }

    // Update .env.local on disk
    const envPath = path.join(process.cwd(), '.env.local')
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8')
      content = content.replace(/^AZURE_CLIENT_ID=.*/m, `AZURE_CLIENT_ID=${targetConfig.clientId}`)
      content = content.replace(/^AZURE_CLIENT_SECRET=.*/m, `AZURE_CLIENT_SECRET=${targetConfig.clientSecret}`)
      content = content.replace(/^AZURE_TENANT_ID=.*/m, `AZURE_TENANT_ID=${targetConfig.tenantId}`)
      fs.writeFileSync(envPath, content, 'utf8')
    }

    // Update in-memory process environment variables
    process.env.AZURE_CLIENT_ID = targetConfig.clientId
    process.env.AZURE_CLIENT_SECRET = targetConfig.clientSecret
    process.env.AZURE_TENANT_ID = targetConfig.tenantId

    return NextResponse.json({
      success: true,
      mode: targetMode,
      name: targetConfig.name,
      tenantId: targetConfig.tenantId,
      clientId: targetConfig.clientId,
    })
  } catch (err: any) {
    console.error('[API] Tenant Switch Error:', err)
    return NextResponse.json({ success: false, error: err?.message || 'Failed to switch tenant' }, { status: 500 })
  }
}
