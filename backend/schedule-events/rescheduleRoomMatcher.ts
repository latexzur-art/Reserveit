/**
 * Reschedule Room Matcher
 * Matches displaced class sessions to compatible alternative rooms.
 * Hard constraint: lab rooms must match by specialized_tag.
 * Soft constraint: lecture rooms prefer classrooms, then any non-lab.
 * @module backend/schedule-events/rescheduleRoomMatcher
 */

export interface RoomCandidate {
  id: string
  name: string
  room_number: string | null
  capacity: number | null
  facility_type_name: string | null
  specialized_tag: string | null
}

export interface MatchedRoom extends RoomCandidate {
  matchScore: number
}

export interface MatchResult {
  matches: MatchedRoom[]
  noMatchReason?: string
  canWiden?: boolean // true when strict matching failed but flexible pass could find rooms
}

interface MatchContext {
  session_type: 'lecture' | 'lab' | null
  flexible?: boolean // true = second pass, treat tagged rooms as soft constraint
  building_id?: string
  floor_number?: number
}

const LAB_TYPE_HINTS = ['lab', 'computer', 'clab', 'kitchen', 'studio', 'workshop']
const LAB_TAGS = new Set(['computer_use', 'science_lab', 'hospitality_lab', 'av_studio'])
const TAG_LABELS: Record<string, string> = {
  computer_use: 'Computer Lab',
  science_lab: 'Science Lab',
  hospitality_lab: 'Hospitality Lab',
  av_studio: 'AV Studio',
}

// Scoring weights — sum to 100
const W_CAPACITY = 40
const W_TYPE = 35
const W_BUILDING = 15
const W_FLOOR = 10

function isLabRoom(room: RoomCandidate): boolean {
  if (room.specialized_tag && LAB_TAGS.has(room.specialized_tag)) return true
  const typeName = (room.facility_type_name ?? '').toLowerCase()
  return LAB_TYPE_HINTS.some(h => typeName.includes(h))
}

function getEffectiveTag(room: RoomCandidate): string | null {
  if (room.specialized_tag) return room.specialized_tag
  // Infer tag from facility type name for rooms without explicit tags
  const typeName = (room.facility_type_name ?? '').toLowerCase()
  if (typeName.includes('computer') || typeName === 'computer_lab') return 'computer_use'
  if (typeName.includes('science') || typeName === 'science_lab') return 'science_lab'
  if (typeName.includes('hospitality') || typeName === 'hospitality_lab') return 'hospitality_lab'
  if (typeName.includes('studio')) return 'av_studio'
  return null
}

function scoreCapacity(candidateCapacity: number | null, originalCapacity: number): number {
  if (!candidateCapacity || candidateCapacity < originalCapacity) return 0
  if (candidateCapacity === originalCapacity) return W_CAPACITY
  const ratio = originalCapacity / candidateCapacity // 0..1, closer to1 = tighter
  if (ratio >= 0.8) return W_CAPACITY * 0.9
  if (ratio >= 0.5) return W_CAPACITY * 0.7
  if (ratio >= 0.3) return W_CAPACITY * 0.5
  return W_CAPACITY * 0.3
}

function scoreTypeMatch(candidate: RoomCandidate, isLab: boolean, sessionType: string | null, flexible: boolean): number {
  const candidateIsLab = isLabRoom(candidate)
  if (isLab && !flexible) {
    // Lab displaced, strict mode → must be same lab type (hard constraint already filtered)
    return W_TYPE
  }
  // Lecture or flexible → prefer classrooms
  const typeName = (candidate.facility_type_name ?? '').toLowerCase()
  if (typeName.includes('classroom') || typeName.includes('lecture')) return W_TYPE
  if (candidateIsLab) return 0 // should have been filtered
  return W_TYPE * 0.6 // conference, multipurpose, etc.
}

export function matchRescheduleRoom(
  original: RoomCandidate,
  candidates: RoomCandidate[],
  context: MatchContext,
): MatchResult {
  if (candidates.length === 0) {
    return { matches: [], noMatchReason: 'No available rooms at this time. Try a different date.' }
  }

  const originalTag = getEffectiveTag(original)
  const isLab = isLabRoom(original) || !!originalTag
  const originalCapacity = original.capacity ?? 0

  // In flexible mode: treat tagged rooms as soft constraint (any non-lab room works)
  const strictLab = isLab && originalTag && !context.flexible

  // Hard filter: tag must match for lab rooms (unless flexible)
  let filtered: RoomCandidate[]
  if (strictLab) {
    filtered = candidates.filter(c => {
      const cTag = getEffectiveTag(c)
      return cTag === originalTag
    })
  } else if (context.session_type === 'lecture' || context.flexible) {
    // Lecture or flexible: exclude all lab rooms
    filtered = candidates.filter(c => !isLabRoom(c))
  } else {
    filtered = [...candidates]
  }

  // Capacity filter
  if (originalCapacity > 0) {
    filtered = filtered.filter(c => (c.capacity ?? 0) >= originalCapacity)
  }

  if (filtered.length === 0) {
    if (isLab && originalTag && !context.flexible) {
      // Strict pass failed for a lab room — signal that flexible pass could work
      return {
        matches: [],
        noMatchReason: `No available ${TAG_LABELS[originalTag] ?? originalTag} rooms at this time.`,
        canWiden: true,
      }
    }
    const reason = isLab
      ? `No available ${originalTag ?? 'matching lab'} rooms at this time. Try a different date.`
      : 'No compatible rooms available. Try a different date.'
    return { matches: [], noMatchReason: reason }
  }

  // Score and sort
  const scored: MatchedRoom[] = filtered.map(c => {
    const capacityScore = scoreCapacity(c.capacity, originalCapacity)
    const typeScore = scoreTypeMatch(c, isLab, context.session_type, !!context.flexible)
    // ponytail: building/floor scoring omitted — original room context not passed yet.
    // Add when the caller provides original building_id + floor_number.
    const buildingScore = W_BUILDING * 0.5
    const floorScore = W_FLOOR * 0.5
    const matchScore = Math.round(capacityScore + typeScore + buildingScore + floorScore)
    return { ...c, matchScore }
  })

  scored.sort((a, b) => b.matchScore - a.matchScore)

  return { matches: scored }
}
