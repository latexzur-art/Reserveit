/**
 * Room Match Rating
 *
 * Deterministic 0–100 "how good a pick is this room?" score for the AI assistant.
 * This is the room *suitability* signal (capacity fit, type match, specialization
 * affinity, availability) — distinct from the approval grade in `scorePreview.ts`,
 * which is how the pipeline would actually rule on the booking. The UI shows both.
 *
 * Pure function — no DB calls. Operates on the facility shape the chat route and
 * `/api/ai/available-facilities` already return.
 *
 * @module backend/booking/roomRating
 */

export interface RateableRoom {
  id: string
  name: string
  facility_type_name: string | null
  capacity: number
  is_paid_facility?: boolean
  /** One of: computer_use | science_lab | av_studio | gym (from facility_purpose_tags). */
  specialized_tag?: string | null
}

export interface RoomRatingFields {
  booking_purpose: string | null
  expected_attendees: number | null
  session_type: 'lecture' | 'lab' | null
  booking_course_code?: string | null
}

export interface RoomRating {
  rating: number // 0–100
  stars: number // 1–5
  reasons: string[]
  breakdown: { capacity: number; type: number; specialization: number; availability: number }
}

// Weights — sum to 100.
const W_CAPACITY = 40
const W_TYPE = 35
const W_SPECIALIZATION = 15
const W_AVAILABILITY = 10

const LAB_TYPE_HINTS = ['lab', 'computer', 'clab']
const LAB_TAGS = ['computer_use', 'science_lab', 'hospitality_lab']
const CLASSROOM_TYPE_HINTS = ['classroom', 'lecture']
const EVENT_TYPE_HINTS = ['auditorium', 'multipurpose', 'multi-purpose', 'multi purpose', 'function', 'gym', 'hall']
const MEETING_TYPE_HINTS = ['conference', 'meeting']

function typeIncludes(typeName: string, hints: string[]): boolean {
  return hints.some((h) => typeName.includes(h))
}

/**
 * Score how well a room fits the requested booking. Higher = better pick.
 */
export function rateRoom(room: RateableRoom, fields: RoomRatingFields): RoomRating {
  const reasons: string[] = []
  const typeName = (room.facility_type_name ?? '').toLowerCase()
  const tag = (room.specialized_tag ?? '').toLowerCase()
  const isLabRoom = typeIncludes(typeName, LAB_TYPE_HINTS) || LAB_TAGS.includes(tag)

  // ── Capacity fit (W_CAPACITY) ────────────────────────────────────────────
  let capacityScore: number
  const attendees = fields.expected_attendees ?? null
  if (attendees == null || attendees <= 0) {
    capacityScore = W_CAPACITY * 0.7 // unknown headcount → moderate, can't fully assess
    reasons.push(`Capacity ${room.capacity} (headcount not specified)`)
  } else if (room.capacity < attendees) {
    capacityScore = 0
    reasons.push(`Too small — fits ${room.capacity}, you need ${attendees}`)
  } else {
    const fill = attendees / room.capacity // 0..1, closer to 1 = tighter (better) fit
    let frac: number
    if (fill >= 0.5) frac = 1
    else if (fill >= 0.3) frac = 0.85
    else if (fill >= 0.15) frac = 0.65
    else frac = 0.45 // works, but heavily oversized
    capacityScore = W_CAPACITY * frac
    reasons.push(
      fill >= 0.3
        ? `Good capacity fit — ${attendees} of ${room.capacity}`
        : `Fits, but oversized — ${attendees} of ${room.capacity}`
    )
  }

  // ── Type match (W_TYPE) ──────────────────────────────────────────────────
  let typeScore: number
  const purpose = fields.booking_purpose
  const wantsLab = fields.session_type === 'lab'
  const wantsLecture = fields.session_type === 'lecture' || (purpose === 'academic' && !wantsLab)

  if (wantsLab) {
    typeScore = isLabRoom ? W_TYPE : W_TYPE * 0.15
    reasons.push(isLabRoom ? 'Lab room matches a lab session' : 'Not a lab room — lab session may be flagged')
  } else if (wantsLecture) {
    // Lecture/class should be a classroom, NOT a lab/gym/auditorium.
    if (typeIncludes(typeName, CLASSROOM_TYPE_HINTS)) {
      typeScore = W_TYPE
      reasons.push('Classroom matches a lecture/class')
    } else if (isLabRoom) {
      typeScore = W_TYPE * 0.15
      reasons.push('Lecture in a lab room — typically flagged for review')
    } else {
      typeScore = W_TYPE * 0.5
      reasons.push('Usable for a class, but a classroom is preferred')
    }
  } else if (purpose === 'school_event' || purpose === 'community' || purpose === 'commercial') {
    typeScore = typeIncludes(typeName, EVENT_TYPE_HINTS) ? W_TYPE : W_TYPE * 0.55
    if (typeIncludes(typeName, EVENT_TYPE_HINTS)) reasons.push('Event-friendly venue')
  } else if (purpose === 'department_use') {
    typeScore = typeIncludes(typeName, [...MEETING_TYPE_HINTS, ...CLASSROOM_TYPE_HINTS]) ? W_TYPE : W_TYPE * 0.6
    if (typeIncludes(typeName, MEETING_TYPE_HINTS)) reasons.push('Meeting-friendly room')
  } else {
    typeScore = W_TYPE * 0.7 // personal / unknown — most rooms acceptable
  }

  // ── Specialization affinity (W_SPECIALIZATION) ───────────────────────────
  let specializationScore = 0
  if (tag && tag !== 'gym') {
    const courseCode = (fields.booking_course_code ?? '').toUpperCase()
    const itCourse = /IT|CS|COMP|ICT/.test(courseCode)
    if (tag === 'computer_use' && (itCourse || wantsLab)) {
      specializationScore = W_SPECIALIZATION
      reasons.push('Specialized lab matches your course/session')
    } else if ((tag === 'science_lab' || tag === 'av_studio') && wantsLab) {
      specializationScore = W_SPECIALIZATION * 0.8
      reasons.push('Specialized facility suits a lab/practical session')
    } else {
      specializationScore = W_SPECIALIZATION * 0.4
    }
  } else {
    specializationScore = W_SPECIALIZATION * 0.6 // general-purpose room — neutral-positive
  }

  // ── Availability (W_AVAILABILITY) ────────────────────────────────────────
  // Candidate rooms come from the availability-filtered list, so they are free.
  const availabilityScore = W_AVAILABILITY
  reasons.push('Available for your time slot')

  const rating = Math.round(
    Math.max(0, Math.min(100, capacityScore + typeScore + specializationScore + availabilityScore))
  )
  const stars = Math.max(1, Math.min(5, Math.round(rating / 20)))

  return {
    rating,
    stars,
    reasons,
    breakdown: {
      capacity: Math.round(capacityScore),
      type: Math.round(typeScore),
      specialization: Math.round(specializationScore),
      availability: Math.round(availabilityScore),
    },
  }
}
