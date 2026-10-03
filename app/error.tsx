'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-yellow-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Something went wrong</h1>
        <p className="text-gray-600 mb-8">
          An unexpected error occurred. Try refreshing the page or return to the dashboard.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Try again
          </Button>
          <Button onClick={() => window.location.href = '/'} className="flex items-center gap-2">
            <Home className="w-4 h-4" /> Go home
          </Button>
        </div>
        {error.digest && (
          <p className="text-xs text-gray-400 mt-6">Error ID: {error.digest}</p>
        )}
      </div>
    </div>
  )
}
