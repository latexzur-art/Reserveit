import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import ChangePasswordContent from './ChangePasswordContent'

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-[#060f1e] flex items-center justify-center p-4">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-yellow-500 animate-spin mx-auto mb-4" />
        <p className="text-slate-400 text-sm">Loading...</p>
      </div>
    </div>
  )
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ChangePasswordContent />
    </Suspense>
  )
}
