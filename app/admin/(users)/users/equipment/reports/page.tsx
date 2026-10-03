'use client'

import { EscalatedReportsQueue } from '@/components/admin/equipment/EscalatedReportsQueue'

export default function ITReportsPage() {
  return (
    <EscalatedReportsQueue
      titleLead="Escalated Tech"
      titleAccent="Reports"
      subtitle="Tech equipment issues escalated to IT for handling."
    />
  )
}
