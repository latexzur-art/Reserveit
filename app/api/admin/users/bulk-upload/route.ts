import { NextRequest, NextResponse } from 'next/server'
import { requireUserManager } from '@/lib/auth/guards'
import { AdminUsersService, AdminAuditService } from '@/backend/admin'
import {
  createEntraUser,
  deleteEntraUser,
} from '@/backend/auth/entra-users.service'
import { createAdminClient } from '@/lib/supabase/server'

import { INTERNAL_DOMAINS } from '@/backend/auth/auth.constants'
import { z } from 'zod'
import { parseBody } from '@/lib/api/validate'

// Row-level problems are reported per-row in the results array (not as 400s),
// so the envelope schema stays loose on purpose.
const envelopeSchema = z.object({
  rows: z
    .array(z.record(z.string(), z.unknown()))
    .min(1, 'rows[] is required and must not be empty')
    .max(100, 'Maximum 100 users per upload'),
})

interface BulkRow {
  first_name: string
  last_name: string
  email: string
  phone?: string
  user_type: string
  role: string
  department: string // "CODE - Name" format from Excel dropdown
  provision_entra?: boolean
}

interface RowResult {
  row: number
  success: boolean
  email: string
  fullName: string
  temporaryPassword?: string
  error?: string
  department?: string
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireUserManager()
  if (error) return error

  const parsed = await parseBody(request, envelopeSchema)
  if (!parsed.ok) return parsed.response
  const rows = parsed.data.rows as unknown as BulkRow[]

  // Pre-fetch roles and departments for lookup
  const supabase = createAdminClient()
  const [rolesRes, deptsRes] = await Promise.all([
    supabase.from('roles').select('id, name').eq('is_active', true),
    supabase.from('departments').select('id, code, name').eq('is_active', true),
  ])

  const roleMap = new Map<string, string>() // name -> id
  for (const r of rolesRes.data || []) {
    roleMap.set(r.name.toLowerCase(), r.id)
  }

  // Match department by code (extracted from "CODE - Name" dropdown format)
  const deptMap = new Map<string, string>() // code -> id
  for (const d of deptsRes.data || []) {
    deptMap.set(d.code.toLowerCase(), d.id)
  }

  const results: RowResult[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 1

    const fullName = `${row.first_name?.trim() || ''} ${row.last_name?.trim() || ''}`.trim()

    // --- Validation ---
    if (!row.first_name?.trim()) {
      results.push({ row: rowNum, success: false, email: row.email || '', fullName, error: 'Missing first name' })
      continue
    }
    if (!row.last_name?.trim()) {
      results.push({ row: rowNum, success: false, email: row.email || '', fullName, error: 'Missing last name' })
      continue
    }
    if (!row.email?.trim()) {
      results.push({ row: rowNum, success: false, email: '', fullName, error: 'Missing email' })
      continue
    }

    const email = row.email.trim().toLowerCase()
    const userType = (row.user_type || '').toLowerCase()

    if (userType !== 'internal' && userType !== 'external') {
      results.push({ row: rowNum, success: false, email, fullName, error: 'user_type must be "internal" or "external"' })
      continue
    }

    if (userType === 'internal' && !INTERNAL_DOMAINS.some(domain => email.endsWith(domain))) {
      results.push({ row: rowNum, success: false, email, fullName, error: `Internal users must have an authorized domain (${INTERNAL_DOMAINS.join(', ')}) email` })
      continue
    }

    const roleName = (row.role || '').toLowerCase().replace(/ /g, '_')
    const roleId = roleMap.get(roleName)
    if (!roleId) {
      results.push({ row: rowNum, success: false, email, fullName, error: `Unknown role: "${row.role}"` })
      continue
    }

    // Parse department code from "CODE - Name" format
    let departmentId: string | undefined
    if (row.department?.trim()) {
      const deptCode = row.department.split(' - ')[0].trim().toLowerCase()
      departmentId = deptMap.get(deptCode)
    }

    // --- Entra provisioning for internal users ---
    let entra: { objectId: string; userPrincipalName: string; temporaryPassword: string } | null = null

    if (userType === 'internal' && row.provision_entra) {
      try {
        entra = await createEntraUser({
          email,
          fullName,
        })
      } catch (err: any) {
        const msg = err?.message || 'Entra provisioning failed'
        results.push({ row: rowNum, success: false, email, fullName, error: msg })
        continue
      }
    }

    // --- Create DB user ---
    try {
      const result = await AdminUsersService.createInternalUser({
        email,
        fullName,
        departmentId,
        roleIds: [roleId],
        phone: row.phone?.trim() || undefined,
        createdBy: user.id,
        entraObjectId: entra?.objectId,
        userType: userType as 'internal' | 'external',
      })

      if (!result.success) {
        if (entra) {
          try { await deleteEntraUser(entra.objectId) } catch { /* logged internally */ }
        }
        results.push({ row: rowNum, success: false, email, fullName, error: result.error || 'Failed to create user' })
        continue
      }

      await AdminAuditService.log({
        actorId: user.id,
        action: 'user.create',
        targetType: 'user',
        targetId: result.userId,
        details: {
          email,
          fullName,
          source: 'bulk_upload',
          entraProvisioned: !!entra,
        },
      })

      results.push({
        row: rowNum,
        success: true,
        email,
        fullName,
        temporaryPassword: entra?.temporaryPassword,
        department: row.department?.trim() ? row.department.split(' - ')[0].trim() : undefined,
      })
    } catch (err: any) {
      if (entra) {
        try { await deleteEntraUser(entra.objectId) } catch { /* logged internally */ }
      }
      results.push({ row: rowNum, success: false, email, fullName, error: err?.message || 'Unexpected error' })
    }

    // Small delay between Entra calls to respect rate limits
    if (userType === 'internal' && i < rows.length - 1) {
      await new Promise(r => setTimeout(r, 200))
    }
  }

  const successCount = results.filter(r => r.success).length
  const failCount = results.filter(r => !r.success).length

  return NextResponse.json({
    results,
    summary: { total: rows.length, success: successCount, failed: failCount },
  })
}
