"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import type { AuthUser } from "@/backend/auth/auth.types"
import AuthModal from "@/components/auth/AuthModal"

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  authError: string | null
  isAuthenticated: boolean
  openAuthModal: (tab?: "signin" | "signup") => void
  closeAuthModal: () => void
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const router = useRouter()
  const [authError, setAuthError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [defaultTab, setDefaultTab] = useState<"signin" | "signup">("signin")

  const { data, isLoading, mutate } = useSWR<{ user: AuthUser | null }>('/api/auth/me', {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })

  const user = data?.user ?? null
  const loading = isLoading

  useEffect(() => {
    if (
      user &&
      user.mustChangePassword &&
      typeof window !== 'undefined' &&
      window.location.pathname !== '/auth/change-password'
    ) {
      router.push('/auth/change-password')
    }
  }, [user, router])

  const refreshUser = useCallback(async () => {
    await mutate()
  }, [mutate])

  const openAuthModal = (tab: "signin" | "signup" = "signin") => {
    setDefaultTab(tab)
    setIsModalOpen(true)
  }

  const closeAuthModal = () => {
    setIsModalOpen(false)
  }

  const signOut = async () => {
    try {
      const response = await fetch('/api/auth/signout', { method: 'POST' })
      if (!response.ok) {
        const message = `Sign out failed (${response.status})`
        console.error(message)
        setAuthError(message)
        return
      }
      await mutate({ user: null }, false)
      setAuthError(null)
      window.location.href = '/'
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sign out'
      console.error("Failed to sign out:", error)
      setAuthError(message)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        isAuthenticated: !!user,
        openAuthModal,
        closeAuthModal,
        signOut,
        refreshUser,
      }}
    >
      {children}
      <AuthModal
        isOpen={isModalOpen}
        onClose={closeAuthModal}
        defaultTab={defaultTab}
      />
    </AuthContext.Provider>
  )
}
