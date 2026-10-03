'use client'

import { EquipmentManager } from '@/components/admin/equipment/EquipmentManager'

export default function BuildingHvacPage() {
  return (
    <EquipmentManager
      basePath="/api/admin/building/hvac"
      titleLead="HVAC"
      titleAccent="Fixtures"
      subtitle="Building-owned HVAC units. Track working / under maintenance / broken status."
    />
  )
}
