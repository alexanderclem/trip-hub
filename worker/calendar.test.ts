import { afterEach, expect, it, vi } from 'vitest'
import { handleCalendar } from './calendar'
const token = 'a'.repeat(64)
const env = { SUPABASE_URL: 'https://db.test', SUPABASE_PUBLISHABLE_KEY: 'public', TRAVEL_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) } }
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })
it('returns a calendar with stable IDs and properly converted times without caching private data', async () => {
  const fetch = vi.fn(async () => Response.json({ name: 'New York', events: [{ uid: 'one@stowaway', title: 'Museum', start: '2027-03-15T09:00:00-04:00', end: null, allDay: false, tentative: false, updatedAt: '2027-03-01T00:00:00Z', location: '5th Avenue' }] }))
  vi.stubGlobal('fetch', fetch)
  const response = await handleCalendar(new Request(`https://app.test/api/calendar.ics?token=${token}`), env)
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('content-type')).toContain('text/calendar')
  expect(await response.text()).toContain('DTSTART:20270315T130000Z')
  expect(fetch.mock.calls).toHaveLength(1)
})
it('distinguishes invalid and revoked links from server failures without returning empty successful calendars', async () => {
  const fetch = vi.fn(async () => Response.json(null)); vi.stubGlobal('fetch', fetch)
  expect((await handleCalendar(new Request('https://app.test/api/calendar.ics?token=bad'), env)).status).toBe(404)
  expect(fetch).not.toHaveBeenCalled()
  expect((await handleCalendar(new Request(`https://app.test/api/calendar.ics?token=${token}`), env)).status).toBe(404)
  fetch.mockImplementation(async () => Response.json({ error: 'private db error' }, { status: 500 }))
  const failed = await handleCalendar(new Request(`https://app.test/api/calendar.ics?token=${token}`), env)
  expect(failed.status).toBe(503)
  expect(await failed.text()).not.toContain('private db error')
})
