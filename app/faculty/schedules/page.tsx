"use client"

import { ConnectedTopBar } from '../_components/ConnectedTopBar'
import { MySchedulesView } from '@/components/shared/MySchedulesView'

export default function FacultyMySchedulesPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40">
        <ConnectedTopBar title="My Schedules" breadcrumbs={[{ label: 'Dashboard' }]} />
      </div>

      <main className="p-6">
        <MySchedulesView />
      </main>
    </div>
  )
}
