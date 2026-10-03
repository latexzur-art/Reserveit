import { NextResponse } from 'next/server'
import { z } from 'zod'

const uuidSchema = z.string().uuid()

/**
 * Validate a dynamic route param as a UUID. Returns either the parsed value
 * or a ready-made 400 NextResponse the caller can return directly.
 *
 *   const parsed = parseUuidParam(rawId, 'booking id')
 *   if (!parsed.ok) return parsed.response
 *   const id = parsed.value
 */
export function parseUuidParam(
  value: unknown,
  fieldName = 'id',
): { ok: true; value: string } | { ok: false; response: NextResponse } {
  const result = uuidSchema.safeParse(value)
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json({ error: `Invalid ${fieldName}` }, { status: 400 }),
    }
  }
  return { ok: true, value: result.data }
}
