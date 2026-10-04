import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleScan, type ScanEnv } from './scan'

const ORIGIN = 'https://trip-hub.example'
const details = { title: 'Dinner at Café Sky', merchant: 'Café Sky', amount: 450, currency: 'GTQ', date: '2027-03-15', confirmation_code: null, flight: null, notes: null }

function env(run: ScanEnv['AI']['run'], allowed = true): ScanEnv {
  return { AI: { run }, AI_RATE_LIMITER: { limit: async () => ({ success: allowed }) }, SUPABASE_URL: 'https://db.example', SUPABASE_PUBLISHABLE_KEY: 'pk' }
}
const req = (body: unknown, headers: Record<string, string> = {}) => new Request(`${ORIGIN}/api/scan`, {
  method: 'POST', body: JSON.stringify(body), headers: { authorization: 'Bearer token', origin: ORIGIN, ...headers },
})

afterEach(() => vi.unstubAllGlobals())
function signedIn() {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: '00000000-0000-4000-8000-000000000001' })))
}

describe('/api/scan', () => {
  it('uses the vision model when there is a photo', async () => {
    signedIn()
    const run = vi.fn<ScanEnv['AI']['run']>(async () => ({ response: `Here you go: ${JSON.stringify(details)}` }))
    const res = await handleScan(req({ kind: 'receipt', image: 'aGVsbG8=', text: 'CAFE SKY TOTAL Q450.00' }), env(run))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ details, via: 'vision' })
    expect(run.mock.calls[0]![0]).toContain('vision')
  })

  it('accepts the vision licence once, then answers', async () => {
    signedIn()
    let agreed = false
    const run = vi.fn(async (_model: string, input: Record<string, unknown>) => {
      if (input.prompt === 'agree') { agreed = true; return { response: 'ok' } }
      if (!agreed) throw new Error('5016: Prior to using this model, you must submit the prompt agree')
      return { response: details }
    })
    const res = await handleScan(req({ kind: 'receipt', image: 'aGVsbG8=', text: '' }), env(run))
    expect(await res.json()).toMatchObject({ via: 'vision' })
  })

  it('falls back to the text model on the phone’s text when vision fails', async () => {
    signedIn()
    const run = vi.fn(async (model: string) => {
      if (model.includes('vision')) throw new Error('model unavailable')
      return { response: details }
    })
    const res = await handleScan(req({ kind: 'receipt', image: 'aGVsbG8=', text: 'CAFE SKY TOTAL Q450.00' }), env(run))
    expect(await res.json()).toEqual({ details, via: 'text' })
  })

  it('refuses other sites, missing sign-in, bad bodies and too many requests', async () => {
    signedIn()
    const run = vi.fn()
    expect((await handleScan(req({}, { origin: 'https://evil.example' }), env(run))).status).toBe(403)
    expect((await handleScan(new Request(`${ORIGIN}/api/scan`, { method: 'POST', body: '{}' }), env(run))).status).toBe(401)
    expect((await handleScan(req({ kind: 'receipt', image: 'not base64!', text: '' }), env(run))).status).toBe(400)
    expect((await handleScan(req({ kind: 'receipt', image: null, text: 'TOTAL Q450.00' }), env(run, false))).status).toBe(429)
    expect(run).not.toHaveBeenCalled()
  })

  it('says so when nothing could be found', async () => {
    signedIn()
    const res = await handleScan(req({ kind: 'document', image: null, text: 'blurry blurry' }), env(vi.fn(async () => ({ response: 'Nothing here.' }))))
    expect(res.status).toBe(422)
  })
})
