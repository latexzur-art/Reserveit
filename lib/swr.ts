export class SWRError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'SWRError'
    this.status = status
    this.body = body
  }
}

/**
 * Standard JSON fetcher for SWR hooks.
 * Parses JSON response and throws structured SWRError on HTTP error status.
 */
export async function jsonFetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const errorMsg = data?.error || data?.message || `Request failed with status ${res.status}`
    throw new SWRError(errorMsg, res.status, data)
  }

  return data as T
}
