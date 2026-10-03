import { cn } from '@/lib/utils'

export const SESSION_TYPE_CONFIG: Record<string, { label: string; full: string; color: string }> = {
    lecture: { label: 'LEC', full: 'Lecture', color: 'bg-ah-sti-cyan/10 text-ah-sti-cyan border-ah-sti-cyan/25' },
    lab: { label: 'LAB', full: 'Laboratory', color: 'bg-amber-500/10 text-amber-300 border-amber-500/25' },
}

// Renders the session-type badge. Unknown/null now shows a visible muted "—"
// instead of nothing, so a type-less row can't slip through review unnoticed.
export function SessionTypePill({ value }: { value: string | null }) {
    const cfg = value ? SESSION_TYPE_CONFIG[value] : null
    const fallback = { label: '—', full: 'No session type', color: 'bg-muted text-muted-foreground border-border' }
    const c = cfg ?? fallback
    return (
        <span
            title={c.full}
            className={cn('inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide', c.color)}
        >
            {c.label}
        </span>
    )
}
