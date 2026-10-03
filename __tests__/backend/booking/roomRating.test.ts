import { describe, it, expect } from 'vitest'
import { rateRoom, type RateableRoom } from '@/backend/booking/roomRating'

const classroom: RateableRoom = {
  id: 'c1', name: 'Lecture Room 3', facility_type_name: 'Classroom', capacity: 40, specialized_tag: null,
}
const computerLab: RateableRoom = {
  id: 'l1', name: 'Computer Lab 2', facility_type_name: 'Computer Lab', capacity: 40, specialized_tag: 'computer_use',
}

describe('rateRoom', () => {
  it('rates a well-fit classroom for a lecture highly', () => {
    const r = rateRoom(classroom, {
      booking_purpose: 'academic', expected_attendees: 30, session_type: 'lecture', booking_course_code: null,
    })
    expect(r.breakdown.capacity).toBe(40) // 30/40 = tight fit → full capacity points
    expect(r.breakdown.type).toBe(35) // classroom matches a lecture
    expect(r.rating).toBeGreaterThanOrEqual(80)
    expect(r.stars).toBeGreaterThanOrEqual(4)
  })

  it('rates a lab room highly for a lab session and matching course', () => {
    const r = rateRoom(computerLab, {
      booking_purpose: 'academic', expected_attendees: 25, session_type: 'lab', booking_course_code: 'BSIT',
    })
    expect(r.breakdown.type).toBe(35) // lab room matches a lab session
    expect(r.breakdown.specialization).toBe(15) // IT course + computer_use tag
    expect(r.rating).toBeGreaterThanOrEqual(90)
    expect(r.stars).toBe(5)
  })

  it('penalizes a lecture booked in a lab room', () => {
    const lecture = rateRoom(classroom, {
      booking_purpose: 'academic', expected_attendees: 30, session_type: 'lecture', booking_course_code: null,
    })
    const lectureInLab = rateRoom(computerLab, {
      booking_purpose: 'academic', expected_attendees: 30, session_type: 'lecture', booking_course_code: null,
    })
    expect(lectureInLab.breakdown.type).toBeLessThan(10) // strong type penalty
    expect(lectureInLab.rating).toBeLessThan(lecture.rating)
  })

  it('zeroes capacity and flags a room that is too small', () => {
    const tooSmall = rateRoom({ ...classroom, capacity: 10 }, {
      booking_purpose: 'academic', expected_attendees: 30, session_type: 'lecture', booking_course_code: null,
    })
    expect(tooSmall.breakdown.capacity).toBe(0)
    expect(tooSmall.reasons.some((x) => /too small/i.test(x))).toBe(true)
    const wellFit = rateRoom(classroom, {
      booking_purpose: 'academic', expected_attendees: 30, session_type: 'lecture', booking_course_code: null,
    })
    expect(tooSmall.rating).toBeLessThan(wellFit.rating)
  })

  it('handles unknown headcount without crashing and stays mid-range', () => {
    const r = rateRoom(classroom, {
      booking_purpose: 'academic', expected_attendees: null, session_type: 'lecture', booking_course_code: null,
    })
    expect(r.rating).toBeGreaterThan(0)
    expect(r.rating).toBeLessThanOrEqual(100)
    expect(r.stars).toBeGreaterThanOrEqual(1)
    expect(r.stars).toBeLessThanOrEqual(5)
  })
})
