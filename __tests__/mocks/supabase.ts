import { vi } from 'vitest'

/**
 * Creates a mock Supabase client that supports chained query methods.
 * Override return values per-test using mockResolvedValueOnce on the terminal methods.
 */
export function createMockSupabaseClient() {
  const chainable = () => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      // Terminal methods that resolve the chain
      then: undefined, // make it thenable when awaited
    }

    // Make the chain itself thenable (resolves with { data, error, count })
    const defaultResult = { data: [], error: null, count: 0 }
    let resolveValue = defaultResult

    chain.mockResolvedValue = (val: any) => {
      resolveValue = val
      return chain
    }

    // Allow await on the chain directly
    chain.then = (resolve: any, reject: any) => {
      return Promise.resolve(resolveValue).then(resolve, reject)
    }

    return chain
  }

  const client = {
    from: vi.fn().mockImplementation(() => chainable()),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  }

  return client as any
}

/**
 * Helper to set up a mock Supabase `from` chain that returns specific data.
 * Usage:
 *   mockFromReturn(client, 'courses', { data: [...], error: null })
 */
export function mockFromReturn(
  client: ReturnType<typeof createMockSupabaseClient>,
  table: string,
  result: { data?: any; error?: any; count?: number }
) {
  const chain = createChainWithResult(result)
  client.from.mockImplementation((t: string) => {
    if (t === table) return chain
    // Default for other tables
    return createChainWithResult({ data: null, error: null })
  })
  return chain
}

function createChainWithResult(result: { data?: any; error?: any; count?: number }) {
  const resolvedResult = { data: result.data ?? null, error: result.error ?? null, count: result.count ?? 0 }

  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedResult),
    maybeSingle: vi.fn().mockResolvedValue(resolvedResult),
    then: (resolve: any, reject: any) => Promise.resolve(resolvedResult).then(resolve, reject),
  }

  return chain
}
