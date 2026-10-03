'use client'

import { DataProvider } from '@/lib/data-store'
import { DashboardLayout } from '@/components/layout/admin/DashboardLayout'
import { AssistantMount } from '@/components/ai/AssistantMount'
import { Toaster } from 'sonner'

export default function BuildingAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <DashboardLayout>{children}</DashboardLayout>
      <AssistantMount />
      <Toaster position="top-right" richColors closeButton />
    </DataProvider>
  )
}
