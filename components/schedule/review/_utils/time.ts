// 30-min slots from 07:00 to 21:00
export const TIME_SLOTS: string[] = (() => {
    const slots: string[] = []
    for (let min = 7 * 60; min <= 21 * 60; min += 30) {
        const h = Math.floor(min / 60)
        const m = min % 60
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
    return slots
})()

export function formatTimeDisplay(t: string) {
    const [h, m] = t.split(':').map(Number)
    const period = h >= 12 ? 'pm' : 'am'
    const h12 = h % 12 || 12
    return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

export function timeToMins(t: string) {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
}

export function formatDuration(startHHMM: string, endHHMM: string) {
    if (!startHHMM || !endHHMM) return ''
    const mins = timeToMins(endHHMM) - timeToMins(startHHMM)
    if (mins <= 0) return ''
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
}
