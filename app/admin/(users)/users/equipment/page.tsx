'use client'

import { EquipmentManager } from '@/components/admin/equipment/EquipmentManager'

export default function ITEquipmentPage() {
  return (
    <EquipmentManager
      basePath="/api/admin/users/equipment"
      titleLead="Tech"
      titleAccent="Equipment"
      subtitle="IT-managed tech assets (TVs, monitors, computers, laptops, webcams)."
    />
  )
}
