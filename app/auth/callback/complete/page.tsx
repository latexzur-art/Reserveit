import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import AuthCallbackContent from "./AuthCallbackContent"

function LoadingFallback() {
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

export default function AuthCallbackCompletePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AuthCallbackContent />
    </Suspense>
  )
}
