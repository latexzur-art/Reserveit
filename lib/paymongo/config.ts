let warnedWebhookSecret = false

function isProduction() {
  return process.env.NODE_ENV === 'production'
}

export function getPaymongoSecretKey(): string {
  const fromEnv = process.env.PAYMONGO_SECRET_KEY
  if (fromEnv) return fromEnv

  throw new Error('PAYMONGO_SECRET_KEY is not set')
}

export function getPaymongoWebhookSecret(): string | null {
  const fromEnv = process.env.PAYMONGO_WEBHOOK_SECRET
  if (fromEnv) return fromEnv

  if (isProduction()) {
    return null
  }

  if (!warnedWebhookSecret) {
    warnedWebhookSecret = true
    console.warn('[paymongo] PAYMONGO_WEBHOOK_SECRET not set; webhook signature verification disabled (dev only)')
  }
  return null
}

export function paymongoAuthHeader(): string {
  return `Basic ${Buffer.from(`${getPaymongoSecretKey()}:`).toString('base64')}`
}

export const PAYMONGO_BASE = 'https://api.paymongo.com/v1'
