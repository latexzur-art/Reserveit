import { NextResponse } from 'next/server'
import type { z } from 'zod'
import { apiError } from './response'

type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse }

function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'Invalid request'
  const path = issue.path.join('.')
  return path ? `${path}: ${issue.message}` : issue.message
}

/**
 * Parse a JSON request body against a zod schema.
 *
 *   const parsed = await parseBody(request, schema)
 *   if (!parsed.ok) return parsed.response
 *   const { ... } = parsed.data
 */
export async function parseBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<ParseResult<z.infer<S>>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { ok: false, response: apiError(400, 'Invalid JSON body') }
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    return { ok: false, response: apiError(400, firstIssueMessage(result.error), 'VALIDATION') }
  }
  return { ok: true, data: result.data }
}

/**
 * Parse URL search params against a zod schema.
 *
 *   const parsed = parseQuery(request, schema)
 *   if (!parsed.ok) return parsed.response
 */
export function parseQuery<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
): ParseResult<z.infer<S>> {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries())
  const result = schema.safeParse(params)
  if (!result.success) {
    return { ok: false, response: apiError(400, firstIssueMessage(result.error), 'VALIDATION') }
  }
  return { ok: true, data: result.data }
}
