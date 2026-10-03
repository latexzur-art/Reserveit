import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  resolveProvisioningCredentials,
  hasProvisioningCredentials,
} from '@/backend/integrations/graphClient'

const KEYS = [
  'AZURE_TENANT_ID',
  'AZURE_CLIENT_ID',
  'AZURE_CLIENT_SECRET',
  'ENTRA_PROVISION_TENANT_ID',
  'ENTRA_PROVISION_CLIENT_ID',
  'ENTRA_PROVISION_CLIENT_SECRET',
] as const

const saved: Record<string, string | undefined> = {}

describe('Entra provisioning credentials (pinned to the ReserveIT tenant)', () => {
  beforeEach(() => {
    for (const k of KEYS) saved[k] = process.env[k]
  })
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it('uses ENTRA_PROVISION_* so creation targets the ReserveIT tenant even when login is on the STI tenant', () => {
    // Login/switcher points at STI...
    process.env.AZURE_TENANT_ID = 'sti-tenant'
    process.env.AZURE_CLIENT_ID = 'sti-client'
    process.env.AZURE_CLIENT_SECRET = 'sti-secret'
    // ...but provisioning is pinned to ReserveIT.
    process.env.ENTRA_PROVISION_TENANT_ID = 'reserveit-tenant'
    process.env.ENTRA_PROVISION_CLIENT_ID = 'reserveit-client'
    process.env.ENTRA_PROVISION_CLIENT_SECRET = 'reserveit-secret'

    expect(resolveProvisioningCredentials()).toEqual({
      tenantId: 'reserveit-tenant',
      clientId: 'reserveit-client',
      clientSecret: 'reserveit-secret',
    })
  })

  it('falls back to AZURE_* when ENTRA_PROVISION_* is not configured', () => {
    delete process.env.ENTRA_PROVISION_TENANT_ID
    delete process.env.ENTRA_PROVISION_CLIENT_ID
    delete process.env.ENTRA_PROVISION_CLIENT_SECRET
    process.env.AZURE_TENANT_ID = 'fallback-tenant'
    process.env.AZURE_CLIENT_ID = 'fallback-client'
    process.env.AZURE_CLIENT_SECRET = 'fallback-secret'

    expect(resolveProvisioningCredentials()).toEqual({
      tenantId: 'fallback-tenant',
      clientId: 'fallback-client',
      clientSecret: 'fallback-secret',
    })
  })

  it('hasProvisioningCredentials is false when neither ENTRA_PROVISION_* nor AZURE_* are complete', () => {
    for (const k of KEYS) delete process.env[k]
    expect(hasProvisioningCredentials()).toBe(false)
  })
})
