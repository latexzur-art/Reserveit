import { redirect } from 'next/navigation'

// The old page here was a 1,500-line in-memory prototype: Excel files were
// parsed client-side and every "save" only touched React state, so users could
// lose work believing it persisted. The wired pipeline lives at schedules/uploads.
export default function ScheduleManagementRedirect() {
  redirect('/program/schedules/uploads')
}
