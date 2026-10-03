/**
 * Building Directory Service
 *
 * Unified people directory for the building admin — covers all internal staff,
 * external clients, and maintenance staff (who have no auth account).
 * Also owns maintenance staff CRUD and facility assignment operations.
 */

import { createAdminClient } from '@/lib/supabase/server'
import {
  type DirectoryFilters,
  type DirectoryPerson,
  type DirectoryPersonDetail,
  type DirectoryBooking,
  type DirectoryPayment,
  type DirectorySchedule,
  type MaintenanceStaffMember,
  type FacilityAssignmentSummary,
  type PersonCategory,
  dbMaintenanceStaffToView,
  dbFmaToSummary,
} from './building.types'

/**
 * Order-independent, gap-tolerant token match for in-memory people search.
 *
 * A query is split into whitespace tokens and each token must appear somewhere
 * in the person's combined searchable text. This lets "ricardo dela cruz" match
 * a stored "Ricardo J. Dela Cruz" (middle initial), a reordered "dela cruz
 * ricardo", or a role phrase like "academic head" (category `academic_head`,
 * underscores normalized to spaces).
 */
function personMatchesSearch(p: DirectoryPerson, tokens: string[]): boolean {
  const haystack = [
    p.name,
    p.email,
    p.employeeId,
    p.departmentName,
    p.departmentCode,
    p.organizationName,
    p.position,
    p.category.replace(/_/g, ' '),
    ...p.roles.map((r) => r.replace(/_/g, ' ')),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return tokens.every((t) => haystack.includes(t))
}

// ─── Category helpers ────────────────────────────────────────────────────────

const TEACHING_ROLES = ['faculty', 'program_head', 'academic_head', 'teacher', 'professor']

function rolesToCategory(roles: string[]): PersonCategory {
  if (roles.includes('external_client')) return 'external_client'
  if (roles.includes('program_head')) return 'program_head'
  if (roles.includes('academic_head')) return 'academic_head'
  if (roles.includes('building_admin')) return 'building_admin'
  if (roles.includes('cashier')) return 'cashier'
  if (roles.includes('it_admin')) return 'it_admin'
  if (roles.some(r => TEACHING_ROLES.includes(r))) return 'faculty'
  return 'faculty'
}

function dbUserToDirectoryPerson(row: any): DirectoryPerson {
  const roles: string[] = (row.user_roles ?? [])
    .filter((ur: any) => ur.is_active)
    .map((ur: any) => ur.role?.name ?? '')
    .filter(Boolean)

  const category = rolesToCategory(roles)
  const extClient = row.external_clients?.[0] ?? null

  return {
    id: row.id,
    source: 'users',
    category,
    name: row.full_name ?? '',
    email: row.email ?? null,
    phone: row.phone ?? null,
    employeeId: row.employee_id ?? null,
    departmentId: row.department?.id ?? null,
    departmentName: row.department?.name ?? null,
    departmentCode: row.department?.code ?? null,
    position: null,
    organizationName: extClient?.organization_name ?? null,
    organizationType: extClient?.organization_type ?? null,
    isActive: row.is_active ?? true,
    isVerified: extClient?.is_verified ?? null,
    isBlacklisted: extClient?.is_blacklisted ?? null,
    lastActivityAt: row.last_login_at ?? null,
    avatarUrl: row.avatar_url ?? null,
    roles,
  }
}

function dbMaintenanceStaffToDirectoryPerson(row: any): DirectoryPerson {
  return {
    id: row.id,
    source: 'maintenance_staff',
    category: 'maintenance_staff',
    name: row.full_name ?? '',
    email: row.email ?? null,
    phone: row.phone ?? null,
    employeeId: row.employee_id ?? null,
    departmentId: null,
    departmentName: null,
    departmentCode: null,
    position: row.position ?? 'Maintenance Technician',
    organizationName: null,
    organizationType: null,
    isActive: row.is_active ?? true,
    isVerified: null,
    isBlacklisted: null,
    lastActivityAt: null,
    avatarUrl: row.avatar_url ?? null,
    roles: [],
  }
}

// ─── List all ────────────────────────────────────────────────────────────────

export const BuildingDirectoryService = {
  async listAll(filters?: DirectoryFilters) {
    const supabase = createAdminClient()
    const page = filters?.page ?? 1
    const pageSize = filters?.pageSize ?? 50
    const search = filters?.search?.trim() || undefined
    const statusFilter = filters?.status ?? 'all'
    const categoryFilter = filters?.category ?? 'all'

    // Fetch users and maintenance_staff in parallel
    const [usersResult, maintResult] = await Promise.all([
      supabase
        .from('users')
        .select(`
          id, full_name, email, phone, employee_id, avatar_url, is_active, last_login_at,
          department:departments!users_department_id_fkey(id, code, name),
          user_roles!user_roles_user_id_fkey(is_active, role:roles(name)),
          external_clients!external_clients_user_id_fkey(organization_name, organization_type, is_verified, is_blacklisted)
        `)
        .order('full_name'),

      supabase
        .from('maintenance_staff')
        .select('id, employee_id, full_name, email, phone, position, is_active, avatar_url')
        .order('full_name'),
    ])

    if (usersResult.error) throw new Error(usersResult.error.message)
    if (maintResult.error) throw new Error(maintResult.error.message)

    // Map to unified shape
    let people: DirectoryPerson[] = [
      ...(usersResult.data ?? []).map(dbUserToDirectoryPerson),
      ...(maintResult.data ?? []).map(dbMaintenanceStaffToDirectoryPerson),
    ]

    // Filters
    if (statusFilter === 'active') people = people.filter(p => p.isActive)
    if (statusFilter === 'inactive') people = people.filter(p => !p.isActive)

    if (categoryFilter !== 'all') {
      people = people.filter(p => p.category === categoryFilter)
    }

    if (filters?.departmentId) {
      people = people.filter(p => p.departmentId === filters.departmentId)
    }

    if (search) {
      const tokens = search.toLowerCase().split(/\s+/).filter(Boolean)
      if (tokens.length > 0) {
        people = people.filter(p => personMatchesSearch(p, tokens))
      }
    }

    // Sort
    const sortBy = filters?.sortBy ?? 'name'
    const asc = (filters?.sortOrder ?? 'asc') === 'asc'

    people.sort((a, b) => {
      let va: string | null = null
      let vb: string | null = null
      if (sortBy === 'name') { va = a.name; vb = b.name }
      else if (sortBy === 'category') { va = a.category; vb = b.category }
      else if (sortBy === 'department') { va = a.departmentName ?? a.organizationName; vb = b.departmentName ?? b.organizationName }
      else if (sortBy === 'status') { va = String(a.isActive); vb = String(b.isActive) }
      else if (sortBy === 'lastActivity') { va = a.lastActivityAt; vb = b.lastActivityAt }
      const cmp = (va ?? '').localeCompare(vb ?? '')
      return asc ? cmp : -cmp
    })

    const total = people.length
    const offset = (page - 1) * pageSize
    const items = people.slice(offset, offset + pageSize)

    return { items, total, page, pageSize }
  },

  // ─── Detail ──────────────────────────────────────────────────────────────

  async getDetail(id: string, source: 'users' | 'maintenance_staff'): Promise<DirectoryPersonDetail> {
    const supabase = createAdminClient()

    if (source === 'maintenance_staff') {
      const { data, error } = await supabase
        .from('maintenance_staff')
        .select(`
          id, employee_id, full_name, email, phone, position, specialization,
          hire_date, is_active, notes, avatar_url, created_at, updated_at,
          facility_maintenance_assignments(
            id, facility_id, is_active, assigned_at, unassigned_at,
            facility:facilities(id, code, name, room_number)
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw new Error(error.message)
      const m = data as any

      const activeFacilities: FacilityAssignmentSummary[] = (m.facility_maintenance_assignments ?? [])
        .filter((a: any) => a.is_active)
        .map(dbFmaToSummary)

      return {
        id: m.id,
        source: 'maintenance_staff',
        category: 'maintenance_staff',
        name: m.full_name,
        email: m.email ?? null,
        phone: m.phone ?? null,
        employeeId: m.employee_id,
        departmentId: null,
        departmentName: null,
        departmentCode: null,
        position: m.position,
        organizationName: null,
        organizationType: null,
        isActive: m.is_active,
        isVerified: null,
        isBlacklisted: null,
        lastActivityAt: null,
        avatarUrl: m.avatar_url ?? null,
        roles: [],
        contactPerson: null,
        contactPhone: m.phone ?? null,
        contactEmail: m.email ?? null,
        address: null,
        city: null,
        province: null,
        trustScore: null,
        verifiedAt: null,
        verificationNotes: null,
        blacklistReason: null,
        specialization: m.specialization ?? null,
        hireDate: m.hire_date ?? null,
        notes: m.notes ?? null,
        assignedFacilities: activeFacilities,
      }
    }

    // source === 'users'
    const { data, error } = await supabase
      .from('users')
      .select(`
        id, full_name, email, phone, employee_id, avatar_url, is_active, last_login_at,
        department:departments!users_department_id_fkey(id, code, name),
        user_roles!user_roles_user_id_fkey(is_active, role:roles(name)),
        external_clients!external_clients_user_id_fkey(
          organization_name, organization_type, contact_person, contact_phone, contact_email,
          address, city, province, postal_code, is_verified, verified_at, verification_notes,
          is_blacklisted, blacklist_reason, trust_score
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw new Error(error.message)
    const u = data as any

    const roles: string[] = (u.user_roles ?? [])
      .filter((ur: any) => ur.is_active)
      .map((ur: any) => ur.role?.name ?? '')
      .filter(Boolean)

    const category = rolesToCategory(roles)
    const ext = u.external_clients?.[0] ?? null

    return {
      id: u.id,
      source: 'users',
      category,
      name: u.full_name ?? '',
      email: u.email ?? null,
      phone: u.phone ?? null,
      employeeId: u.employee_id ?? null,
      departmentId: u.department?.id ?? null,
      departmentName: u.department?.name ?? null,
      departmentCode: u.department?.code ?? null,
      position: null,
      organizationName: ext?.organization_name ?? null,
      organizationType: ext?.organization_type ?? null,
      isActive: u.is_active ?? true,
      isVerified: ext?.is_verified ?? null,
      isBlacklisted: ext?.is_blacklisted ?? null,
      lastActivityAt: u.last_login_at ?? null,
      avatarUrl: u.avatar_url ?? null,
      roles,
      contactPerson: ext?.contact_person ?? null,
      contactPhone: ext?.contact_phone ?? null,
      contactEmail: ext?.contact_email ?? null,
      address: ext?.address ?? null,
      city: ext?.city ?? null,
      province: ext?.province ?? null,
      trustScore: ext?.trust_score ?? null,
      verifiedAt: ext?.verified_at ?? null,
      verificationNotes: ext?.verification_notes ?? null,
      blacklistReason: ext?.blacklist_reason ?? null,
      specialization: null,
      hireDate: null,
      notes: null,
    }
  },

  // ─── Tab data ────────────────────────────────────────────────────────────

  async getBookings(userId: string): Promise<DirectoryBooking[]> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, booking_reference, booking_date, start_time, end_time, purpose, event_name,
        current_status, requires_payment, payment_status, submitted_at,
        booking_course_code, booking_department_code,
        booking_facilities(facility:facilities(name))
      `)
      .eq('user_id', userId)
      .order('booking_date', { ascending: false })
      .limit(100)

    if (error) throw new Error(error.message)

    const rows = data ?? []
    const codes = [...new Set(
      rows.filter((b: any) => b.booking_course_code).map((b: any) => `${b.booking_department_code}:${b.booking_course_code}`)
    )]
    const courseInfoMap = new Map<string, { course_name: string; is_elective: boolean; elective_type: string | null }>()
    if (codes.length > 0) {
      const { data: courses } = await supabase
        .from('courses')
        .select('course_code, department_code, course_name, is_elective, elective_type')
      for (const c of courses ?? []) {
        courseInfoMap.set(`${c.department_code}:${c.course_code}`, {
          course_name: c.course_name,
          is_elective: c.is_elective,
          elective_type: c.elective_type,
        })
      }
    }

    return rows.map((b: any) => {
      const courseInfo = b.booking_course_code
        ? courseInfoMap.get(`${b.booking_department_code}:${b.booking_course_code}`)
        : undefined
      return {
        id: b.id,
        bookingReference: b.booking_reference,
        bookingDate: b.booking_date,
        startTime: b.start_time,
        endTime: b.end_time,
        purpose: b.purpose,
        eventName: b.event_name ?? null,
        currentStatus: b.current_status,
        requiresPayment: b.requires_payment,
        paymentStatus: b.payment_status ?? null,
        facilities: (b.booking_facilities ?? []).map((bf: any) => bf.facility?.name ?? '').filter(Boolean),
        submittedAt: b.submitted_at,
        courseCode: b.booking_course_code ?? null,
        courseName: courseInfo?.course_name ?? null,
        isElective: courseInfo?.is_elective ?? false,
        electiveType: courseInfo?.elective_type ?? null,
      }
    })
  },

  async getPayments(userId: string): Promise<DirectoryPayment[]> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('payments')
      .select(`
        id, payment_reference, amount, total_amount, currency,
        payment_method, payment_status, paid_at, created_at,
        booking:bookings(booking_reference)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw new Error(error.message)

    return (data ?? []).map((p: any) => ({
      id: p.id,
      paymentReference: p.payment_reference,
      amount: p.amount,
      totalAmount: p.total_amount ?? p.amount,
      currency: p.currency ?? 'PHP',
      paymentMethod: p.payment_method,
      paymentStatus: p.payment_status,
      bookingReference: p.booking?.booking_reference ?? '',
      paidAt: p.paid_at ?? null,
      createdAt: p.created_at,
    }))
  },

  async getSchedules(userId: string): Promise<DirectorySchedule[]> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('class_schedules')
      .select(`
        id, course_code, course_name, section, day_of_week, start_time, end_time,
        facility:facilities(code, name, room_number)
      `)
      .eq('instructor_id', userId)
      .eq('is_active', true)
      .is('superseded_at', null)
      .order('day_of_week')
      .order('start_time')

    if (error) throw new Error(error.message)

    return (data ?? []).map((s: any) => ({
      id: s.id,
      courseCode: s.course_code,
      courseName: s.course_name,
      section: s.section,
      dayOfWeek: s.day_of_week,
      startTime: s.start_time,
      endTime: s.end_time,
      facilityName: s.facility?.name ?? null,
      facilityCode: s.facility?.code ?? null,
      roomNumber: s.facility?.room_number ?? null,
    }))
  },

  async getFacilityAssignments(staffId: string): Promise<FacilityAssignmentSummary[]> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('facility_maintenance_assignments')
      .select(`
        id, facility_id, is_active, assigned_at, unassigned_at,
        facility:facilities(id, code, name, room_number)
      `)
      .eq('maintenance_staff_id', staffId)
      .eq('is_active', true)
      .order('assigned_at', { ascending: false })

    if (error) throw new Error(error.message)
    return (data ?? []).map(dbFmaToSummary)
  },

  // ─── Maintenance staff CRUD ───────────────────────────────────────────────

  async createMaintenanceStaff(input: {
    fullName: string
    email?: string | null
    phone?: string | null
    position?: string
    specialization?: string | null
    hireDate?: string | null
    notes?: string | null
    createdBy?: string | null
  }): Promise<MaintenanceStaffMember> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('maintenance_staff')
      .insert({
        full_name: input.fullName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        position: input.position ?? 'Maintenance Technician',
        specialization: input.specialization ?? null,
        hire_date: input.hireDate ?? null,
        notes: input.notes ?? null,
        created_by: input.createdBy ?? null,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return dbMaintenanceStaffToView(data)
  },

  async updateMaintenanceStaff(id: string, patch: {
    fullName?: string
    email?: string | null
    phone?: string | null
    position?: string
    specialization?: string | null
    hireDate?: string | null
    notes?: string | null
  }): Promise<MaintenanceStaffMember> {
    const supabase = createAdminClient()
    const update: any = {}
    if (patch.fullName !== undefined) update.full_name = patch.fullName
    if (patch.email !== undefined) update.email = patch.email
    if (patch.phone !== undefined) update.phone = patch.phone
    if (patch.position !== undefined) update.position = patch.position
    if (patch.specialization !== undefined) update.specialization = patch.specialization
    if (patch.hireDate !== undefined) update.hire_date = patch.hireDate
    if (patch.notes !== undefined) update.notes = patch.notes

    const { data, error } = await supabase
      .from('maintenance_staff')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return dbMaintenanceStaffToView(data)
  },

  async deactivateMaintenanceStaff(id: string): Promise<void> {
    const supabase = createAdminClient()

    // Soft-unassign all active facility assignments first
    await supabase
      .from('facility_maintenance_assignments')
      .update({ is_active: false, unassigned_at: new Date().toISOString() })
      .eq('maintenance_staff_id', id)
      .eq('is_active', true)

    const { error } = await supabase
      .from('maintenance_staff')
      .update({ is_active: false })
      .eq('id', id)

    if (error) throw new Error(error.message)
  },

  // ─── Facility assignments ─────────────────────────────────────────────────

  async assignToFacilities(
    staffId: string,
    facilityIds: string[],
    assignedBy: string | null
  ): Promise<FacilityAssignmentSummary[]> {
    const supabase = createAdminClient()
    const rows = facilityIds.map(fid => ({
      maintenance_staff_id: staffId,
      facility_id: fid,
      assigned_by: assignedBy,
    }))

    const { data, error } = await supabase
      .from('facility_maintenance_assignments')
      .insert(rows)
      .select(`
        id, facility_id, is_active, assigned_at,
        facility:facilities(id, code, name, room_number)
      `)

    if (error) throw new Error(error.message)
    return (data ?? []).map(dbFmaToSummary)
  },

  async unassignFromFacility(assignmentId: string): Promise<void> {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('facility_maintenance_assignments')
      .update({ is_active: false, unassigned_at: new Date().toISOString() })
      .eq('id', assignmentId)

    if (error) throw new Error(error.message)
  },

  async reassignFacility(
    staffId: string,
    fromFacilityId: string,
    toFacilityId: string,
    assignedBy: string | null
  ): Promise<FacilityAssignmentSummary> {
    const supabase = createAdminClient()

    // Soft-unassign old
    await supabase
      .from('facility_maintenance_assignments')
      .update({ is_active: false, unassigned_at: new Date().toISOString() })
      .eq('maintenance_staff_id', staffId)
      .eq('facility_id', fromFacilityId)
      .eq('is_active', true)

    // Assign new
    const { data, error } = await supabase
      .from('facility_maintenance_assignments')
      .insert({
        maintenance_staff_id: staffId,
        facility_id: toFacilityId,
        assigned_by: assignedBy,
      })
      .select(`
        id, facility_id, is_active, assigned_at,
        facility:facilities(id, code, name, room_number)
      `)
      .single()

    if (error) throw new Error(error.message)
    return dbFmaToSummary(data)
  },
}
