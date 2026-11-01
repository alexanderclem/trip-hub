// A small Stripe REST client over fetch, so it runs the same in Edge Functions (Deno) and in tests.
// Calls on a connected account pass `account` (the Stripe-Account header): that is how direct
// charges, their sessions and their payouts are reached. Every create carries an idempotency key.

export interface StripeConfig {
  secretKey: string
  fetch?: typeof fetch
  apiVersion?: string
}

export class StripeError extends Error {
  constructor(public status: number, public type: string, message: string, public code?: string) {
    super(message)
  }
}

/** Stripe's form encoding: nested objects and arrays as a[b][0]=x. */
export function formEncode(params: Record<string, unknown>, prefix = ''): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    const name = prefix ? `${prefix}[${key}]` : key
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (v !== null && typeof v === 'object') parts.push(formEncode(v as Record<string, unknown>, `${name}[${i}]`))
        else parts.push(`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(v))}`)
      })
    } else if (typeof value === 'object') {
      parts.push(formEncode(value as Record<string, unknown>, name))
    } else {
      parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`)
    }
  }
  return parts.filter(Boolean).join('&')
}

export interface RequestOptions {
  account?: string
  idempotencyKey?: string
}

export function stripeClient(config: StripeConfig) {
  const doFetch = config.fetch ?? fetch
  async function request<T = Record<string, unknown>>(method: 'GET' | 'POST', path: string, params: Record<string, unknown> = {}, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { Authorization: `Bearer ${config.secretKey}` }
    // Without a pinned version, the platform account's default API version applies (set in Stripe).
    if (config.apiVersion) headers['Stripe-Version'] = config.apiVersion
    if (options.account) headers['Stripe-Account'] = options.account
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey
    const body = formEncode(params)
    let url = `https://api.stripe.com${path}`
    let init: RequestInit = { method, headers }
    if (method === 'GET') {
      if (body) url += `?${body}`
    } else {
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
      init = { method, headers, body }
    }
    const res = await doFetch(url, init)
    const json = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok) {
      const error = (json.error ?? {}) as { type?: string; message?: string; code?: string }
      throw new StripeError(res.status, error.type ?? 'api_error', error.message ?? `Stripe answered ${res.status}`, error.code)
    }
    return json as T
  }
  return {
    get: <T = Record<string, unknown>>(path: string, params?: Record<string, unknown>, options?: RequestOptions) => request<T>('GET', path, params, options),
    post: <T = Record<string, unknown>>(path: string, params?: Record<string, unknown>, options?: RequestOptions) => request<T>('POST', path, params, options),
  }
}

export type Stripe = ReturnType<typeof stripeClient>

// ─── Webhook signatures ─────────────────────────────────────────────────────

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export interface StripeEvent {
  id: string
  type: string
  account?: string
  created: number
  data: { object: Record<string, unknown> }
}

/**
 * Checks a Stripe-Signature header ("t=…,v1=…") against any of the endpoint secrets (platform and
 * Connect endpoints have their own, and a rotated secret overlaps for a while), within 5 minutes.
 * Returns the parsed event, or throws.
 */
export async function verifyWebhook(payload: string, header: string | null, secrets: string[], nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300): Promise<StripeEvent> {
  if (!header) throw new Error('Missing Stripe-Signature')
  const parts = header.split(',').map((p) => p.split('=') as [string, string])
  const timestamp = Number(parts.find(([k]) => k === 't')?.[1])
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v)
  if (!Number.isFinite(timestamp) || !signatures.length) throw new Error('Malformed Stripe-Signature')
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) throw new Error('Stripe-Signature is too old')
  for (const secret of secrets.filter(Boolean)) {
    const expected = await hmac(secret, `${timestamp}.${payload}`)
    if (signatures.some((s) => safeEqual(s, expected))) return JSON.parse(payload) as StripeEvent
  }
  throw new Error('Stripe-Signature does not match')
}

/** A signature header for tests and local replays (what Stripe's generateTestHeaderString does). */
export async function signForTest(payload: string, secret: string, timestamp: number): Promise<string> {
  return `t=${timestamp},v1=${await hmac(secret, `${timestamp}.${payload}`)}`
}
