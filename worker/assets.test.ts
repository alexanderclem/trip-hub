import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import worker, { assetOrNotFound, SECURITY_HEADERS, servePage, type Env } from './index'
import { classifyPath } from '../src/features/website/routes'
import { publicPages } from '../src/features/website/metadata'

const spa = { fetch: async () => new Response('<!doctype html><title>Stowaway</title>', { headers: { 'content-type': 'text/html; charset=utf-8' } }) }
const file = { fetch: async () => new Response('User-agent: *\n', { headers: { 'content-type': 'text/plain' } }) }

describe('static assets', () => {
  it('answers a missing file with a real 404 instead of the app page', async () => {
    for (const path of ['/llms.txt', '/robots.txt', '/sitemap.xml']) {
      const res = await assetOrNotFound(new Request(`https://joinstowaway.app${path}`), { ASSETS: spa })
      expect(res.status).toBe(404)
      expect(await res.text()).toBe('Not found\n')
    }
  })
  it('serves files that exist', async () => {
    const res = await assetOrNotFound(new Request('https://joinstowaway.app/robots.txt'), { ASSETS: file })
    expect(res.status).toBe(200)
  })
  it('answers unknown API paths with a JSON 404', async () => {
    const res = await worker.fetch(new Request('https://joinstowaway.app/api/v1/trips'), { ASSETS: spa } as unknown as Env)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found' })
  })
  it('keeps the app fallback for files the SPA serves', async () => {
    for (const path of ['/t/abc/plan', '/join', '/index.html']) {
      const res = await assetOrNotFound(new Request(`https://joinstowaway.app${path}`), { ASSETS: spa })
      expect(res.status).toBe(200)
    }
  })
})

/** Stands in for Workers static assets: built pages and app.html exist; everything else gets the SPA fallback. */
function assets() {
  const seen: string[] = []
  return {
    seen,
    ASSETS: {
      fetch: async (request: Request) => {
        const path = new URL(request.url).pathname
        seen.push(path)
        const body = path === '/app' ? '<div id="root"></div>' : `<div id="root" data-prerender="${path}"></div>`
        return new Response(request.method === 'HEAD' ? null : body, { headers: { 'content-type': 'text/html; charset=utf-8', etag: '"x"' } })
      },
    },
  }
}

describe('pages', () => {
  it('serves website pages as built, with security headers and no noindex', async () => {
    for (const path of ['/', '/pricing', '/organizers', '/privacy', '/tools/trip-cost-splitter', '/compare/best-group-trip-planner-apps']) {
      const res = await servePage(new Request(`https://joinstowaway.app${path}`), assets())
      expect(res.status, path).toBe(200)
      expect(await res.text()).toContain(`data-prerender="${path}"`)
      expect(res.headers.get('x-robots-tag')).toBeNull()
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(res.headers.get(name)).toBe(value)
    }
  })
  it('gives app routes the bare app shell, marked noindex', async () => {
    for (const path of ['/app', '/new', '/t/abc/plan', '/go/lake-week', '/b', '/signin', '/organize/travelers', '/quiz']) {
      const env = assets()
      const res = await servePage(new Request(`https://joinstowaway.app${path}`), env)
      expect(res.status, path).toBe(200)
      expect(res.headers.get('x-robots-tag')).toBe('noindex')
      expect(await res.text()).toBe('<div id="root"></div>')
      expect(env.seen).toEqual(['/app'])
    }
  })
  it('answers unknown paths with a real 404 that still renders the not-found screen', async () => {
    for (const path of ['/nope-xyz', '/about', '/contact', '/sitemap_index', '/organizersx']) {
      const res = await servePage(new Request(`https://joinstowaway.app${path}`, { headers: { 'if-none-match': '"x"' } }), assets())
      expect(res.status, path).toBe(404)
      expect(res.headers.get('x-robots-tag')).toBe('noindex')
      expect(await res.text()).toBe('<div id="root"></div>')
    }
  })
  it('redirects plain http to https and old addresses to new ones', async () => {
    const http = await servePage(new Request('http://joinstowaway.app/pricing?x=1'), assets())
    expect(http.status).toBe(301)
    expect(http.headers.get('location')).toBe('https://joinstowaway.app/pricing?x=1')
    const old = await servePage(new Request('https://joinstowaway.app/operators/?ref=a'), assets())
    expect(old.status).toBe(301)
    expect(old.headers.get('location')).toBe('/organizers?ref=a')
    const local = await servePage(new Request('http://localhost:8787/pricing'), assets())
    expect(local.status).toBe(200)
  })
  it('routes navigations through servePage from the Worker entry', async () => {
    const res = await worker.fetch(new Request('https://joinstowaway.app/nope'), assets() as unknown as Env)
    expect(res.status).toBe(404)
  })
})

describe('every route in the app router is known to the Worker', () => {
  it('classifies no router path as missing', () => {
    const source = readFileSync(new URL('../src/router.tsx', import.meta.url), 'utf8')
    const paths = [...source.matchAll(/path: '(\/[^']*)'/g)].map((match) => match[1]!.replace(/:[A-Za-z]+/g, 'x'))
    expect(paths.length).toBeGreaterThan(20)
    for (const path of paths) expect(classifyPath(path).kind, path).not.toBe('missing')
    for (const path of Object.keys(publicPages)) expect(classifyPath(path), path).toEqual({ kind: 'page' })
  })
})
