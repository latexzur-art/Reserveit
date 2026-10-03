'use client'

import { EscalatedReportsQueue } from '@/components/admin/equipment/EscalatedReportsQueue'

export default function PamoReportsPage() {
  return (
    <EscalatedReportsQueue
      titleLead="Escalated"
      titleAccent="Reports"
      subtitle="Non-tech equipment issues escalated to PAMO for handling."
    />
  )
}
