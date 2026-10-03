'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

interface FacultyLayoutContextValue {
  mobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void
  toggleMobileMenu: () => void
}

const FacultyLayoutContext = createContext<FacultyLayoutContextValue | null>(null)

export const useFacultyLayout = () => {
  const ctx = useContext(FacultyLayoutContext)
  if (!ctx) throw new Error('useFacultyLayout must be used within FacultyLayoutProvider')
  return ctx
}

export const FacultyLayoutProvider = ({ children }: { children: ReactNode }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <FacultyLayoutContext.Provider value={{
      mobileMenuOpen,
      setMobileMenuOpen,
      toggleMobileMenu: () => setMobileMenuOpen(prev => !prev),
    }}>
      {children}
    </FacultyLayoutContext.Provider>
  )
}
