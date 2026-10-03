/**
 * Microsoft Graph clients (singletons, lazy-initialised).
 *
 * Two client-credentials clients:
 *  - getGraphClient()            → login/email tenant (follows AZURE_* / the tenant switcher)
 *  - getProvisioningGraphClient()→ user creation, PINNED to the ReserveIT tenant via
 *                                  ENTRA_PROVISION_* so it never touches STI's directory.
 *
 * Required Graph application permissions (granted via admin consent):
 *   - Mail.Send             → backend/notifications/emailService.ts        (login/email client)
 *   - User.ReadWrite.All    → backend/auth/entra-users.service.ts          (provisioning client)
 */

import { ClientSecretCredential } from '@azure/identity'
import { Client } from '@microsoft/microsoft-graph-client'
import {
  TokenCredentialAuthenticationProvider,
} from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials'

export interface GraphCredentials {
  tenantId: string
  clientId: string
  clientSecret: string
}

function buildGraphClient({ tenantId, clientId, clientSecret }: GraphCredentials): Client {
  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret)
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default'],
  })
  return Client.initWithMiddleware({ authProvider })
}

/* ---- Login / email Graph client (follows the active AZURE_* tenant / switcher) ---- */

let graphClient: Client | null = null

export function getGraphClient(): Client {
  if (graphClient) return graphClient
  graphClient = buildGraphClient({
    tenantId: process.env.AZURE_TENANT_ID!,
    clientId: process.env.AZURE_CLIENT_ID!,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
  })
  return graphClient
}

export function hasGraphCredentials(): boolean {
  return Boolean(
    process.env.AZURE_TENANT_ID &&
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET,
  )
}

/* ---- Provisioning Graph client (PINNED to the ReserveIT tenant) ----
 * User creation must never reach STI's official directory. Provisioning uses its own
 * ENTRA_PROVISION_* credentials, independent of the login tenant / the tenant switcher.
 * Falls back to AZURE_* when the dedicated vars are absent (backwards compatible).
 */

export function resolveProvisioningCredentials(): GraphCredentials {
  return {
    tenantId: process.env.ENTRA_PROVISION_TENANT_ID ?? process.env.AZURE_TENANT_ID ?? '',
    clientId: process.env.ENTRA_PROVISION_CLIENT_ID ?? process.env.AZURE_CLIENT_ID ?? '',
    clientSecret: process.env.ENTRA_PROVISION_CLIENT_SECRET ?? process.env.AZURE_CLIENT_SECRET ?? '',
  }
}

export function hasProvisioningCredentials(): boolean {
  const { tenantId, clientId, clientSecret } = resolveProvisioningCredentials()
  return Boolean(tenantId && clientId && clientSecret)
}

let provisioningClient: Client | null = null

export function getProvisioningGraphClient(): Client {
  if (provisioningClient) return provisioningClient
  provisioningClient = buildGraphClient(resolveProvisioningCredentials())
  return provisioningClient
}
