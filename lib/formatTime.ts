export function formatTime(t?: string | null): string {
  if (!t) return ''
  const [hStr, mStr] = t.split(':')
  let h = parseInt(hStr, 10)
  if (isNaN(h)) return t
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  const m = mStr ? mStr.slice(0, 2) : '00'
  return `${h}:${m} ${ampm}`
}

