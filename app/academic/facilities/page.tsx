"use client"

import { FacilityCatalog } from '@/components/shared/facilities/FacilityCatalog'

export default function AcademicFacilitiesPage() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <FacilityCatalog
        title="Facilities Directory"
        description="Browse rooms, laboratories, and specialized spaces across STI College Lucena."
        reserveBasePath="/academic/reserve"
      />
    </div>
  )
}

