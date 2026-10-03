'use client'

import { ThemeProvider } from 'next-themes'
import { UserManagerLayout } from '@/components/layout/user-manager/UserManagerLayout'
import { AssistantMount } from '@/components/ai/AssistantMount'

export default function UserManagerRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <UserManagerLayout>{children}</UserManagerLayout>
      <AssistantMount />
    </ThemeProvider>
  )
}
