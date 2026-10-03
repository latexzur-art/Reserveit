"use client"

import { ConnectedTopBar } from '../_components/ConnectedTopBar'
import { FacilityCatalog } from '@/components/shared/facilities/FacilityCatalog'

export default function ProgramFacilitiesPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40">
        <ConnectedTopBar title="Facilities" breadcrumbs={[{ label: 'Dashboard' }]} />
      </div>

      <main className="p-6 bg-background">
        <FacilityCatalog reserveBasePath="/program/form" />
      </main>
    </div>
  )
}
