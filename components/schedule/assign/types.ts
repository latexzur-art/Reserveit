export type BlockSource = 'teaching' | 'booking' | 'proposed'

export interface BusyBlock {
  schedule_id?: string
  day_of_week: number
  start_time: string
  end_time: string
  label: string
  source: BlockSource
}

/** Sources that the approval RPC treats as a hard conflict (skips the item). */
export const HARD_CONFLICT_SOURCES: BlockSource[] = ['teaching']

export interface Subject {
  code: string
  name: string
}

export interface Faculty {
  id: string
  full_name: string
  employee_id: string | null
  department_id: string | null
  department_code: string | null
  department_name: string | null
  /** Distinct courses this professor currently teaches (active schedules). */
  subjects: Subject[]
  busy_blocks: BusyBlock[]
}

/** String-time overlap, identical to the server's timesOverlap. */
export function overlaps(s1: string, e1: string, s2: string, e2: string) {
  return s1 < e2 && e1 > s2
}

/**
 * The busy block (if any) that clashes with the given recurring slot.
 * `sources` restricts which block kinds count — pass HARD_CONFLICT_SOURCES to
 * predict exactly what the approval RPC will skip (it only checks teaching).
 */
export function clashingBlock(
  f: Faculty,
  dayOfWeek: number,
  start: string,
  end: string,
  sources?: BlockSource[],
  ignoreScheduleId?: string
): BusyBlock | null {
  return (
    f.busy_blocks.find(
      (b) =>
        b.day_of_week === dayOfWeek &&
        overlaps(start, end, b.start_time, b.end_time) &&
        (!sources || sources.includes(b.source)) &&
        (!ignoreScheduleId || b.schedule_id !== ignoreScheduleId)
    ) ?? null
  )
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function fmtTime(raw?: string | null): string {
  if (!raw) return '—'
  const [hStr, m = '00'] = raw.split(':')
  const h = parseInt(hStr, 10)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m} ${suffix}`
}

export function fmtSlot(dayOfWeek: number, start: string, end: string): string {
  return `${DAY_NAMES[dayOfWeek] ?? '?'} ${fmtTime(start)}–${fmtTime(end)}`
}

export const UNASSIGNED_NAME = 'TBD'
