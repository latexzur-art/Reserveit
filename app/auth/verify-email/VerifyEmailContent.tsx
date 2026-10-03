"use client"

import { useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Mail, Loader2, CheckCircle2, XCircle } from "lucide-react"

type State =
  | { status: "idle" }
  | { status: "verifying" }
  | { status: "success" }
  | { status: "error"; message: string }

export default function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type")

  const [state, setState] = useState<State>({ status: "idle" })

  // No token in URL → user landed here from the post-signup "check your email" redirect
  if (!tokenHash || !type) {
    return <CheckYourEmailMessage />
  }

  async function handleConfirm() {
    setState({ status: "verifying" })

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token_hash: tokenHash, type }),
      })
      const data = await res.json()

      if (!res.ok) {
        setState({ status: "error", message: data.error || "Verification failed" })
        return
      }

      setState({ status: "success" })
      router.push(data.redirect || "/client/dashboard")
    } catch {
      setState({ status: "error", message: "Network error. Please try again." })
    }
  }

  if (state.status === "success") {
    return (
      <Shell icon={<CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />} iconBg="bg-emerald-500/10 border-emerald-500/30">
        <h1 className="text-foreground text-2xl font-bold mb-3">Email verified</h1>
        <p className="text-muted-foreground text-sm mb-2">Redirecting you to your dashboard...</p>
      </Shell>
    )
  }

  if (state.status === "error") {
    return (
      <Shell icon={<XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />} iconBg="bg-destructive/10 border-destructive/30">
        <h1 className="text-foreground text-2xl font-bold mb-3">Verification failed</h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-8">{state.message}</p>
        <Link
          href="/client/login"
          className="inline-block px-6 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-[#060f1e] font-semibold text-sm rounded-lg transition-colors"
        >
          Back to Sign In
        </Link>
      </Shell>
    )
  }

  return (
    <Shell icon={<Mail className="w-8 h-8 text-amber-600 dark:text-yellow-400" />} iconBg="bg-yellow-500/10 border-yellow-500/30">
      <h1 className="text-foreground text-2xl font-bold mb-3">Confirm your email</h1>
      <p className="text-muted-foreground text-sm leading-relaxed mb-8">
        Click the button below to verify your email address and activate your ReserveIT account.
      </p>
      <button
        onClick={handleConfirm}
        disabled={state.status === "verifying"}
        className="inline-flex items-center gap-2 px-6 py-2.5 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-60 disabled:cursor-not-allowed text-[#060f1e] font-semibold text-sm rounded-lg transition-colors"
      >
        {state.status === "verifying" ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Verifying...
          </>
        ) : (
          "Confirm Email"
        )}
      </button>
    </Shell>
  )
}

function Shell({
  icon,
  iconBg,
  children,
}: {
  icon: React.ReactNode
  iconBg: string
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className={`w-16 h-16 ${iconBg} border rounded-full flex items-center justify-center mx-auto mb-6`}>
          {icon}
        </div>
        {children}
      </div>
    </main>
  )
}

function CheckYourEmailMessage() {
  return (
    <Shell icon={<Mail className="w-8 h-8 text-amber-600 dark:text-yellow-400" />} iconBg="bg-yellow-500/10 border-yellow-500/30">
      <h1 className="text-foreground text-2xl font-bold mb-3">Check your email</h1>
      <p className="text-muted-foreground text-sm leading-relaxed mb-8">
        We sent a verification link to your email address. Click the link in the email to activate your account and start booking.
      </p>
      <p className="text-muted-foreground text-xs mb-6">
        Didn&apos;t receive the email? Check your spam folder, or{" "}
        <Link href="/client/login" className="text-amber-600 hover:text-amber-700 dark:text-yellow-500 dark:hover:text-yellow-400">
          go back and try again
        </Link>
        .
      </p>
      <Link
        href="/client/login"
        className="inline-block px-6 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-[#060f1e] font-semibold text-sm rounded-lg transition-colors"
      >
        Back to Sign In
      </Link>
    </Shell>
  )
}
