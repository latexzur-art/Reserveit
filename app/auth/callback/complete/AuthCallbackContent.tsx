"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // This page is only reached if there's an error
    // Successful auth redirects directly from the server-side route handler
    const errorParam = searchParams.get("error")
    const errorDescription = searchParams.get("error_description")

    if (!errorParam) {
      setError("Authentication incomplete. Please try signing in again.")
      return
    }

    // Transparently retry transient OAuth errors (e.g. Azure code exchange failures)
    // sessionStorage persists across OAuth redirects within the same browser tab.
    // Gate on auth_flow=azure so non-Azure flows (email confirmation, Google) don't
    // get silently shipped into a Microsoft login they never asked for.
    if (errorParam === "server_error" || errorParam === "exchange_failed") {
      const isAzureFlow = sessionStorage.getItem("auth_flow") === "azure"
      const hasRetried = sessionStorage.getItem("auth_retry") === "1"

      if (isAzureFlow && !hasRetried) {
        // First failure of an Azure flow — silently re-initiate Microsoft sign-in
        sessionStorage.setItem("auth_retry", "1")
        window.location.href = "/api/auth/login/microsoft"
        return
      }

      // Either not an Azure flow, or the second consecutive failure — clear
      // flags and fall through to the normal error UI below.
      sessionStorage.removeItem("auth_retry")
      sessionStorage.removeItem("auth_flow")
    }

    setError(errorDescription || "Authentication failed. Please try again.")
  }, [searchParams])

  // On success path: clear any leftover flags
  useEffect(() => {
    return () => {
      // Cleanup on unmount (component only unmounts on successful navigation)
      sessionStorage.removeItem("auth_retry")
      sessionStorage.removeItem("auth_flow")
    }
  }, [])

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Authentication Error</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      </main>
    )
  }

  // Show loading — either initial load or while auto-retry OAuth redirect is in flight
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-foreground">Completing sign in...</h1>
        <p className="text-muted-foreground mt-2">Please wait while we verify your credentials.</p>
      </div>
    </main>
  )
}
