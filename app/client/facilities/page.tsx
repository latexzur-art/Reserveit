"use client"

import { ConnectedClientTopBar } from '../_components/ConnectedClientTopBar'
import { FacilityCatalog } from '@/components/shared/facilities/FacilityCatalog'
import { ROUTES } from '@/lib/routes'

export default function ClientFacilitiesPage() {
  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <ConnectedClientTopBar title="Browse Facilities" breadcrumbs={[{ label: 'Dashboard', href: ROUTES.client.dashboard }]} />

      <main className="p-4 sm:p-8 max-w-6xl mx-auto pb-24">
        <FacilityCatalog
          title="Browse Facilities"
          description="Explore available institutional spaces for rental or booking"
          reserveBasePath="/client/booking"
          buildReserveUrl={facility => `/client/booking?facility_id=${facility.id}`}
          rentalOnly
        />
      </main>
    </div>
  )
}
