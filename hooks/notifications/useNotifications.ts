'use client'

// Role-agnostic notifications hook. Backed by /api/notifications, which scopes
// rows by the authenticated user — safe to share across portals (client, faculty,
// program head, etc). The original `useFacultyNotifications` is kept as the
// implementation to avoid touching every dashboard at once.
export { useFacultyNotifications as useNotifications } from '@/hooks/faculty/useFacultyNotifications'
