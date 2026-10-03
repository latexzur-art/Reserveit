/**
 * Error extraction utilities for API routes.
 *
 * Supabase error objects (from non-throwing client calls) are plain objects
 * with { message, code, details, hint } — they do NOT extend JavaScript's
 * Error class. These helpers handle all thrown value types consistently.
 */

/**
 * Extracts a human-readable error message from any thrown value.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  if (typeof err === 'string') return err
  return 'Unknown error'
}

/**
 * Extracts full diagnostic info for server-side logging.
 * Includes Supabase-specific fields (code, details, hint) when present.
 */
export function getErrorDetails(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack, name: err.name }
  }
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>
    return {
      message: obj.message,
      code: obj.code,
      details: obj.details,
      hint: obj.hint,
    }
  }
  return { raw: String(err) }
}

/**
 * Sanitizes a Supabase/Postgres error for client-facing responses.
 * Strips constraint names, table names, and column names to prevent
 * database schema leakage. Logs the full error server-side.
 */
export function sanitizeDbError(
  err: unknown
): string {
  const raw = getErrorMessage(err)
  console.error('[sanitizeDbError] Original error:', getErrorDetails(err))

  // Map known Postgres error codes to safe messages
  const code = typeof err === 'object' && err !== null ? (err as Record<string, unknown>).code : undefined
  if (code === '23505') return 'A record with this information already exists.'
  if (code === '23503') return 'Referenced record not found.'
  if (code === '23502') return 'A required field is missing.'
  if (code === '42P01') return 'Internal server error.'
  if (code === '42501') return 'Permission denied.'

  // Strip any constraint/table name patterns from the message
  if (raw.includes('violates') || raw.includes('constraint') || raw.includes('relation')) {
    return 'Internal server error.'
  }

  // Default: return generic message to avoid leaking internals
  return 'Internal server error.'
}

/**
 * Creates a standardized API error response.
 * Use this in new/modified API routes for consistent error shapes.
 *
 * Response shape: { error: string, code?: string }
 */
export function apiError(
  message: string,
  status: number,
  code?: string
) {
  const body: { error: string; code?: string } = { error: message }
  if (code) body.code = code
  return body
}
