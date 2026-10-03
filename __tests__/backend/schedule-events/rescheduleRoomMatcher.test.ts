import { describe, it, expect } from 'vitest'
import { matchRescheduleRoom, type RoomCandidate } from '@/backend/schedule-events/rescheduleRoomMatcher'

const makeRoom = (overrides: Partial<RoomCandidate> = {}): RoomCandidate => ({
  id: 'r1',
  name: 'Room 101',
  room_number: '101',
  capacity: 40,
  facility_type_name: 'classroom',
  specialized_tag: null,
  ...overrides,
})

describe('matchRescheduleRoom', () => {
  describe('hard constraints — lab rooms must match lab type', () => {
    it('computer lab displaced → only computer labs accepted', () => {
      const original = makeRoom({ facility_type_name: 'computer_lab', specialized_tag: 'computer_use' })
      const candidates = [
        makeRoom({ id: 'c1', facility_type_name: 'computer_lab', specialized_tag: 'computer_use' }),
        makeRoom({ id: 'c2', facility_type_name: 'classroom', specialized_tag: null }),
        makeRoom({ id: 'c3', facility_type_name: 'science_lab', specialized_tag: 'science_lab' }),
      ]
      const result = matchRescheduleRoom(original, candidates, { session_type: 'lab' })
      expect(result.matches.map(r => r.id)).toEqual(['c1'])
    })

    it('science lab displaced → only science labs accepted', () => {
      const original = makeRoom({ facility_type_name: 'science_lab', specialized_tag: 'science_lab' })
      const candidates = [
        makeRoom({ id: 's1', facility_type_name: 'science_lab', specialized_tag: 'science_lab' }),
        makeRoom({ id: 'c1', facility_type_name: 'computer_lab', specialized_tag: 'computer_use' }),
        makeRoom({ id: 'r1', facility_type_name: 'classroom', specialized_tag: null }),
      ]
      const result = matchRescheduleRoom(original, candidates, { session_type: 'lab' })
      expect(result.matches.map(r => r.id)).toEqual(['s1'])
    })

    it('hospitality lab displaced → only hospitality labs accepted', () => {
      const original = makeRoom({ facility_type_name: 'hospitality_lab', specialized_tag: 'hospitality_lab' })
      const candidates = [
        makeRoom({ id: 'h1', facility_type_name: 'hospitality_lab', specialized_tag: 'hospitality_lab' }),
        makeRoom({ id: 'c1', facility_type_name: 'computer_lab', specialized_tag: 'computer_use' }),
        makeRoom({ id: 'r1', facility_type_name: 'classroom', specialized_tag: null }),
      ]
      const result = matchRescheduleRoom(original, candidates, { session_type: 'lab' })
      expect(result.matches.map(r => r.id)).toEqual(['h1'])
    })

    it('AV studio displaced → only AV studios accepted (not computer labs)', () => {
      const original = makeRoom({ facility_type_name: 'studio', specialized_tag: 'av_studio' })
      const candidates = [
        makeRoom({ id: 's1', facility_type_name: 'studio', specialized_tag: 'av_studio' }),
        makeRoom({ id: 'c1', facility_type_name: 'computer_lab', specialized_tag: 'computer_use' }),
        makeRoom({ id: 'r1', facility_type_name: 'classroom', specialized_tag: null }),
      ]
      const result = matchRescheduleRoom(original, candidates, { session_type: 'lab' })
      expect(result.matches.map(r => r.id)).toEqual(['s1'])
    })

    it('computer lab displaced → does NOT accept AV studio', () => {
      const original = makeRoom({ facility_type_name: 'computer_lab', specialized_tag: 'computer_use' })
      const candidates = [
        makeRoom({ id: 's1', facility_type_name: 'studio', specialized_tag: 'av_studio' }),
        makeRoom({ id: 'c1', facility_type_name: 'computer_lab', specialized_tag: 'computer_use' }),
      ]
      const result = matchRescheduleRoom(original, candidates, { session_type: 'lab' })
      expect(result.matches.map(r => r.id)).toEqual(['c1'])
    })
  })

  describe('soft constraints — lecture rooms prefer classrooms', () => {
    it('lecture room displaced → classrooms preferred, other non-lab rooms accepted', () => {
      const original = makeRoom({ facility_type_name: 'classroom', specialized_tag: null })
      const candidates = [
        makeRoom({ id: 'c1', facility_type_name: 'classroom', specialized_tag: null, capacity: 40 }),
        makeRoom({ id: 'c2', facility_type_name: 'conference_room', specialized_tag: null, capacity: 40 }),
        makeRoom({ id: 'l1', facility_type_name: 'computer_lab', specialized_tag: 'computer_use', capacity: 40 }),
      ]
      const result = matchRescheduleRoom(original, candidates, { session_type: 'lecture' })
      // classrooms ranked higher than conference, labs excluded for lectures
      expect(result.matches.map(r => r.id)).toEqual(['c1', 'c2'])
    })

    it('lecture room displaced → labs excluded even if available', () => {
      const original = makeRoom({ facility_type_name: 'classroom', specialized_tag: null })
      const candidates = [
        makeRoom({ id: 'l1', facility_type_name: 'computer_lab', specialized_tag: 'computer_use' }),
        makeRoom({ id: 'l2', facility_type_name: 'science_lab', specialized_tag: 'science_lab' }),
      ]
      const result = matchRescheduleRoom(original, candidates, { session_type: 'lecture' })
      expect(result.matches).toHaveLength(0)
      expect(result.noMatchReason).toContain('No compatible rooms')
    })
  })

  describe('no matches available', () => {
    it('returns noMatchReason when no candidates match', () => {
      const original = makeRoom({ facility_type_name: 'computer_lab', specialized_tag: 'computer_use' })
      const candidates = [
        makeRoom({ id: 'r1', facility_type_name: 'classroom', specialized_tag: null }),
      ]
      const result = matchRescheduleRoom(original, candidates, { session_type: 'lab' })
      expect(result.matches).toHaveLength(0)
      expect(result.noMatchReason).toBeTruthy()
    })

    it('returns empty when candidates list is empty', () => {
      const original = makeRoom({ facility_type_name: 'classroom', specialized_tag: null })
      const result = matchRescheduleRoom(original, [], { session_type: 'lecture' })
      expect(result.matches).toHaveLength(0)
      expect(result.noMatchReason).toContain('No available rooms')
    })
  })

  describe('capacity filtering', () => {
    it('excludes rooms smaller than original', () => {
      const original = makeRoom({ capacity: 40 })
      const candidates = [
        makeRoom({ id: 'big', capacity: 50 }),
        makeRoom({ id: 'same', capacity: 40 }),
        makeRoom({ id: 'small', capacity: 30 }),
      ]
      const result = matchRescheduleRoom(original, candidates, { session_type: 'lecture' })
      expect(result.matches.map(r => r.id)).toEqual(['same', 'big'])
    })
  })

  describe('scoring — prefers closer capacity fit', () => {
    it('ranks rooms by capacity proximity to original', () => {
      const original = makeRoom({ capacity: 40, facility_type_name: 'classroom', specialized_tag: null })
      const candidates = [
        makeRoom({ id: 'tight', capacity: 40, facility_type_name: 'classroom' }),
        makeRoom({ id: 'big', capacity: 80, facility_type_name: 'classroom' }),
        makeRoom({ id: 'medium', capacity: 50, facility_type_name: 'classroom' }),
      ]
      const result = matchRescheduleRoom(original, candidates, { session_type: 'lecture' })
      expect(result.matches[0].id).toBe('tight')
      expect(result.matches[1].id).toBe('medium')
      expect(result.matches[2].id).toBe('big')
    })

    it('each match includes a numeric score', () => {
      const original = makeRoom({ capacity: 40, facility_type_name: 'classroom', specialized_tag: null })
      const candidates = [
        makeRoom({ id: 'c1', capacity: 40, facility_type_name: 'classroom' }),
      ]
      const result = matchRescheduleRoom(original, candidates, { session_type: 'lecture' })
      expect(result.matches[0].matchScore).toBeGreaterThan(0)
      expect(result.matches[0].matchScore).toBeLessThanOrEqual(100)
    })
  })

  describe('edge cases', () => {
    it('original room has no specialized_tag but has lab type name → treats as lab', () => {
      const original = makeRoom({ facility_type_name: 'computer_lab', specialized_tag: null })
      const candidates = [
        makeRoom({ id: 'lab', facility_type_name: 'computer_lab', specialized_tag: 'computer_use' }),
        makeRoom({ id: 'class', facility_type_name: 'classroom', specialized_tag: null }),
      ]
      const result = matchRescheduleRoom(original, candidates, { session_type: 'lab' })
      expect(result.matches.map(r => r.id)).toEqual(['lab'])
    })

    it('handles null facility_type_name gracefully', () => {
      const original = makeRoom({ facility_type_name: null, specialized_tag: null })
      const candidates = [makeRoom({ id: 'r1', facility_type_name: 'classroom' })]
      const result = matchRescheduleRoom(original, candidates, { session_type: 'lecture' })
      expect(result.matches.map(r => r.id)).toEqual(['r1'])
    })
  })

  describe('two-pass flexible matching', () => {
    it('strict pass fails for studio → returns canWiden=true', () => {
      const original = makeRoom({ facility_type_name: 'studio', specialized_tag: 'av_studio' })
      const candidates = [
        makeRoom({ id: 'c1', facility_type_name: 'classroom', specialized_tag: null, capacity: 40 }),
      ]
      const result = matchRescheduleRoom(original, candidates, { session_type: 'lab' })
      expect(result.matches).toHaveLength(0)
      expect(result.canWiden).toBe(true)
    })

    it('flexible pass for studio → returns classrooms as alternatives', () => {
      const original = makeRoom({ facility_type_name: 'studio', specialized_tag: 'av_studio', capacity: 30 })
      const candidates = [
        makeRoom({ id: 'c1', facility_type_name: 'classroom', specialized_tag: null, capacity: 40 }),
        makeRoom({ id: 'c2', facility_type_name: 'conference_room', specialized_tag: null, capacity: 30 }),
        makeRoom({ id: 'l1', facility_type_name: 'computer_lab', specialized_tag: 'computer_use', capacity: 40 }),
      ]
      const result = matchRescheduleRoom(original, candidates, { session_type: 'lecture', flexible: true })
      // labs excluded even in flexible mode, classrooms + conference accepted
      expect(result.matches.map(r => r.id)).toEqual(['c1', 'c2'])
      expect(result.canWiden).toBeUndefined()
    })

    it('strict pass for computer lab fails → canWiden=true, flexible pass returns classrooms', () => {
      const original = makeRoom({ facility_type_name: 'computer_lab', specialized_tag: 'computer_use', capacity: 30 })
      const candidates = [
        makeRoom({ id: 'c1', facility_type_name: 'classroom', specialized_tag: null, capacity: 40 }),
      ]
      // Strict pass
      const strict = matchRescheduleRoom(original, candidates, { session_type: 'lab' })
      expect(strict.matches).toHaveLength(0)
      expect(strict.canWiden).toBe(true)

      // Flexible pass
      const flex = matchRescheduleRoom(original, candidates, { session_type: 'lecture', flexible: true })
      expect(flex.matches.map(r => r.id)).toEqual(['c1'])
    })
  })
})
