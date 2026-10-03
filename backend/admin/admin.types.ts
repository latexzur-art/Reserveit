/**
 * Admin Panel Types for ReserveIT
 *
 * Bridges admin panel UI with database schema.
 * Components use these types directly.
 */

// === UI-facing type unions (used by components) ===

export type UserType = 'Internal' | 'External'

export type UserRole =
  | 'IT Admin'
  | 'Building Admin'
  | 'Academic Head'
  | 'Program Head'
  | 'Faculty'
  | 'External Client'

export type UserStatus = 'Active' | 'Inactive' | 'Suspended' | 'Pending'

export type Department = string // Dynamic from DB, not hardcoded

// === Main User interface (used by all admin components) ===

export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  type: UserType
  role: UserRole
  roleName: string // snake_case DB name: 'building_admin'
  roleId: string   // UUID for API calls
  department: string // department code: 'CCS', 'BSIT', etc.
  departmentId: string | null
  organization?: string
  status: UserStatus
  bookingsCount: number
  createdAt: Date
  lastLogin?: Date
  avatar?: string
  entraObjectId?: string
  notificationEmail?: string | null
}

// === Messaging types ===

export interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  read: boolean
  createdAt: Date
  userId?: string
}

export interface Message {
  id: string
  recipientId: string
  recipientName: string
  subject: string
  body: string
  sendAs: 'email' | 'in-app' | 'both'
  scheduledAt?: Date
  sentAt?: Date
  status: 'draft' | 'scheduled' | 'sent'
}

export interface Broadcast {
  id: string
  title: string
  message: string
  targetAudience: 'all' | 'internal' | 'external' | 'admins'
  createdAt: Date
  sentAt?: Date
}

export interface MessageTemplate {
  id: string
  name: string
  icon: string
  subject: string
  body: string
  defaultAudience?: 'all' | 'internal' | 'external'
}

// === Audit log types ===

export interface AuditLog {
  id: string
  actorName: string | null
  actorEmail: string | null
  action: string
  targetType: string
  targetId: string | null
  details: Record<string, any>
  createdAt: string
}

export const auditActionColors: Record<string, string> = {
  'user.create': 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  'user.update': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  'user.password_reset': 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800',
  'user.delete': 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  'user.permanent_delete': 'bg-red-200 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  'user.restore': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  'user.bulk_delete': 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  'status.change': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  'role.assign': 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
  'role.remove': 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
  'role.create': 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
  'role.update': 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
  'role.deactivate': 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
  'settings.update': 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800',
  'message.send': 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800',
  'broadcast.send': 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800',
}

export const auditActionLabels: Record<string, string> = {
  'user.create': 'User Created',
  'user.update': 'User Updated',
  'user.password_reset': 'Password Reset',
  'user.delete': 'User Archived',
  'user.permanent_delete': 'User Deleted',
  'user.restore': 'User Restored',
  'user.bulk_delete': 'Bulk Delete',
  'status.change': 'Status Changed',
  'role.assign': 'Role Assigned',
  'role.remove': 'Role Removed',
  'role.create': 'Role Created',
  'role.update': 'Role Updated',
  'role.deactivate': 'Role Deactivated',
  'settings.update': 'Settings Updated',
  'message.send': 'Message Sent',
  'broadcast.send': 'Broadcast Sent',
}

// === Filter types ===

export interface UserFilters {
  search: string
  type: UserType | 'all'
  role: UserRole | 'all'
  status: UserStatus | 'all'
}

// === Reference data types ===

export interface RoleOption {
  id: string
  name: string // snake_case: 'building_admin'
  displayName: string // 'Building Admin'
  badgeColor: string
  isInternalOnly: boolean
}

export interface DepartmentOption {
  id: string
  code: string
  name: string
}

// === UI color maps ===

export const roleColors: Record<string, string> = {
  'IT Admin': 'border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  'it_admin': 'border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  'Building Admin': 'border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  'building_admin': 'border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  'Academic Head': 'border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300',
  'academic_head': 'border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300',
  'Program Head': 'border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  'program_head': 'border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  'Faculty': 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  'faculty': 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  'PAMO': 'border border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  'PAMO Officer': 'border border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  'pamo_officer': 'border border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  'pamo': 'border border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  'External Client': 'border border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  'external_client': 'border border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
}

