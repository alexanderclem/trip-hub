import { afterEach, expect, it, vi } from 'vitest'
import { handleImport } from './import'
const env = { SUPABASE_URL: 'https://db.test', SUPABASE_PUBLISHABLE_KEY: 'public', AI_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) }, AI: { run: vi.fn(async () => ({ response: { entries: [] } })) } }
const request = (text: string) => new Request('https://app.test/api/import', { method: 'POST', headers: { Authorization: 'Bearer session', Origin: 'https://app.test' }, body: JSON.stringify({ text, timezone: 'UTC' }) })
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })
it('authenticates, validates input before inference, and never fetches URLs from pasted text', async () => {
  const fetch = vi.fn(async (_input: RequestInfo | URL) => Response.json({ id: '00000000-0000-4000-8000-000000000001' })); vi.stubGlobal('fetch', fetch)
  expect((await handleImport(request('x'), env)).status).toBe(400)
  expect(env.AI.run).not.toHaveBeenCalled()
  const response = await handleImport(request('Visit https://internal.example/private'), env)
  expect(response.status).toBe(200)
  expect(fetch.mock.calls.every((call) => String(call[0]).endsWith('/auth/v1/user'))).toBe(true)
})
it('rejects cross-origin and signed-out requests before invoking AI', async () => {
  const foreign = request('Flight UA123'); foreign.headers.set('Origin', 'https://evil.test')
  expect((await handleImport(foreign, env)).status).toBe(403)
  const signedOut = request('Flight UA123'); signedOut.headers.delete('authorization')
  expect((await handleImport(signedOut, env)).status).toBe(401)
  expect(env.AI.run).not.toHaveBeenCalled()
})
