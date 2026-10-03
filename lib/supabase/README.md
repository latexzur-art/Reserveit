# Supabase Client Configuration

This directory contains Supabase client initialization files for the ReserveIt application.

## Files Overview

### [client.ts](client.ts)
Browser/client-side Supabase client using the public anon key.
- **Use in**: Client components, browser-side hooks
- **Auth level**: User-level (RLS policies apply)
- **Safe to use**: In any client-side code

### [server.ts](server.ts)
Server-side Supabase clients with two variants:

1. **`createClient()`** - Standard server client
   - Uses anon key with cookie handling
   - **Use in**: Server components, API routes (user context)
   - **Auth level**: User-level (RLS policies apply)

2. **`createAdminClient()`** - Admin client with service role
   - ⚠️ **WARNING**: Bypasses all RLS policies
   - **Use ONLY for**: Administrative operations requiring elevated privileges
   - **Examples**: Batch operations, system maintenance, admin overrides

### [middleware.ts](middleware.ts)
Middleware helper for automatic session refresh.
- **Use in**: Root `middleware.ts` file
- **Purpose**: Keeps users logged in across page navigations

## Usage Examples

### Client Component
```typescript
'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function FacilitiesList() {
  const [facilities, setFacilities] = useState([])
  const supabase = createClient()

  useEffect(() => {
    const fetchFacilities = async () => {
      const { data } = await supabase.from('facilities').select('*')
      setFacilities(data || [])
    }
    fetchFacilities()
  }, [])

  return <div>{facilities.map(f => <div key={f.id}>{f.name}</div>)}</div>
}
```

### Server Component
```typescript
import { createClient } from '@/lib/supabase/server'

export default async function BookingsPage() {
  const supabase = await createClient()

  // This will respect RLS policies based on authenticated user
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div>
      {bookings?.map(booking => (
        <div key={booking.id}>{booking.reference_number}</div>
      ))}
    </div>
  )
}
```

### API Route (User Context)
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()

  // Get current authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Query respects user's RLS policies
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('user_id', user.id)

  return NextResponse.json({ data, error })
}
```

### API Route (Admin Operations)
```typescript
import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  // ⚠️ Ensure you've verified admin permissions before this!
  const supabase = createAdminClient()

  // This bypasses RLS and can access/modify any data
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'approved' })
    .eq('id', bookingId)

  return NextResponse.json({ data, error })
}
```

## Setup Requirements

1. **Install Supabase packages:**
   ```bash
   npm install @supabase/supabase-js @supabase/ssr
   ```

2. **Configure environment variables** in `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_key  # Server-side only!
   ```

3. **Add middleware** (optional but recommended):
   Create `middleware.ts` in project root:
   ```typescript
   import { updateSession } from '@/lib/supabase/middleware'

   export async function middleware(request: NextRequest) {
     return await updateSession(request)
   }

   export const config = {
     matcher: [
       '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
     ],
   }
   ```

## Security Best Practices

### ✅ DO
- Use `createClient()` for client-side and standard server operations
- Use `createAdminClient()` only when absolutely necessary
- Always verify user permissions before admin operations
- Keep service role key in server-side code only
- Use RLS policies as primary security layer

### ❌ DON'T
- Never expose service role key to client-side
- Don't use admin client for routine operations
- Don't skip permission checks before admin operations
- Don't commit `.env.local` to version control
- Don't bypass RLS without documented reason

## Troubleshooting

### "Environment variables not set" error
- Ensure `.env.local` exists and has correct values
- Restart development server after adding env vars
- Check variable names match exactly (case-sensitive)

### "User not found" or auth issues
- Verify middleware is properly configured
- Check if cookies are being set correctly
- Ensure user is logged in for protected operations

### RLS policy violations
- If using admin client, ensure it's intentional
- Check if user has required roles/permissions
- Review Supabase RLS policies in dashboard

## Resources

- [Supabase Next.js Docs](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase JS Client Reference](https://supabase.com/docs/reference/javascript)
- [ReserveIt Setup Guide](../../SUPABASE_SETUP.md)
- [Project Plan](../../plan.md)