export const statusColors: Record<string, string> = {
  'Active': 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  'active': 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  'Inactive': 'border border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  'inactive': 'border border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  'Suspended': 'border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  'suspended': 'border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  'Pending': 'border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  'pending': 'border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
}

export const rolesByType: Record<UserType, UserRole[]> = {
  'Internal': ['IT Admin', 'Building Admin', 'Academic Head', 'Program Head', 'Faculty'],
  'External': ['External Client'],
}

// === DB <-> UI mapping helpers ===

export const roleDisplayToDb: Record<string, string> = {
  'IT Admin': 'it_admin',
  'Building Admin': 'building_admin',
  'Academic Head': 'academic_head',
  'Program Head': 'program_head',
  'Faculty': 'faculty',
  'External Client': 'external_client',
}

export const roleDbToDisplay: Record<string, string> = Object.fromEntries(
  Object.entries(roleDisplayToDb).map(([k, v]) => [v, k])
)

export const statusDisplayToDb: Record<string, string> = {
  'Active': 'active',
  'Inactive': 'inactive',
  'Suspended': 'suspended',
  'Pending': 'pending',
}

export const statusDbToDisplay: Record<string, string> = Object.fromEntries(
  Object.entries(statusDisplayToDb).map(([k, v]) => [v, k])
)

export const typeDisplayToDb: Record<string, string> = {
  'Internal': 'internal',
  'External': 'external',
}

export const typeDbToDisplay: Record<string, string> = {
  'internal': 'Internal',
  'external': 'External',
}

// === System settings types ===

export interface SystemSetting {
  key: string
  value: any
  category: string
  description?: string
  updatedAt?: string
}

export interface GeneralSettings {
  institution_name: string
  app_name: string
  admin_contact_email: string
  admin_contact_phone: string
  academic_year: string
  current_semester: string
  enforce_external_client_cancellations?: boolean
}

export const defaultGeneralSettings: GeneralSettings = {
  institution_name: 'STI College Lucena',
  app_name: 'ReserveIT',
  admin_contact_email: '',
  admin_contact_phone: '',
  academic_year: '2025-2026',
  current_semester: '2nd Semester',
  enforce_external_client_cancellations: false,
}

export interface EmergencySettings {
  helpdeskPhone: string
  rescheduleTemplate: string
  declineTemplate: string
  cancelTemplate: string
}

export const defaultEmergencySettings: EmergencySettings = {
  helpdeskPhone: '',
  rescheduleTemplate: '',
  declineTemplate: '',
  cancelTemplate: '',
}

// === Extended Role types for settings page ===

export interface RoleDetail extends RoleOption {
  description: string
  permissions: Record<string, string[]>
  isActive: boolean
  userCount: number
}

export const PERMISSION_RESOURCES = [
  'facilities', 'bookings', 'users', 'equipment', 'reports',
] as const

export const PERMISSION_ACTIONS = [
  'create', 'read', 'update', 'delete', 'approve',
] as const

export type PermissionResource = typeof PERMISSION_RESOURCES[number]
export type PermissionAction = typeof PERMISSION_ACTIONS[number]

// Badge color options for roles
export const BADGE_COLOR_OPTIONS = [
  { value: 'gray', label: 'Gray' },
  { value: 'red', label: 'Red' },
  { value: 'blue', label: 'Blue' },
  { value: 'green', label: 'Green' },
  { value: 'purple', label: 'Purple' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'teal', label: 'Teal' },
  { value: 'orange', label: 'Orange' },
] as const

// === Reports types ===

export interface UserDistributionData {
  byType: { type: string; count: number; percentage: number }[]
  byRole: { role: string; roleName: string; count: number; badgeColor: string }[]
  byStatus: { status: string; count: number }[]
  byDepartment: { code: string; name: string; count: number }[]
}

export interface KeyMetricsData {
  totalUsers: { current: number; previousMonth: number; change: number }
  newUsersThisMonth: number
  activeUsers: number
  pendingApprovals: number
  topDepartment: { code: string; name: string; userCount: number } | null
}
