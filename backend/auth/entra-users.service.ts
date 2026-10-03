/**
 * Microsoft Entra ID user provisioning via Microsoft Graph.
 *
 * Server-only. Uses the shared Graph client (client-credentials flow).
 *
 * Required Graph application permission (admin consent):
 *   - User.ReadWrite.All
 */

import { randomBytes } from 'crypto'
import { getProvisioningGraphClient, hasProvisioningCredentials } from '@/backend/integrations/graphClient'

export class EntraConflictError extends Error {
  constructor(message = 'Entra user already exists') {
    super(message)
    this.name = 'EntraConflictError'
  }
}

export class EntraPermissionError extends Error {
  constructor(message = 'Microsoft Graph denied the request — check app permissions') {
    super(message)
    this.name = 'EntraPermissionError'
  }
}

export interface CreateEntraUserInput {
  email: string
  fullName: string
  forceChangePassword?: boolean
  usageLocation?: string
}

export interface CreateEntraUserResult {
  objectId: string
  userPrincipalName: string
  temporaryPassword: string
}

const PASSWORD_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const PASSWORD_LOWER = 'abcdefghijkmnpqrstuvwxyz'
const PASSWORD_DIGIT = '23456789'
const PASSWORD_SYMBOL = '!@#$%^&*-_=+'

function pick(pool: string, byte: number): string {
  return pool[byte % pool.length]
}

/**
 * Generate a 16-character password that satisfies Entra's default complexity
 * requirements (3 of 4 character classes, no username substring).
 */
function generateTempPassword(): string {
  const bytes = randomBytes(16)
  const chars: string[] = [
    pick(PASSWORD_UPPER, bytes[0]),
    pick(PASSWORD_LOWER, bytes[1]),
    pick(PASSWORD_DIGIT, bytes[2]),
    pick(PASSWORD_SYMBOL, bytes[3]),
  ]
  const allPools = PASSWORD_UPPER + PASSWORD_LOWER + PASSWORD_DIGIT + PASSWORD_SYMBOL
  for (let i = 4; i < 16; i++) {
    chars.push(pick(allPools, bytes[i]))
  }
  // Shuffle so the first 4 positions aren't predictable.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

function localPart(email: string): string {
  const at = email.indexOf('@')
  return at > 0 ? email.slice(0, at) : email
}

function mapGraphError(err: any): Error {
  const status = err?.statusCode ?? err?.status
  const code = err?.code ?? err?.body?.error?.code
  if (status === 409 || code === 'ObjectConflict' || code === 'Request_BadRequest') {
    if (typeof err?.body === 'string' && err.body.includes('userPrincipalName already exists')) {
      return new EntraConflictError()
    }
    if (code === 'ObjectConflict') return new EntraConflictError()
  }
  if (status === 403 || code === 'Authorization_RequestDenied') {
    console.error('[Entra] Graph 403 detail:', JSON.stringify(err?.body ?? err?.message ?? err))
    return new EntraPermissionError()
  }
  return err instanceof Error ? err : new Error(String(err))
}

export async function createEntraUser(input: CreateEntraUserInput): Promise<CreateEntraUserResult> {
  if (!hasProvisioningCredentials()) {
    throw new Error('Entra provisioning credentials are not configured (ENTRA_PROVISION_TENANT_ID / ENTRA_PROVISION_CLIENT_ID / ENTRA_PROVISION_CLIENT_SECRET, or AZURE_* fallback).')
  }

  const password = generateTempPassword()
  const userPrincipalName = input.email.toLowerCase()

  const payload = {
    accountEnabled: true,
    displayName: input.fullName,
    mailNickname: localPart(userPrincipalName),
    userPrincipalName,
    usageLocation: input.usageLocation ?? 'PH',
    passwordProfile: {
      forceChangePasswordNextSignIn: input.forceChangePassword ?? true,
      password,
    },
  }

  try {
    const created = await getProvisioningGraphClient().api('/users').post(payload)
    await setEntraUserMail(created.id, userPrincipalName)
    return {
      objectId: created.id,
      userPrincipalName: created.userPrincipalName,
      temporaryPassword: password,
    }
  } catch (err) {
    throw mapGraphError(err)
  }
}

/**
 * Supabase's Azure provider rejects sign-in with "Error getting user email from
 * external provider" when the Entra `mail` attribute is null — common for
 * cloud-only *.onmicrosoft.com users without an Exchange Online license.
 * Best-effort: failures are logged but do not abort provisioning.
 */
export async function setEntraUserMail(objectId: string, email: string): Promise<boolean> {
  if (!hasProvisioningCredentials()) return false
  try {
    await getProvisioningGraphClient().api(`/users/${objectId}`).patch({ mail: email.toLowerCase() })
    return true
  } catch (err) {
    console.error('[Entra] Failed to set mail attribute:', err instanceof Error ? err.message : err)
    return false
  }
}

export async function deleteEntraUser(objectId: string): Promise<void> {
  if (!hasProvisioningCredentials()) {
    throw new Error('Azure Graph credentials are not configured.')
  }
  try {
    await getProvisioningGraphClient().api(`/users/${objectId}`).delete()
  } catch (err) {
    throw mapGraphError(err)
  }
}

export async function setEntraUserEnabled(objectId: string, enabled: boolean): Promise<boolean> {
  if (!hasProvisioningCredentials()) return false
  try {
    await getProvisioningGraphClient().api(`/users/${objectId}`).patch({ accountEnabled: enabled })
    return true
  } catch (err) {
    console.error(
      `[Entra] Failed to ${enabled ? 'enable' : 'disable'} user ${objectId}:`,
      err instanceof Error ? err.message : err,
    )
    return false
  }
}

export interface ResetEntraUserPasswordResult {
  temporaryPassword: string
}

export async function resetEntraUserPassword(objectId: string): Promise<ResetEntraUserPasswordResult> {
  if (!hasProvisioningCredentials()) {
    throw new Error('Azure Graph credentials are not configured.')
  }
  const password = generateTempPassword()
  try {
    await getProvisioningGraphClient().api(`/users/${objectId}`).patch({
      passwordProfile: { forceChangePasswordNextSignIn: true, password },
    })
    return { temporaryPassword: password }
  } catch (err) {
    throw mapGraphError(err)
  }
}
