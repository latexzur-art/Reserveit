import { NextRequest, NextResponse } from 'next/server'
import { requireUserManager } from '@/lib/auth/guards'
import { AdminUsersService, AdminAuditService, dbUserToView } from '@/backend/admin'
import { statusDisplayToDb, roleDisplayToDb } from '@/backend/admin/admin.types'
import {
  createEntraUser,
  deleteEntraUser,
  EntraConflictError,
  EntraPermissionError,
} from '@/backend/auth/entra-users.service'
import { INTERNAL_DOMAINS } from '@/backend/auth/auth.constants'
import { z } from 'zod'
import { parseBody, parseQuery } from '@/lib/api/validate'
import { apiError } from '@/lib/api/response'
import { getErrorMessage } from '@/lib/errors'

const listQuerySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  role: z.string().optional(),
  type: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
  archived: z.string().optional(),
})

const createSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  userType: z.enum(['internal', 'external']).optional(),
  provisionEntra: z.boolean().optional(),
  employeeId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  roleIds: z.array(z.string()).optional(),
  roleId: z.string().optional(),
  phone: z.string().nullable().optional(),
  notificationEmail: z.string().email().nullable().optional(),
  temporaryPassword: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const { error } = await requireUserManager()
  if (error) return error

  const parsedQuery = parseQuery(request, listQuerySchema)
  if (!parsedQuery.ok) return parsedQuery.response
  const q = parsedQuery.data

  const filters = {
    search: q.search || undefined,
    userType: q.type
      ? (q.type.toLowerCase() as 'internal' | 'external')
      : undefined,
    accountStatus: q.status
      ? (statusDisplayToDb[q.status] || q.status.toLowerCase())
      : undefined,
    roleName: q.role
      ? (roleDisplayToDb[q.role] || q.role.toLowerCase().replace(/ /g, '_'))
      : undefined,
    page: q.page,
    pageSize: q.pageSize,
    archived: q.archived === 'true',
  }

  try {
    const { data, total } = await AdminUsersService.getAllUsers(filters)
    const users = (data || []).map(dbUserToView)
    return NextResponse.json({ users, total })
  } catch (err) {
    console.error('[API] GET /admin/users error:', err)
    return apiError(500, getErrorMessage(err))
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireUserManager()
  if (error) return error

  const parsedBody = await parseBody(request, createSchema)
  if (!parsedBody.ok) return parsedBody.response
  const body = parsedBody.data

  const userType: 'internal' | 'external' =
    body.userType === 'external' ? 'external' : 'internal'
  const provisionEntra =
    userType === 'internal' && body.provisionEntra !== false

  if (provisionEntra && !INTERNAL_DOMAINS.some(domain => body.email.toLowerCase().endsWith(domain))) {
    return NextResponse.json(
      { success: false, error: `Internal users must use an authorized domain (${INTERNAL_DOMAINS.join(', ')}) email.` },
      { status: 400 },
    )
  }

  let entra: { objectId: string; userPrincipalName: string; temporaryPassword: string } | null = null

  if (provisionEntra) {
    try {
      entra = await createEntraUser({
        email: body.email,
        fullName: body.fullName,
      })
    } catch (err: any) {
      if (err instanceof EntraConflictError) {
        return NextResponse.json(
          {
            success: false,
            error: 'A Microsoft Entra account with this email already exists. Uncheck "Create Microsoft Entra account" to register the existing user.',
          },
          { status: 409 },
        )
      }
      if (err instanceof EntraPermissionError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Microsoft Graph denied user creation. Confirm the app registration has User.ReadWrite.All with admin consent granted.',
          },
          { status: 403 },
        )
      }
      console.error('[API] POST /admin/users — Entra create failed:', err)
      return NextResponse.json(
        { success: false, error: `Entra provisioning failed: ${err?.message || 'unknown error'}` },
        { status: 502 },
      )
    }
  }

  try {
    const result = await AdminUsersService.createInternalUser({
      email: body.email,
      fullName: body.fullName,
      employeeId: body.employeeId ?? undefined,
      departmentId: body.departmentId ?? undefined,
      roleIds: body.roleIds || (body.roleId ? [body.roleId] : []),
      phone: body.phone ?? undefined,
      notificationEmail: body.notificationEmail ?? undefined,
      createdBy: user.id,
      entraObjectId: entra?.objectId,
      userType: userType as 'internal' | 'external',
      temporaryPassword: userType === 'external' ? body.temporaryPassword : undefined,
    })

    if (!result.success) {
      // Local insert failed — roll back the Entra account we just created so we
      // don't leave an orphan in the directory.
      if (entra) {
        try {
          await deleteEntraUser(entra.objectId)
        } catch (rollbackErr) {
          console.error(
            `[API] POST /admin/users — Entra rollback failed for objectId=${entra.objectId}. Manual cleanup required in the Entra portal.`,
            rollbackErr,
          )
        }
      }
      return NextResponse.json(result, { status: 400 })
    }

    await AdminAuditService.log({
      actorId: user.id,
      action: 'user.create',
      targetType: 'user',
      targetId: result.userId,
      details: {
        email: body.email,
        fullName: body.fullName,
        entraProvisioned: !!entra,
        entraObjectId: entra?.objectId,
      },
    })

    return NextResponse.json(
      {
        ...result,
        entra: entra
          ? {
              userPrincipalName: entra.userPrincipalName,
              temporaryPassword: entra.temporaryPassword,
            }
          : undefined,
      },
      { status: 201 },
    )
  } catch (err: any) {
    if (entra) {
      try {
        await deleteEntraUser(entra.objectId)
      } catch (rollbackErr) {
        console.error(
          `[API] POST /admin/users — Entra rollback failed for objectId=${entra.objectId}. Manual cleanup required in the Entra portal.`,
          rollbackErr,
        )
      }
    }
    console.error('[API] POST /admin/users error:', err)
    return apiError(500, getErrorMessage(err))
  }
}
