import { afterEach, describe, expect, it, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { SignJWT, exportJWK, generateKeyPair } from 'jose'
import { createConnectorServer, handleConnector, validConnectorClaims, type ConnectorEnv } from './connector'

const userId = '11111111-1111-4111-8111-111111111111'
const tripId = '22222222-2222-4222-8222-222222222222'
const env: ConnectorEnv = {
  SUPABASE_URL: 'https://test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
  MCP_RESOURCE_URL: 'https://stowaway.example/mcp', MCP_CLIENT_ID: 'client-test',
  MCP_RATE_LIMITER: { limit: async () => ({ success: true }) },
}
const claims = () => ({ sub: userId, role: 'stowaway_connector', client_id: env.MCP_CLIENT_ID,
  aud: env.MCP_RESOURCE_URL, iss: `${env.SUPABASE_URL}/auth/v1`, scope: 'openid',
  is_anonymous: false, exp: Math.floor(Date.now() / 1000) + 300 })
const request = (method: string, path = '/mcp', token?: string, body?: unknown) => new Request(`https://stowaway.example${path}`, {
  method, headers: { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
})
const rpc = (method: string, params?: unknown) => ({ jsonrpc: '2.0', id: 1, method, params })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

async function withClient(run: (client: Client) => Promise<void>) {
  const server = createConnectorServer(env, 'caller-token')
  const client = new Client({ name: 'connector-test', version: '1' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  try { await run(client) } finally { await client.close(); await server.close() }
}

describe('connector authorization', () => {
  it('accepts only non-anonymous OAuth tokens for the configured client and resource', () => {
    expect(validConnectorClaims(claims(), env)).toBe(true)
    for (const change of [{ role: 'authenticated' }, { client_id: 'other' }, { aud: 'authenticated' },
      { iss: 'https://other.example' }, { is_anonymous: true }, { exp: 0 }, { scope: '' }, { sub: 'fake' }]) {
      expect(validConnectorClaims({ ...claims(), ...change }, env)).toBe(false)
    }
  })
  it('advertises OAuth discovery without exposing any private data', async () => {
    const response = await handleConnector(request('GET', '/.well-known/oauth-protected-resource/mcp'), env)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ resource: env.MCP_RESOURCE_URL, authorization_servers: [`${env.SUPABASE_URL}/auth/v1`], scopes_supported: ['openid'] })
  })
  it('fails closed when not configured and challenges unauthenticated requests', async () => {
    expect((await handleConnector(request('POST'), { ...env, MCP_CLIENT_ID: undefined })).status).toBe(503)
    const response = await handleConnector(request('POST'), env)
    expect(response.status).toBe(401)
    expect(response.headers.get('WWW-Authenticate')).toContain('/.well-known/oauth-protected-resource/mcp')
  })
  it('rejects disallowed origins and enforces rate limits', async () => {
    const bad = request('POST')
    bad.headers.set('origin', 'https://evil.example')
    expect((await handleConnector(bad, env)).status).toBe(403)
    const limited = request('POST')
    limited.headers.set('cf-connecting-ip', '192.0.2.1')
    expect((await handleConnector(limited, { ...env, MCP_RATE_LIMITER: { limit: async () => ({ success: false }) } })).status).toBe(429)
  })
  it('verifies signatures and runs initialization and tool discovery over stateless HTTP', async () => {
    const pair = await generateKeyPair('ES256')
    const key = { ...await exportJWK(pair.publicKey), kid: 'test-key', alg: 'ES256', use: 'sig' }
    const fetchMock = vi.fn(async () => Response.json({ keys: [key] }))
    vi.stubGlobal('fetch', fetchMock)
    const token = await new SignJWT(claims()).setProtectedHeader({ alg: 'ES256', kid: 'test-key' }).sign(pair.privateKey)
    const initialized = await handleConnector(request('POST', '/mcp', token, rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' } })), env)
    expect(initialized.status).toBe(200)
    expect(await initialized.json()).toMatchObject({ result: { serverInfo: { name: 'stowaway' } } })
    const listed = await handleConnector(request('POST', '/mcp', token, rpc('tools/list')), env)
    expect(listed.status).toBe(200)
    const tools = (await listed.json() as { result: { tools: { securitySchemes: unknown }[] } }).result.tools
    expect(tools).toHaveLength(2)
    expect(tools[0]!.securitySchemes).toEqual([{ type: 'oauth2', scopes: ['openid'] }])
    const forged = await new SignJWT(claims()).setProtectedHeader({ alg: 'ES256', kid: 'test-key' }).sign((await generateKeyPair('ES256')).privateKey)
    expect((await handleConnector(request('POST', '/mcp', forged, rpc('tools/list')), env)).status).toBe(401)
  })
})

describe('read-only trip tools', () => {
  it('declares schemas, OAuth and read-only annotations for both tools', async () => {
    await withClient(async (client) => {
      const { tools } = await client.listTools()
      expect(tools.map((tool) => tool.name)).toEqual(['list_trips', 'get_itinerary'])
      for (const tool of tools) {
        expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false })
        expect(tool._meta?.securitySchemes).toEqual([{ type: 'oauth2', scopes: ['openid'] }])
        expect(tool.outputSchema).toBeDefined()
      }
    })
  })
  it('paginates trips using the caller token, excluding invitation secrets', async () => {
    const mock = vi.fn(async () => Response.json([{ id: tripId }, { id: 'next-trip' }]))
    vi.stubGlobal('fetch', mock)
    await withClient(async (client) => {
      const result = await client.callTool({ name: 'list_trips', arguments: { limit: 1 } })
      expect(result.structuredContent).toMatchObject({ trips: [{ id: tripId }], hasMore: true, nextOffset: 1 })
      const [url, options] = mock.mock.calls[0] as unknown as [URL, RequestInit]
      expect(url.searchParams.get('deleted_at')).toBe('is.null')
      expect(url.searchParams.get('select')).not.toContain('share_token')
      expect(options.headers).toMatchObject({ Authorization: 'Bearer caller-token' })
    })
  })
  it('does not query an itinerary if the trip is unavailable', async () => {
    const mock = vi.fn(async () => Response.json([]))
    vi.stubGlobal('fetch', mock)
    await withClient(async (client) => {
      const result = await client.callTool({ name: 'get_itinerary', arguments: { tripId } })
      expect(result.isError).toBe(true)
      expect(mock).toHaveBeenCalledTimes(1)
    })
  })
  it('preserves local timezones, filters inclusive dates and excludes sensitive fields', async () => {
    const item = { title: 'Dinner', start_local: '2027-03-14T19:00:00', start_tz: 'America/Guatemala' }
    const mock = vi.fn().mockResolvedValueOnce(Response.json([{ id: tripId }])).mockResolvedValueOnce(Response.json([item]))
    vi.stubGlobal('fetch', mock)
    await withClient(async (client) => {
      const result = await client.callTool({ name: 'get_itinerary', arguments: { tripId, startDate: '2027-03-14', endDate: '2027-03-14' } })
      expect(result.structuredContent).toMatchObject({ items: [item], hasMore: false })
      const url = mock.mock.calls[1]![0] as URL
      expect(url.searchParams.get('and')).toBe('(start_local.gte.2027-03-14T00:00:00,start_local.lt.2027-03-15T00:00:00)')
      expect(url.searchParams.get('select')).not.toMatch(/confirmation_code|notes|details/)
    })
  })
  it('rejects invalid dates and reversed ranges before any data query', async () => {
    const mock = vi.fn()
    vi.stubGlobal('fetch', mock)
    await withClient(async (client) => {
      for (const args of [{ tripId: 'invalid' }, { tripId, startDate: '2027-02-30' }, { tripId, startDate: '2027-04-01', endDate: '2027-03-01' }]) {
        expect((await client.callTool({ name: 'get_itinerary', arguments: args })).isError).toBe(true)
      }
      expect(mock).not.toHaveBeenCalled()
    })
  })
  it('returns a recoverable error without upstream bodies or secrets', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('secret provider details', { status: 500 })))
    await withClient(async (client) => {
      const result = await client.callTool({ name: 'list_trips', arguments: {} })
      expect(result.isError).toBe(true)
      expect(JSON.stringify(result)).not.toContain('secret provider details')
    })
  })
})
