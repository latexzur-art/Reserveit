/**
 * Building Facility Enhancement Service
 *
 * Warnings, reviews, photo gallery, and issue-report → maintenance conversion.
 */

import { createAdminClient } from '@/lib/supabase/server'
import {
  dbWarningToView,
  dbReviewToView,
  dbPhotoToView,
  dbIssueReportToView,
  type ReviewFilters,
} from './building.types'

export const BuildingFacilityEnhancementService = {
  // ─── Warnings ───

  async getActiveWarnings(facilityId: string) {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('facility_warnings')
      .select('*, created_by_user:users!facility_warnings_created_by_fkey(full_name)')
      .eq('facility_id', facilityId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return (data || []).map(dbWarningToView)
  },

  async createWarning(input: { facilityId: string; severity?: string; message: string; createdBy: string }) {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('facility_warnings')
      .insert({
        facility_id: input.facilityId,
        severity: input.severity || 'warning',
        message: input.message,
        created_by: input.createdBy,
      })
      .select('*, created_by_user:users!facility_warnings_created_by_fkey(full_name)')
      .single()

    if (error) throw new Error(error.message)
    return dbWarningToView(data)
  },

  async updateWarning(id: string, updates: { isActive?: boolean; severity?: string; message?: string }) {
    const supabase = createAdminClient()
    const dbUpdates: Record<string, any> = {}
    if (updates.isActive !== undefined) {
      dbUpdates.is_active = updates.isActive
      if (!updates.isActive) dbUpdates.resolved_at = new Date().toISOString()
    }
    if (updates.severity !== undefined) dbUpdates.severity = updates.severity
    if (updates.message !== undefined) dbUpdates.message = updates.message

    const { data, error } = await supabase
      .from('facility_warnings')
      .update(dbUpdates)
      .eq('id', id)
      .select('*, created_by_user:users!facility_warnings_created_by_fkey(full_name)')
      .single()

    if (error) throw new Error(error.message)
    return dbWarningToView(data)
  },

  async deleteWarning(id: string) {
    const supabase = createAdminClient()
    const { error } = await supabase.from('facility_warnings').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  // ─── Reviews ───

  async getPublishedReviews(facilityId: string) {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('facility_reviews')
      .select('*, user:users!facility_reviews_user_id_fkey(full_name)')
      .eq('facility_id', facilityId)
      .eq('status', 'published')
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return (data || []).map(dbReviewToView)
  },

  async createReview(input: {
    facilityId: string
    userId: string
    bookingId?: string | null
    rating: number
    comment?: string | null
    issueReported?: boolean
    issueCategory?: string | null
  }) {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('facility_reviews')
      .insert({
        facility_id: input.facilityId,
        user_id: input.userId,
        booking_id: input.bookingId || null,
        rating: input.rating,
        comment: input.comment || null,
        issue_reported: input.issueReported || false,
        issue_category: input.issueReported ? input.issueCategory || null : null,
      })
      .select('*, user:users!facility_reviews_user_id_fkey(full_name)')
      .single()

    if (error) throw new Error(error.message)
    return dbReviewToView(data)
  },

  async adminListReviews(filters?: ReviewFilters) {
    const supabase = createAdminClient()
    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 50
    const offset = (page - 1) * pageSize

    let query = supabase
      .from('facility_reviews')
      .select('*, user:users!facility_reviews_user_id_fkey(full_name), facility:facilities(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (filters?.facilityId) query = query.eq('facility_id', filters.facilityId)
    if (filters?.rating) query = query.eq('rating', filters.rating)
    if (filters?.status) query = query.eq('status', filters.status)
    if (filters?.hasIssue !== undefined) query = query.eq('issue_reported', filters.hasIssue)

    const { data, error, count } = await query
    if (error) throw new Error(error.message)

    return { reviews: (data || []).map(dbReviewToView), total: count || 0 }
  },

  async moderateReview(id: string, status: 'published' | 'under_review' | 'archived') {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('facility_reviews')
      .update({ status })
      .eq('id', id)
      .select('*, user:users!facility_reviews_user_id_fkey(full_name), facility:facilities(name)')
      .single()

    if (error) throw new Error(error.message)
    return dbReviewToView(data)
  },

  // ─── Photos ───

  async getPhotos(facilityId: string) {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('facility_photos')
      .select('*')
      .eq('facility_id', facilityId)
      .order('is_cover', { ascending: false })
      .order('sort_order', { ascending: true })

    if (error) throw new Error(error.message)
    return (data || []).map(dbPhotoToView)
  },

  async addPhoto(input: {
    facilityId: string
    storagePath: string
    publicUrl: string
    caption?: string | null
    isCover?: boolean
    createdBy: string
  }) {
    const supabase = createAdminClient()

    if (input.isCover) {
      await supabase.from('facility_photos').update({ is_cover: false }).eq('facility_id', input.facilityId)
    } else {
      // First photo for a facility automatically becomes the cover
      const { count } = await supabase
        .from('facility_photos')
        .select('id', { count: 'exact', head: true })
        .eq('facility_id', input.facilityId)
      if (!count) input.isCover = true
    }

    const { data, error } = await supabase
      .from('facility_photos')
      .insert({
        facility_id: input.facilityId,
        storage_path: input.storagePath,
        public_url: input.publicUrl,
        caption: input.caption || null,
        is_cover: input.isCover || false,
        created_by: input.createdBy,
      })
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    return dbPhotoToView(data)
  },

  async updatePhoto(id: string, updates: { caption?: string; isCover?: boolean; sortOrder?: number }) {
    const supabase = createAdminClient()

    if (updates.isCover) {
      const { data: photo, error: fetchError } = await supabase
        .from('facility_photos')
        .select('facility_id')
        .eq('id', id)
        .single()
      if (fetchError) throw new Error(fetchError.message)

      await supabase.from('facility_photos').update({ is_cover: false }).eq('facility_id', photo.facility_id)
    }

    const dbUpdates: Record<string, any> = {}
    if (updates.caption !== undefined) dbUpdates.caption = updates.caption
    if (updates.isCover !== undefined) dbUpdates.is_cover = updates.isCover
    if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder

    const { data, error } = await supabase
      .from('facility_photos')
      .update(dbUpdates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    return dbPhotoToView(data)
  },

  /** Returns the deleted row's storage_path so the caller can remove the storage object too. */
  async deletePhoto(id: string) {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('facility_photos')
      .delete()
      .eq('id', id)
      .select('storage_path, is_cover, facility_id')
      .single()

    if (error) throw new Error(error.message)

    // Promote the next photo to cover if the deleted one was the cover
    if (data?.is_cover) {
      const { data: next } = await supabase
        .from('facility_photos')
        .select('id')
        .eq('facility_id', data.facility_id)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (next) {
        await supabase.from('facility_photos').update({ is_cover: true }).eq('id', next.id)
      }
    }

    return data
  },

  // ─── Issue Reports ───

  async listOpenIssueReports() {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('facility_issue_reports')
      .select('*, facility:facilities(name), reported_by_user:users!facility_issue_reports_reported_by_fkey(full_name)')
      .eq('status', 'open')
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return (data || []).map(dbIssueReportToView)
  },

  async convertIssueToMaintenance(id: string, createdBy: string) {
    const supabase = createAdminClient()

    const { data: report, error: reportError } = await supabase
      .from('facility_issue_reports')
      .select('*, facility:facilities(name)')
      .eq('id', id)
      .single()
    if (reportError) throw new Error(reportError.message)
    if (report.status !== 'open') throw new Error('Issue report is not open')

    const { data: record, error: insertError } = await supabase
      .from('maintenance_records')
      .insert({
        type: 'facility',
        target_id: report.facility_id,
        target_name: report.facility?.name || 'Unknown Facility',
        schedule_date: new Date().toISOString().split('T')[0],
        technician: 'Unassigned',
        status: 'scheduled',
        notes: `[${report.category}] ${report.details || ''}`.trim(),
        created_by: createdBy,
      })
      .select('id')
      .single()
    if (insertError) throw new Error(insertError.message)

    const { data, error } = await supabase
      .from('facility_issue_reports')
      .update({ status: 'converted', maintenance_record_id: record.id })
      .eq('id', id)
      .select('*, facility:facilities(name), reported_by_user:users!facility_issue_reports_reported_by_fkey(full_name)')
      .single()
    if (error) throw new Error(error.message)

    return dbIssueReportToView(data)
  },

  async dismissIssueReport(id: string) {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('facility_issue_reports')
      .update({ status: 'dismissed' })
      .eq('id', id)
      .select('*, facility:facilities(name), reported_by_user:users!facility_issue_reports_reported_by_fkey(full_name)')
      .single()

    if (error) throw new Error(error.message)
    return dbIssueReportToView(data)
  },

  // ─── Public catalog (brochure showcase) ───

  async getCatalog(filters?: { floorId?: string; typeId?: string; minCapacity?: number; search?: string; rentalOnly?: boolean }) {
    const supabase = createAdminClient()

    let query = supabase
      .from('facilities')
      .select(`
        id, code, name, description, room_number, capacity, status, is_available_for_rental,
        floor:floors!facilities_floor_id_fkey(id, name, floor_number, building:buildings(name)),
        facility_type:facility_types!facilities_facility_type_id_fkey(id, name)
      `)
      .eq('is_active', true)
      .order('room_number', { ascending: true })

    // Rental-only (external client) view mirrors /api/facilities?rental=true: rental
    // facilities aren't necessarily flagged is_bookable, so skip that filter for them.
    if (filters?.rentalOnly) {
      query = query.eq('is_available_for_rental', true)
    } else {
      query = query.eq('is_bookable', true).eq('status', 'available')
    }

    if (filters?.floorId) query = query.eq('floor_id', filters.floorId)
    if (filters?.typeId) query = query.eq('facility_type_id', filters.typeId)
    if (filters?.minCapacity) query = query.gte('capacity', filters.minCapacity)
    if (filters?.search) {
      const s = filters.search.replace(/[%_\\]/g, ch => `\\${ch}`)
      query = query.or(`name.ilike.%${s}%,room_number.ilike.%${s}%`)
    }

    const { data: facilities, error } = await query
    if (error) throw new Error(error.message)

    const ids = (facilities || []).map((f: any) => f.id)
    if (ids.length === 0) return []

    const [amenitiesResult, photosResult, reviewsResult, warningsResult] = await Promise.all([
      supabase.from('facility_amenity_map')
        .select('facility_id, quantity, notes, amenity:facility_amenities(name, icon, category, is_active)')
        .in('facility_id', ids),
      supabase.from('facility_photos').select('facility_id, public_url').in('facility_id', ids).eq('is_cover', true),
      supabase.from('facility_reviews').select('facility_id, rating').in('facility_id', ids).eq('status', 'published'),
      supabase.from('facility_warnings').select('facility_id').in('facility_id', ids).eq('is_active', true),
    ])

    const amenityMap = new Map<string, { name: string; displayName: string; icon: string | null; category: string; quantity: number; notes: string | null }[]>()
    for (const row of amenitiesResult.data || []) {
      const amenity = row.amenity as any
      if (!amenity || amenity.is_active === false) continue
      const list = amenityMap.get(row.facility_id) || []
      list.push({
        name: amenity.name,
        displayName: amenity.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        icon: amenity.icon,
        category: amenity.category,
        quantity: row.quantity,
        notes: row.notes || null,
      })
      amenityMap.set(row.facility_id, list)
    }

    const coverMap = new Map<string, string>()
    for (const row of photosResult.data || []) coverMap.set(row.facility_id, row.public_url)

    const ratingMap = new Map<string, { sum: number; count: number }>()
    for (const row of reviewsResult.data || []) {
      const entry = ratingMap.get(row.facility_id) || { sum: 0, count: 0 }
      entry.sum += row.rating
      entry.count += 1
      ratingMap.set(row.facility_id, entry)
    }

    const warnedSet = new Set((warningsResult.data || []).map(row => row.facility_id))

    return (facilities || []).map((f: any) => {
      const rating = ratingMap.get(f.id)
      return {
        id: f.id,
        code: f.code,
        name: f.name,
        description: f.description || null,
        roomNumber: f.room_number,
        capacity: f.capacity,
        status: f.status,
        isAvailableForRental: f.is_available_for_rental,
        floorId: f.floor?.id,
        floorName: f.floor?.name || '',
        floorNumber: f.floor?.floor_number || 0,
        buildingName: f.floor?.building?.name || '',
        facilityTypeId: f.facility_type?.id,
        facilityTypeName: f.facility_type?.name || '',
        coverPhotoUrl: coverMap.get(f.id) || null,
        amenities: amenityMap.get(f.id) || [],
        avgRating: rating ? Math.round((rating.sum / rating.count) * 10) / 10 : null,
        reviewCount: rating?.count || 0,
        hasActiveWarning: warnedSet.has(f.id),
      }
    })
  },

  // ─── Unreviewed bookings ───

  async getUnreviewedBookings(userId: string) {
    const supabase = createAdminClient()

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        id, booking_reference, booking_date, start_time, end_time, purpose, event_name,
        booking_facilities(facility:facilities(id, name, room_number))
      `)
      .eq('user_id', userId)
      .eq('current_status', 'completed')
      .order('booking_date', { ascending: false })
      .limit(50)
    if (error) throw new Error(error.message)

    const bookingIds = (bookings || []).map(b => b.id)
    if (bookingIds.length === 0) return []

    const { data: reviewed, error: reviewError } = await supabase
      .from('facility_reviews')
      .select('booking_id')
      .eq('user_id', userId)
      .in('booking_id', bookingIds)
    if (reviewError) throw new Error(reviewError.message)

    const reviewedSet = new Set((reviewed || []).map(r => r.booking_id))

    return (bookings || [])
      .filter(b => !reviewedSet.has(b.id))
      .map((b: any) => ({
        id: b.id,
        bookingReference: b.booking_reference,
        bookingDate: b.booking_date,
        startTime: b.start_time,
        endTime: b.end_time,
        purpose: b.purpose,
        eventName: b.event_name,
        facilities: (b.booking_facilities || []).map((bf: any) => ({
          id: bf.facility?.id,
          name: bf.facility?.name,
          roomNumber: bf.facility?.room_number,
        })),
      }))
  },
}
