"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { AuthService } from "@/backend/auth/auth.client"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  defaultTab?: "signin" | "signup"
}

const AuthModal = ({ isOpen, onClose, defaultTab = "signin" }: AuthModalProps) => {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"signin" | "signup">(defaultTab)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sign In form state
  const [signInEmail, setSignInEmail] = useState("")
  const [signInPassword, setSignInPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)

  // Sign Up form state
  const [fullName, setFullName] = useState("")
  const [signUpEmail, setSignUpEmail] = useState("")
  const [signUpPassword, setSignUpPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [agreeTerms, setAgreeTerms] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab)
    }
  }, [isOpen, defaultTab])

  const resetForm = () => {
    setSignInEmail("")
    setSignInPassword("")
    setRememberMe(false)
    setFullName("")
    setSignUpEmail("")
    setSignUpPassword("")
    setConfirmPassword("")
    setAgreeTerms(false)
    setError(null)
    setLoading(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await AuthService.signInWithEmail(signInEmail, signInPassword)

      if (!result.success) {
        setError(result.error || "Sign in failed. Please try again.")
        setLoading(false)
        return
      }

      // Success - redirect to dashboard or specified route
      handleClose()
      if (result.redirectTo) {
        router.push(result.redirectTo)
      } else {
        router.push("/dashboard")
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
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
        fullName: fullName,
      })

      if (!result.success) {
        setError(result.error || "Sign up failed. Please try again.")
        setLoading(false)
        return
      }

      // Success - show verification message or redirect
      handleClose()
      if (result.redirectTo) {
        router.push(result.redirectTo)
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setLoading(true)

    try {
      await AuthService.signInWithGoogle()
      // OAuth will redirect, no need to close modal
    } catch (err) {
      setError("Failed to sign in with Google. Please try again.")
      setLoading(false)
    }
  }

  const handleMicrosoftSignIn = async () => {
    setError(null)
    setLoading(true)

    try {
      await AuthService.signInWithMicrosoft()
      // OAuth will redirect, no need to close modal
    } catch (err) {
      setError("Failed to sign in with Microsoft. Please try again.")
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 bg-[#0c1929] border-[#1c2d4a] overflow-hidden">
        <DialogTitle className="sr-only">
          {activeTab === "signin" ? "Sign In" : "Create Account"}
        </DialogTitle>

        {/* Header */}
        <div className="pt-8 pb-4 text-center">
          <h2 className="text-2xl font-bold text-white">
            {activeTab === "signin" ? "Welcome back" : "Create account"}
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            {activeTab === "signin"
              ? "Enter your credentials to continue"
              : "Get started with your account"}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="px-8 pb-6">
          <div className="flex bg-[#1c2d4a] rounded-lg p-1">
            <button
              onClick={() => {
                setActiveTab("signin")
                setError(null)
              }}
              className={cn(
                "flex-1 py-2.5 text-sm font-medium rounded-md transition-all duration-200",
                activeTab === "signin"
                  ? "bg-yellow-500 text-sti-navy font-bold"
                  : "text-slate-400 hover:text-white"
              )}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setActiveTab("signup")
                setError(null)
              }}
              className={cn(
                "flex-1 py-2.5 text-sm font-medium rounded-md transition-all duration-200",
                activeTab === "signup"
                  ? "bg-yellow-500 text-sti-navy font-bold"
                  : "text-slate-400 hover:text-white"
              )}
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-8 mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
            <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={16} />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Form Content */}
        <div className="px-8 pb-8">
          {activeTab === "signin" ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm text-slate-300">Email Address</label>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  disabled={loading}
                  required
                  className="bg-[#1c2d4a] border-[#2a3f5f] text-white placeholder:text-slate-500 focus:border-yellow-500 focus:ring-yellow-500/50"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="text-sm text-slate-300">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    disabled={loading}
                    required
                    className="bg-[#1c2d4a] border-[#2a3f5f] text-white placeholder:text-slate-500 pr-10 focus:border-yellow-500 focus:ring-yellow-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    className="border-slate-500 data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500 data-[state=checked]:text-sti-navy"
                  />
                  <label htmlFor="remember" className="text-sm text-slate-300 cursor-pointer">
                    Remember me
                  </label>
                </div>
                <a href="#" className="text-sm text-yellow-500 hover:text-yellow-400 transition-colors">
                  Forgot password?
                </a>
              </div>

              {/* Sign In Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-sti-navy font-bold py-5"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#2a3f5f]"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#0c1929] px-2 text-slate-500">Or continue with</span>
                </div>
              </div>

              {/* Social Logins */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="bg-[#1c2d4a] border-[#2a3f5f] text-white hover:bg-[#2a3f5f] hover:text-white hover:border-white/20"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleMicrosoftSignIn}
                  disabled={loading}
                  className="bg-[#1c2d4a] border-[#2a3f5f] text-white hover:bg-[#2a3f5f] hover:text-white hover:border-white/20"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#F25022" d="M1 1h10v10H1z" />
                    <path fill="#00A4EF" d="M1 13h10v10H1z" />
                    <path fill="#7FBA00" d="M13 1h10v10H13z" />
                    <path fill="#FFB900" d="M13 13h10v10H13z" />
                  </svg>
                  Microsoft
                </Button>
              </div>

              {/* Sign Up Link */}
              <p className="text-center text-sm text-slate-400 mt-6">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("signup")
                    setError(null)
                  }}
                  className="text-yellow-500 hover:text-yellow-400 font-medium transition-colors"
                >
                  Sign up
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-2">
                <label className="text-sm text-slate-300">Full Name</label>
                <Input
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                  required
                  className="bg-[#1c2d4a] border-[#2a3f5f] text-white placeholder:text-slate-500 focus:border-yellow-500 focus:ring-yellow-500/50"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm text-slate-300">Email Address</label>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  disabled={loading}
                  required
                  className="bg-[#1c2d4a] border-[#2a3f5f] text-white placeholder:text-slate-500 focus:border-yellow-500 focus:ring-yellow-500/50"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="text-sm text-slate-300">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    disabled={loading}
                    required
                    minLength={8}
                    className="bg-[#1c2d4a] border-[#2a3f5f] text-white placeholder:text-slate-500 pr-10 focus:border-yellow-500 focus:ring-yellow-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="text-sm text-slate-300">Confirm Password</label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    required
                    className="bg-[#1c2d4a] border-[#2a3f5f] text-white placeholder:text-slate-500 pr-10 focus:border-yellow-500 focus:ring-yellow-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Terms Agreement */}
              <div className="flex items-start gap-2">
                <Checkbox
                  id="terms"
                  checked={agreeTerms}
                  onCheckedChange={(checked) => setAgreeTerms(checked as boolean)}
                  className="border-slate-500 data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500 data-[state=checked]:text-sti-navy mt-0.5"
                />
                <label htmlFor="terms" className="text-sm text-slate-300 cursor-pointer">
                  I agree to the{" "}
                  <a href="#" className="text-yellow-500 hover:text-yellow-400">Terms of Service</a>
                  {" "}and{" "}
                  <a href="#" className="text-yellow-500 hover:text-yellow-400">Privacy Policy</a>
                </label>
              </div>

              {/* Create Account Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-sti-navy font-bold py-5"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>

              {/* Sign In Link */}
              <p className="text-center text-sm text-slate-400 mt-6">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("signin")
                    setError(null)
                  }}
                  className="text-yellow-500 hover:text-yellow-400 font-medium transition-colors"
                >
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AuthModal
