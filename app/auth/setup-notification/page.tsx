"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Loader2, AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AuthService } from "@/backend/auth/auth.client"
import { getDefaultRoute } from "@/backend/auth/auth.utils"

export default function SetupNotificationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [initLoading, setInitLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notificationEmail, setNotificationEmail] = useState("")

  useEffect(() => {
    // Check if user is logged in
    AuthService.getCurrentUser().then(user => {
      if (!user) {
        router.push("/")
      } else if (user.notificationEmail) {
        // Already set
        const roles = user.roles.map(r => typeof r === 'string' ? r : r.name).filter(n => n !== 'external_client')
        router.push(getDefaultRoute(roles))
      } else {
        // Default to login email if external, though leaving it blank forces them to type it
        if (user.userType === 'external') {
           setNotificationEmail(user.email)
        }
        setInitLoading(false)
      }
    }).catch(() => {
      router.push("/")
    })
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    if (!notificationEmail) {
      setError("Please enter a valid email address.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/update-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationEmail }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to save email. Please try again.")
        setLoading(false)
        return
      }

      // Success, get updated user and redirect
      const user = await AuthService.getCurrentUser()
      if (user) {
        const roles = user.roles.map(r => typeof r === 'string' ? r : r.name).filter(n => n !== 'external_client')
        router.push(getDefaultRoute(roles))
      } else {
        router.push("/")
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
      setLoading(false)
    }
  }

  const handleSkip = async () => {
    setLoading(true)
    try {
      const user = await AuthService.getCurrentUser()
      if (user) {
        // Default to primary login email so user isn't stuck on future logins
        await fetch("/api/auth/update-profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationEmail: user.email }),
        })
        const roles = user.roles.map(r => typeof r === 'string' ? r : r.name).filter(n => n !== 'external_client')
        router.push(getDefaultRoute(roles))
      } else {
        router.push("/")
      }
    } catch {
      router.push("/")
    }
  }

  if (initLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-amber-600 dark:text-yellow-400 animate-spin" />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="ReserveIT Logo" width={56} height={56} className="w-14 h-14 object-contain mx-auto mb-4" />
          <h1 className="text-foreground text-2xl font-bold">Stay Updated</h1>
          <p className="text-muted-foreground text-sm mt-1">Where should we send your booking confirmations?</p>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl p-6">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2 mb-4">
              <AlertCircle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={16} />
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="notification_email" className="text-sm text-foreground">Notification Email</label>
              <Input
                id="notification_email"
                type="email"
                placeholder="name@example.com"
                value={notificationEmail}
                onChange={e => setNotificationEmail(e.target.value)}
                disabled={loading}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground focus:border-yellow-500"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This is where we&apos;ll send your booking reminders, approvals, and status updates. You can update this anytime in your profile settings.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-[#060f1e] font-bold py-5"
              >
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Continue"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                disabled={loading}
                onClick={handleSkip}
                className="w-full text-muted-foreground hover:text-foreground font-medium py-2 text-sm"
              >
                Add Later
              </Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
