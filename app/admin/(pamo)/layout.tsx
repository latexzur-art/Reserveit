'use client'

import { ThemeProvider } from 'next-themes'
import { PamoLayout } from '@/components/layout/pamo/PamoLayout'
import { AssistantMount } from '@/components/ai/AssistantMount'

export default function PamoRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <PamoLayout>{children}</PamoLayout>
      <AssistantMount />
    </ThemeProvider>
  )
}
