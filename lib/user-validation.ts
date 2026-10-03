import { INTERNAL_DOMAINS } from '@/backend/auth/auth.constants'

export interface ParsedRow {
  first_name: string
  last_name: string
  email: string
  phone?: string
  user_type: string // 'Internal' | 'External'
  role: string
  department?: string
  organization?: string
  notification_email?: string
  provision_entra: boolean
  validationError?: string
}

export function validateUserRow(row: ParsedRow, validRoles: string[]): string | undefined {
  if (!row.first_name) return 'Missing first name'
  if (!row.last_name) return 'Missing last name'
  if (!row.email) return 'Missing email'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return 'Invalid email format'
  
  const ut = row.user_type?.toLowerCase()
  if (ut !== 'internal' && ut !== 'external') return 'Select a user type (Internal or External)'
  if (!row.role) return 'Select a role'
  if (!validRoles.includes(row.role.toLowerCase().replace(/ /g, '_'))) return `Unknown role: "${row.role}"`
  
  if (ut === 'internal') {
    if (!INTERNAL_DOMAINS.some(domain => row.email.toLowerCase().endsWith(domain))) {
      return `Internal users must have an authorized domain (${INTERNAL_DOMAINS.join(', ')}) email`
    }
    if (row.notification_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.notification_email)) {
      return 'Invalid notification email format'
    }
  }
  return undefined
}
