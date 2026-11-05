import { afterEach, describe, expect, it, vi } from 'vitest'
import worker, { type Env } from './index'
import { dateRange, handleInvite, isInvitePath, previewText, withPreview } from './invite'

const SHELL = `<!doctype html><html><head>
    <meta name="description" content="Plan your group trip in one place." />
    <meta property="og:title" content="Stowaway — Plan a trip with friends" />
    <meta property="og:description" content="Save places." />
    <meta property="og:image:alt" content="Stowaway." />
    <title>Stowaway — Plan a trip with friends</title>
  </head><body><div id="root"></div></body></html>`
const KEY = 'a1b2c3d4e5f60718293a'
const assets = () => {
  const seen: string[] = []
  return { seen, fetch: async (r: Request) => { seen.push(new URL(r.url).pathname); return new Response(SHELL, { headers: { 'content-type': 'text/html; charset=utf-8' } }) } }
}
const env = (ASSETS = assets()) => ({ ASSETS, SUPABASE_URL: 'https://db.example', SUPABASE_PUBLISHABLE_KEY: 'pk' })
const rpc = (body: unknown, status = 200) => vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(body, { status }))

afterEach(() => vi.restoreAllMocks())

describe('invite preview text', () => {
  it('formats date ranges compactly', () => {
    expect(dateRange('2027-03-13', '2027-03-21')).toBe('Mar 13 – 21, 2027')
    expect(dateRange('2027-03-28', '2027-04-04')).toBe('Mar 28 – Apr 4, 2027')
    expect(dateRange('2026-12-28', '2027-01-03')).toBe('Dec 28, 2026 – Jan 3, 2027')
    expect(dateRange('2027-03-13', null)).toBe('Mar 13, 2027')
    expect(dateRange(null, '2027-03-13')).toBeNull()
  })
  it('names the trip, its dates and group size', () => {
    expect(previewText({ name: 'Guatemala SB 27', start_date: '2027-03-13', end_date: '2027-03-21', people: 8 })).toEqual({
      title: 'You’re invited: Guatemala SB 27',
      description: 'Mar 13 – 21, 2027 · 8 people in the group. Tap to see the plan and join. No account or app download needed.',
    })
    expect(previewText({ name: 'Solo', start_date: null, end_date: null, people: 1 }).description).toMatch(/^1 person in the group\. /)
    expect(previewText(null).title).toBe('You’re invited to a trip on Stowaway')
  })
  it('escapes the trip name everywhere it lands', () => {
    const html = withPreview(SHELL, previewText({ name: '"><script>alert(1)</script>', start_date: null, end_date: null, people: 0 }), 'https://joinstowaway.app/join')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&quot;&gt;&lt;script&gt;')
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />')
  })
  it('only claims invite paths', () => {
    expect(isInvitePath('/join')).toBe(true)
    expect(isInvitePath(`/join/p/${KEY}`)).toBe(true)
    expect(isInvitePath('/join/p/not-a-key')).toBe(false)
    expect(isInvitePath('/joinx')).toBe(false)
  })
})

describe('invite preview page', () => {
  it('shows the trip for a known key, from the plain app shell', async () => {
    const spy = rpc([{ name: 'Lake week', start_date: '2027-03-13', end_date: '2027-03-21', people: 3 }])
    const e = env()
    const res = await handleInvite(new Request(`https://joinstowaway.app/join/p/${KEY}`), e)
    const html = await res.text()
    expect(e.ASSETS.seen).toEqual(['/app'])
    expect(html).toContain('<title>You’re invited: Lake week</title>')
    expect(html).toContain('<meta property="og:description" content="Mar 13 – 21, 2027 · 3 people in the group.')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    const [url, init] = spy.mock.calls[0]!
    expect(String(url)).toBe('https://db.example/rest/v1/rpc/invite_preview')
    expect(JSON.parse(String(init!.body))).toEqual({ p_key: KEY })
  })
  it('falls back to the generic card when the lookup fails or finds nothing', async () => {
    for (const mock of [() => rpc([]), () => rpc({ message: 'no function' }, 404), () => vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'))]) {
      mock()
      const html = await (await handleInvite(new Request(`https://joinstowaway.app/join/p/${KEY}`), env())).text()
      expect(html).toContain('<title>You’re invited to a trip on Stowaway</title>')
      vi.restoreAllMocks()
    }
  })
  it('never looks anything up for an old /join link', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    const html = await (await handleInvite(new Request('https://joinstowaway.app/join'), env())).text()
    expect(spy).not.toHaveBeenCalled()
    expect(html).toContain('You’re invited to a trip on Stowaway')
  })
  it('is routed by the worker for GET', async () => {
    rpc([])
    const res = await worker.fetch(new Request(`https://joinstowaway.app/join/p/${KEY}`), env() as unknown as Env)
    expect(await res.text()).toContain('You’re invited')
  })
})
