// Link previews for invite links. The token rides in the #fragment, which chat apps never send, so
// the path carries a preview key instead: /join/p/<key>#t=<token>. The key is a digest of the token
// (supabase/migrations/20261107000001_invite_preview.sql): it grants nothing and can't be reversed,
// and invite_preview returns only the trip's name, dates and group size.
// Old /join#t=… links, and any lookup that fails, get a generic invitation card.

export interface InviteEnv {
  ASSETS: { fetch(request: Request): Promise<Response> }
  SUPABASE_URL?: string
  SUPABASE_PUBLISHABLE_KEY?: string
}

export interface TripPreview { name: string; start_date: string | null; end_date: string | null; people: number }
export interface PreviewText { title: string; description: string }

const KEY = /^\/join\/p\/([0-9a-f]{20})\/?$/

/** True for the paths this module answers: /join and /join/p/<key>. */
export const isInvitePath = (path: string) => path === '/join' || path === '/join/' || KEY.test(path)

const day = (iso: string) => new Date(`${iso}T12:00:00Z`)
const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts })

/** "Mar 13 – 21, 2027", "Mar 28 – Apr 4, 2027", "Dec 28, 2026 – Jan 3, 2027", or one date. */
export function dateRange(start: string | null, end: string | null): string | null {
  if (!start) return null
  const a = day(start)
  if (!end || end === start) return fmt({ month: 'short', day: 'numeric', year: 'numeric' }).format(a)
  const b = day(end)
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear()
  if (sameYear && a.getUTCMonth() === b.getUTCMonth()) {
    return `${fmt({ month: 'short', day: 'numeric' }).format(a)} – ${b.getUTCDate()}, ${b.getUTCFullYear()}`
  }
  if (sameYear) return `${fmt({ month: 'short', day: 'numeric' }).format(a)} – ${fmt({ month: 'short', day: 'numeric', year: 'numeric' }).format(b)}`
  return `${fmt({ month: 'short', day: 'numeric', year: 'numeric' }).format(a)} – ${fmt({ month: 'short', day: 'numeric', year: 'numeric' }).format(b)}`
}

const JOIN = 'Tap to see the plan and join. No account or app download needed.'

export const GENERIC: PreviewText = { title: 'You’re invited to a trip on Stowaway', description: JOIN }

export function previewText(trip: TripPreview | null): PreviewText {
  if (!trip) return GENERIC
  const facts = [dateRange(trip.start_date, trip.end_date), trip.people > 0 ? `${trip.people} ${trip.people === 1 ? 'person' : 'people'} in the group` : null]
    .filter(Boolean).join(' · ')
  return { title: `You’re invited: ${trip.name}`, description: facts ? `${facts}. ${JOIN}` : JOIN }
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Puts the preview into the app's HTML head. Every value is escaped; the trip name is user text. */
export function withPreview(html: string, text: PreviewText, url: string): string {
  const title = escape(text.title)
  const description = escape(text.description)
  const setMeta = (doc: string, attr: 'name' | 'property', key: string, value: string) =>
    doc.replace(new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`), (_m, a: string, b: string) => `${a}${value}${b}`)
  let out = html
  out = setMeta(out, 'name', 'description', description)
  out = setMeta(out, 'property', 'og:title', title)
  out = setMeta(out, 'property', 'og:description', description)
  out = setMeta(out, 'property', 'og:image:alt', 'Stowaway, the shared trip planner for groups of friends.')
  out = out.replace(/<title>[^<]*<\/title>/, () => `<title>${title}</title>`)
  // Invite pages are private: keep them out of search, and name the page that was shared.
  const extra = `<meta name="robots" content="noindex, nofollow" />\n    <meta property="og:url" content="${escape(url)}" />\n    <meta name="twitter:title" content="${title}" />\n    <meta name="twitter:description" content="${description}" />\n  `
  return out.replace('</head>', () => `${extra}</head>`)
}

async function lookup(key: string, env: InviteEnv): Promise<TripPreview | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return null
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/invite_preview`, {
      method: 'POST',
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_key: key }),
      signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) return null
    const rows = await res.json() as unknown
    const row = Array.isArray(rows) ? rows[0] as Partial<TripPreview> | undefined : undefined
    if (!row || typeof row.name !== 'string') return null
    return {
      name: row.name.slice(0, 120),
      start_date: typeof row.start_date === 'string' ? row.start_date : null,
      end_date: typeof row.end_date === 'string' ? row.end_date : null,
      people: typeof row.people === 'number' && row.people >= 0 ? Math.floor(row.people) : 0,
    }
  } catch {
    return null
  }
}

/** Serves the app's page for an invite path, with preview tags for chat apps. */
export async function handleInvite(request: Request, env: InviteEnv): Promise<Response> {
  const url = new URL(request.url)
  // The plain app shell (dist/app.html, served at /app); the SPA fallback would serve the
  // prerendered homepage, with the homepage's canonical URL.
  const page = await env.ASSETS.fetch(new Request(new URL('/app', url), { headers: request.headers }))
  if (!page.ok || !(page.headers.get('content-type') ?? '').startsWith('text/html')) return page
  const key = url.pathname.match(KEY)?.[1]
  const trip = key ? await lookup(key, env) : null
  const html = withPreview(await page.text(), previewText(trip), `${url.origin}${url.pathname}`)
  const headers = new Headers(page.headers)
  headers.delete('content-length')
  headers.delete('etag')
  headers.set('Cache-Control', 'no-store')
  headers.set('X-Robots-Tag', 'noindex, nofollow')
  headers.set('Referrer-Policy', 'no-referrer')
  return new Response(html, { status: 200, headers })
}
