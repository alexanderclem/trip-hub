import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import worker, { type Env } from '../../../worker/index'
import { NEUTRAL, type AIRequest } from './model'

const user = '00000000-0000-4000-8000-000000000001'
let env: Env
let modelReply: unknown
let tripRows: unknown[]
let modelStatus = 200
const request = (body: unknown, authorization = 'Bearer test') => new Request('https://test.local/api/travel-ai', { method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
  if (url.includes('deepseek')) {
    if (modelStatus !== 200) return new Response('no', { status: modelStatus })
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: typeof modelReply === 'string' ? modelReply : JSON.stringify(modelReply) } }] })
  }
  return Response.json(url.includes('/auth/') ? { id: user } : tripRows)
})
/** The body of every DeepSeek call so far. */
const modelCalls = () => fetchMock.mock.calls.filter(([url]) => url.includes('deepseek')).map(([, init]) => JSON.parse(String(init?.body)) as { model: string; max_tokens: number; response_format: unknown; messages: { role: string; content: string }[] })
beforeEach(() => {
  modelReply = { scores: NEUTRAL, explanation: 'Unknown interests stay neutral.' }
  tripRows = []
  modelStatus = 200
  fetchMock.mockClear()
  const aiRun = vi.fn(async () => ({ response: null }))
  env = { ASSETS: { fetch: vi.fn(async () => new Response('app')) }, AI: { run: aiRun }, AI_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) }, SUPABASE_URL: 'https://test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-test-key', DEEPSEEK_API_KEY: 'sk-test', DEEPSEEK_MODEL: 'deepseek-flash' }
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  // Stowie never touches Workers AI.
  expect(env.AI.run).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
})
describe('AI request boundary', () => {
  it('serves normal app routes without invoking AI', async () => {
    expect(await (await worker.fetch(new Request('https://test.local/inspire'), env)).text()).toBe('app')
    expect(modelCalls()).toHaveLength(0)
  })
  it('requires a valid session and validates scores on the server', async () => {
    expect((await worker.fetch(request({ action: 'profile', description: 'Nature' }, ''), env)).status).toBe(401)
    const response = await worker.fetch(request({ action: 'profile', description: 'Nature' }), env)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ scores: NEUTRAL, explanation: 'Unknown interests stay neutral.' })
    expect(modelCalls()[0]).toMatchObject({ model: 'deepseek-flash', max_tokens: 600, response_format: { type: 'json_object' } })
    expect(modelCalls()[0]!.messages[0]!.content).toContain('json')
  })
  it('answers a chat line in Stowie’s voice, sending no trip data and capping the reply', async () => {
    const reply = { intent: 'plan', reply: 'Markets and slow mornings, noted.', destination: 'Oaxaca', days: 5, budget: null, topics: [] }
    modelReply = JSON.stringify(reply)
    const body: AIRequest = { action: 'chat', text: 'Five days of markets in Oaxaca', context: { hasProfile: true, draftTitle: null, destination: '', inTrip: false, recent: [{ from: 'stowie', text: 'What are you imagining?' }] } }
    const response = await worker.fetch(request(body), env)
    expect(await response.json()).toEqual(reply)
    expect(modelCalls()[0]).toMatchObject({ model: 'deepseek-flash', max_tokens: 300 })
    expect(modelCalls()[0]!.messages[0]!.content).toContain('You are Stowie')
    modelReply = { intent: 'book', reply: '' }
    expect((await worker.fetch(request(body), env)).status).toBe(502)
    expect((await worker.fetch(request({ ...body, text: 'x'.repeat(1001) }), env)).status).toBe(400)
  })
  it('answers a trip question only for someone in that trip, from the snapshot it was sent', async () => {
    const body: AIRequest = { action: 'assist', tripId: user, text: 'What’s left to do?', me: 'Alex', today: 'Monday 15 March 2027, 09:00 (America/Guatemala)', snapshot: { tasks: '[open] Book shuttle | owner: Sam' } }
    expect((await worker.fetch(request(body), env)).status).toBe(403)
    expect(modelCalls()).toHaveLength(0)
    tripRows = [{ id: user }]
    const reply = { reply: 'One thing: Sam still needs to book the shuttle.', action: 'none', title: null, date: null, time: null, durationMinutes: null, assignee: null, options: [] }
    modelReply = reply
    expect(await (await worker.fetch(request(body), env)).json()).toEqual(reply)
    const [call] = modelCalls()
    expect(call).toMatchObject({ model: 'deepseek-flash', max_tokens: 600 })
    expect(call!.messages[0]!.content).toContain('Answer only from the snapshot')
    expect(call!.messages[1]!.content).toContain('Book shuttle')
    expect((await worker.fetch(request({ ...body, snapshot: { tickets: 'boarding pass' } }), env)).status).toBe(400)
  })
  it('refuses trip planning for an unjoined device', async () => {
    const body: AIRequest = { action: 'ideas', tripId: user, brief: { prompt: 'A quiet trip', destination: '', days: 1, startDate: null, budgetMinor: null, currency: 'USD' }, profiles: [{ scores: NEUTRAL, description: '', constraints: '' }], mode: 'everyone', requiredAxes: [], previous: null, places: [], existingPlan: [] }
    expect((await worker.fetch(request(body), env)).status).toBe(403)
    expect(modelCalls()).toHaveLength(0)
  })
  it('rejects malformed input, cross-origin requests and excessive request bodies', async () => {
    expect((await worker.fetch(request({ action: 'profile', description: '' }), env)).status).toBe(400)
    const cross = request({ action: 'profile', description: 'Nature' }); cross.headers.set('Origin', 'https://other.local')
    expect((await worker.fetch(cross, env)).status).toBe(403)
    expect((await worker.fetch(request({ text: 'x'.repeat(80001) }), env)).status).toBe(413)
    expect(modelCalls()).toHaveLength(0)
  })
  it('handles quota failures and invalid AI output without changing the plan', async () => {
    modelReply = { scores: { food: 999 }, explanation: '' }
    expect((await worker.fetch(request({ action: 'profile', description: 'Food' }), env)).status).toBe(502)
    modelReply = 'not json'
    expect((await worker.fetch(request({ action: 'profile', description: 'Food' }), env)).status).toBe(502)
    modelStatus = 402
    expect((await worker.fetch(request({ action: 'profile', description: 'Food' }), env)).status).toBe(503)
    env.AI_RATE_LIMITER.limit = vi.fn(async () => ({ success: false }))
    expect((await worker.fetch(request({ action: 'profile', description: 'Food' }), env)).status).toBe(429)
  })
  it('is not connected without a DeepSeek key', async () => {
    delete env.DEEPSEEK_API_KEY
    expect((await worker.fetch(request({ action: 'profile', description: 'Food' }), env)).status).toBe(503)
    expect(modelCalls()).toHaveLength(0)
  })
})
