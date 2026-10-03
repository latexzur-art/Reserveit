import { useEffect, useRef } from 'react'

/**
 * Re-runs `callback` when the tab regains focus/visibility, so pages with
 * no realtime subscription pick up changes made elsewhere (another tab,
 * another role) without requiring a manual reload.
 */
export function useRefetchOnFocus(callback: () => void, enabled = true) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return

    const handler = () => {
      if (document.visibilityState === 'visible') callbackRef.current()
    }

    window.addEventListener('focus', handler)
    document.addEventListener('visibilitychange', handler)
    return () => {
      window.removeEventListener('focus', handler)
      document.removeEventListener('visibilitychange', handler)
    }
  }, [enabled])
}
