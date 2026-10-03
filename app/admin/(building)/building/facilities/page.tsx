"use client"

import { FacilityCatalog } from "@/components/shared/facilities/FacilityCatalog"

export default function BuildingAdminFacilitiesPage() {
  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="px-1">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
          Facility <span className="text-accent-brand">Brochure</span>
        </h1>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
          Browse rooms, specs, ratings, and active notices before booking
        </p>
      </div>
      <FacilityCatalog showReserveAction={false} />
    </div>
  )
}
