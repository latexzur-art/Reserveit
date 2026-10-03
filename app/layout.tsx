import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ThemeProvider } from "next-themes"
import "./globals.css"
import { AuthProvider } from "@/contexts/AuthContext"
import { UIProvider } from "@/contexts/UIContext"
import { LocatorInit } from "@/components/LocatorInit"
import { SWRProvider } from "@/components/providers/SWRProvider"

import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "ReserveIT - STI College Lucena Facility Booking",
  description: "Streamline your facility management at STI College Lucena. Book and manage facilities easily.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <LocatorInit />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <UIProvider>
            <SWRProvider>
              <AuthProvider>
                {children}
                <Toaster />
                <SonnerToaster position="top-right" richColors closeButton />
              </AuthProvider>
            </SWRProvider>
          </UIProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
