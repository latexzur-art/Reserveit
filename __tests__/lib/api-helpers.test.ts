import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { apiError, apiSuccess } from '@/lib/api/response'
import { parseBody, parseQuery } from '@/lib/api/validate'

describe('apiError / apiSuccess', () => {
  it('apiError returns status and { error, code? } body', async () => {
    const res = apiError(404, 'Not found', 'NOT_FOUND')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found', code: 'NOT_FOUND' })
  })

  it('apiError omits code when not given', async () => {
    const res = apiError(400, 'Bad request')
    expect(await res.json()).toEqual({ error: 'Bad request' })
  })

  it('apiSuccess returns 200 with payload', async () => {
    const res = apiSuccess({ items: [1, 2] })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ items: [1, 2] })
  })

  it('apiSuccess honors status override', () => {
    expect(apiSuccess({ id: 'x' }, 201).status).toBe(201)
  })
})

const bodySchema = z.object({ name: z.string().min(1), count: z.coerce.number().int() })

function jsonRequest(body: unknown): Request {
  return new Request('http://test.local/api/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('parseBody', () => {
  it('returns data on valid body', async () => {
    const parsed = await parseBody(jsonRequest({ name: 'a', count: 2 }), bodySchema)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.data).toEqual({ name: 'a', count: 2 })
  })

  it('400s on schema violation with field path', async () => {
    const parsed = await parseBody(jsonRequest({ name: '', count: 1 }), bodySchema)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.response.status).toBe(400)
      const body = await parsed.response.json()
      expect(body.code).toBe('VALIDATION')
      expect(body.error).toContain('name')
    }
  })

  it('400s on malformed JSON', async () => {
    const req = new Request('http://test.local/api/x', { method: 'POST', body: '{nope' })
    const parsed = await parseBody(req, bodySchema)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.response.status).toBe(400)
  })
})

describe('parseQuery', () => {
  const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1) })

  it('parses and coerces query params', () => {
    const parsed = parseQuery(new Request('http://test.local/api/x?page=3'), querySchema)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.data.page).toBe(3)
  })

  it('applies defaults when param missing', () => {
    const parsed = parseQuery(new Request('http://test.local/api/x'), querySchema)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.data.page).toBe(1)
  })

  it('400s on invalid param', () => {
    const parsed = parseQuery(new Request('http://test.local/api/x?page=zero'), querySchema)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.response.status).toBe(400)
  })
})
