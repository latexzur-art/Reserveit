'use client'

import { EquipmentManager } from '@/components/admin/equipment/EquipmentManager'

export default function PamoEquipmentPage() {
  return (
    <EquipmentManager
      basePath="/api/admin/pamo/equipment"
      titleLead="Manage"
      titleAccent="Equipment"
      subtitle="Non-tech assets owned by PAMO."
    />
  )
}
