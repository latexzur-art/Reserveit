'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

interface ClientLayoutContextValue {
  mobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void
  toggleMobileMenu: () => void
}

const ClientLayoutContext = createContext<ClientLayoutContextValue | null>(null)

export const useClientLayout = () => {
  const ctx = useContext(ClientLayoutContext)
  if (!ctx) throw new Error('useClientLayout must be used within ClientLayoutProvider')
  return ctx
}

export const ClientLayoutProvider = ({ children }: { children: ReactNode }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <ClientLayoutContext.Provider value={{
      mobileMenuOpen,
      setMobileMenuOpen,
      toggleMobileMenu: () => setMobileMenuOpen(prev => !prev),
    }}>
      {children}
    </ClientLayoutContext.Provider>
  )
}