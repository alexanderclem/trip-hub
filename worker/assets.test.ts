import { describe, expect, it } from 'vitest'
import worker, { assetOrNotFound, type Env } from './index'

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
  it('keeps the app fallback for app routes', async () => {
    for (const path of ['/t/abc/plan', '/join', '/index.html']) {
      const res = await assetOrNotFound(new Request(`https://joinstowaway.app${path}`), { ASSETS: spa })
      expect(res.status).toBe(200)
    }
  })
})
