import { NextResponse } from 'next/server'
import { getErrorDetails, getErrorMessage, sanitizeDbError } from '@/lib/errors'

/**
 * Standard error response for API routes.
 * Body shape: { error: string, code?: string } — same shape as lib/errors.ts.
 */
export function apiError(status: number, message: string, code?: string): NextResponse {
  const body: { error: string; code?: string } = { error: message }
  if (code) body.code = code
  return NextResponse.json(body, { status })
}

/** Standard success response: payload as-is, optional status override. */
export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data as unknown as Record<string, unknown> | unknown[], { status })
}

/**
 * Catch-all handler for route try/catch blocks: logs full details
 * server-side, returns a sanitized 500 to the client.
 */
export function apiUnexpectedError(context: string, err: unknown): NextResponse {
  console.error(`[${context}]`, getErrorDetails(err))
  return apiError(500, sanitizeDbError(err))
}

export { getErrorMessage }
