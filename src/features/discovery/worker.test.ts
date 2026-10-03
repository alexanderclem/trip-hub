import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import worker, { type Env } from '../../../worker/index'
import { NEUTRAL, type AIRequest } from './model'

const user = '00000000-0000-4000-8000-000000000001'
let env: Env
const request = (body: unknown, authorization = 'Bearer test') => new Request('https://test.local/api/travel-ai', { method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
beforeEach(() => {
  env = { ASSETS: { fetch: vi.fn(async () => new Response('app')) }, AI: { run: vi.fn(async () => ({ response: { scores: NEUTRAL, explanation: 'Unknown interests stay neutral.' } })) }, AI_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) }, SUPABASE_URL: 'https://test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-test-key' }
  vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(url.includes('/auth/') ? { id: user } : [])))
})
afterEach(() => vi.unstubAllGlobals())
describe('AI request boundary', () => {
  it('serves normal app routes without invoking AI', async () => {
    expect(await (await worker.fetch(new Request('https://test.local/inspire'), env)).text()).toBe('app')
    expect(env.AI.run).not.toHaveBeenCalled()
  })
  it('requires a valid session and validates scores on the server', async () => {
    expect((await worker.fetch(request({ action: 'profile', description: 'Nature' }, ''), env)).status).toBe(401)
    const response = await worker.fetch(request({ action: 'profile', description: 'Nature' }), env)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ scores: NEUTRAL, explanation: 'Unknown interests stay neutral.' })
    expect(env.AI.run).toHaveBeenCalledWith('@cf/meta/llama-3.3-70b-instruct-fp8-fast', expect.objectContaining({ max_tokens: 600 }))
  })
  it('refuses trip planning for an unjoined device', async () => {
    const body: AIRequest = { action: 'ideas', tripId: user, brief: { prompt: 'A quiet trip', destination: '', days: 1, startDate: null, budgetMinor: null, currency: 'USD' }, profiles: [{ scores: NEUTRAL, description: '', constraints: '' }], mode: 'everyone', requiredAxes: [], previous: null, places: [], existingPlan: [] }
    expect((await worker.fetch(request(body), env)).status).toBe(403)
    expect(env.AI.run).not.toHaveBeenCalled()
  })
  it('rejects malformed input, cross-origin requests and excessive request bodies', async () => {
    expect((await worker.fetch(request({ action: 'profile', description: '' }), env)).status).toBe(400)
    const cross = request({ action: 'profile', description: 'Nature' }); cross.headers.set('Origin', 'https://other.local')
    expect((await worker.fetch(cross, env)).status).toBe(403)
    expect((await worker.fetch(request({ text: 'x'.repeat(80001) }), env)).status).toBe(413)
    expect(env.AI.run).not.toHaveBeenCalled()
  })
  it('handles quota failures and invalid AI output without changing the plan', async () => {
    env.AI.run = vi.fn(async () => ({ response: { scores: { food: 999 }, explanation: '' } }))
    expect((await worker.fetch(request({ action: 'profile', description: 'Food' }), env)).status).toBe(502)
    env.AI_RATE_LIMITER.limit = vi.fn(async () => ({ success: false }))
    expect((await worker.fetch(request({ action: 'profile', description: 'Food' }), env)).status).toBe(429)
  })
})
