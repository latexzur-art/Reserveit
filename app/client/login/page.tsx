"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { AuthService } from "@/backend/auth/auth.client"
import { cn } from "@/lib/utils"
import { ROUTES } from '@/lib/routes'

export default function ClientLoginPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sign in state
  const [signInEmail, setSignInEmail] = useState("")
  const [signInPassword, setSignInPassword] = useState("")

  // Sign up state
  const [fullName, setFullName] = useState("")
  const [signUpEmail, setSignUpEmail] = useState("")
  const [signUpPassword, setSignUpPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [agreeTerms, setAgreeTerms] = useState(false)

  const switchTab = (tab: "signin" | "signup") => {
    setActiveTab(tab)
    setError(null)
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await AuthService.signInWithEmail(signInEmail, signInPassword)
      if (!result.success) {
        setError(result.error || "Sign in failed. Please try again.")
        return
      }
      router.push(ROUTES.client.dashboard)
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!agreeTerms) {
      setError("Please agree to the Terms of Service and Privacy Policy.")
      return
    }
    if (signUpPassword !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    if (signUpPassword.length < 8) {
      setError("Password must be at least 8 characters long.")
      return
    }
    setLoading(true)
    try {
      const result = await AuthService.signUp({
        email: signUpEmail,
        password: signUpPassword,
        fullName,
      })
      if (!result.success) {
        setError(result.error || "Sign up failed. Please try again.")
        return
      }
      router.push("/auth/verify-email")
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setLoading(true)
    try {
      await AuthService.signInWithGoogle()
      // OAuth redirect — page will navigate away
    } catch {
      setError("Failed to sign in with Google. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="ReserveIT Logo" className="w-14 h-14 object-contain mx-auto mb-4" />
          <h1 className="text-foreground text-2xl font-bold">ReserveIT</h1>
          <p className="text-muted-foreground text-sm mt-1">STI College — Gymnasium Booking Portal</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
          {/* Tab Switcher */}
          <div className="p-6 pb-0">
            <div className="flex bg-muted rounded-lg p-1">
              <button
                onClick={() => switchTab("signin")}
                className={cn(
                  "flex-1 py-2.5 text-sm font-medium rounded-md transition-all duration-200",
                  activeTab === "signin"
                    ? "bg-accent-brand text-sti-navy dark:text-white font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Sign In
              </button>
              <button
                onClick={() => switchTab("signup")}
                className={cn(
                  "flex-1 py-2.5 text-sm font-medium rounded-md transition-all duration-200",
                  activeTab === "signup"
                    ? "bg-accent-brand text-sti-navy dark:text-white font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Sign Up
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Google Button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full bg-muted border-border text-foreground hover:bg-accent hover:text-foreground hover:border-ring/40 py-5"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              Continue with Google
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={16} />
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Sign In Form */}
            {activeTab === "signin" ? (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-foreground">Email Address</label>
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    value={signInEmail}
                    onChange={e => setSignInEmail(e.target.value)}
                    disabled={loading}
                    required
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground focus:border-ring"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-foreground">Password</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={signInPassword}
                      onChange={e => setSignInPassword(e.target.value)}
                      disabled={loading}
                      required
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground pr-10 focus:border-ring"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-accent-brand hover:opacity-90 text-sti-navy dark:text-white font-bold py-5"
                >
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</> : "Sign In"}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Don&apos;t have an account?{" "}
                  <button type="button" onClick={() => switchTab("signup")} className="text-accent-brand hover:opacity-80 font-medium">
                    Sign up
                  </button>
                </p>
              </form>
            ) : (
              /* Sign Up Form */
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-foreground">Full Name</label>
                  <Input
                    type="text"
                    placeholder="Juan dela Cruz"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    disabled={loading}
                    required
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground focus:border-ring"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-foreground">Email Address</label>
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    value={signUpEmail}
                    onChange={e => setSignUpEmail(e.target.value)}
                    disabled={loading}
                    required
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground focus:border-ring"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-foreground">Password</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 8 characters"
                      value={signUpPassword}
                      onChange={e => setSignUpPassword(e.target.value)}
                      disabled={loading}
                      required
                      minLength={8}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground pr-10 focus:border-ring"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-foreground">Confirm Password</label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Repeat your password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      required
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground pr-10 focus:border-ring"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="terms"
                    checked={agreeTerms}
                    onCheckedChange={checked => setAgreeTerms(checked as boolean)}
                    className="border-border data-[state=checked]:bg-accent-brand data-[state=checked]:border-accent-brand mt-0.5"
                  />
                  <label htmlFor="terms" className="text-sm text-foreground cursor-pointer">
                    I agree to the{" "}
                    <a href="#" className="text-accent-brand hover:opacity-80">Terms of Service</a>
                    {" "}and{" "}
                    <a href="#" className="text-accent-brand hover:opacity-80">Privacy Policy</a>
                  </label>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-accent-brand hover:opacity-90 text-sti-navy dark:text-white font-bold py-5"
                >
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</> : "Create Account"}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <button type="button" onClick={() => switchTab("signin")} className="text-accent-brand hover:opacity-80 font-medium">
                    Sign in
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          STI College · Gymnasium Reservation System
        </p>
      </div>
    </div>
  )
}
