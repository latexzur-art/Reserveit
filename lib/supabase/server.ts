/**
 * Supabase Server Configuration - Server-Side
 *
 * This file provides Supabase client initialization for server-side operations:
 * - API routes
 * - Server components
 * - Server actions
 * - Backend operations requiring elevated privileges
 *
 * @module lib/supabase/server
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Creates a Supabase client for server-side usage with cookie handling
 *
 * This client automatically manages authentication cookies and supports
 * both anon operations and admin operations (with service role key).
 *
 * @returns Supabase client instance for server-side operations
 *
 * @example
 * ```typescript
 * // In a Server Component
 * import { createClient } from '@/lib/supabase/server'
 *
 * export default async function FacilitiesPage() {
 *   const supabase = await createClient()
 *   const { data } = await supabase.from('facilities').select('*')
 *   return <div>{data?.map(f => f.name)}</div>
 * }
 * ```
 */
export async function createClient() {
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

  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}

/**
 * Creates a Supabase admin client with service role privileges
 *
 * ⚠️ WARNING: This client has FULL database access and bypasses RLS policies.
 * Only use for legitimate admin operations on the server-side.
 *
 * @returns Supabase client instance with admin privileges
 * @throws Error if service role key is not set
 *
 * @example
 * ```typescript
 * // In an API route for admin operations
 * import { createAdminClient } from '@/lib/supabase/server'
 *
 * export async function POST(request: Request) {
 *   const supabase = createAdminClient()
 *   // Perform admin operations...
 *   const { data, error } = await supabase
 *     .from('bookings')
 *     .update({ status: 'approved' })
 *     .eq('id', bookingId)
 *   return Response.json({ data, error })
 * }
 * ```
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is not set. Please check your .env.local file.'
    )
  }

  if (!supabaseServiceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Please check your .env.local file. ' +
        'This key should ONLY be used in server-side code!'
    )
  }

  return createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: {
      getAll() {
        return []
      },
      setAll() {
        // Admin client doesn't need to set cookies
      },
    },
  })
}
