// lib/supabase/logout.ts
import { createBrowserClient } from '@supabase/ssr'

export const handleLogout = async () => {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 1. Clear the Supabase Auth session
  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error("Error during logout:", error.message)
    // Even if there is an error, we force redirect to be safe
  }

  // 2. Clear local storage manually to ensure no 'ghost' data remains
  if (typeof window !== 'undefined') {
    localStorage.removeItem('sb-' + process.env.NEXT_PUBLIC_SUPABASE_URL + '-auth-token');
    
    // 3. Force full reload to /login
    // This ensures Middleware runs and blocks access to /admin
    window.location.href = "/login"
  }
}