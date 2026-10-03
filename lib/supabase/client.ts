/**
 * Supabase Client Configuration - Client-Side
 *
 * This file initializes the Supabase client for use in browser/client-side code.
 * Uses the public anon key which is safe to expose in client-side code.
 *
 * @module lib/supabase/client
 * @see https://supabase.com/docs/reference/javascript/initializing
 */

import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates a Supabase client for browser/client-side usage
 *
 * @returns Supabase client instance with anon key
 * @throws Error if environment variables are not set
 *
 * @example
 * ```typescript
 * import { createClient } from '@/lib/supabase/client'
 *
 * const supabase = createClient()
 * const { data, error } = await supabase.from('facilities').select('*')
 * ```
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is not set. Please check your .env.local file.'
    )
  }

  if (!supabaseAnonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Please check your .env.local file.'
    )
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
