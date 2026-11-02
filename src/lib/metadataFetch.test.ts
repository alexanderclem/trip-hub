import { afterEach, describe, expect, it, vi } from 'vitest'
import { metadataFetch, METADATA_TIMEOUT_MS } from './metadataFetch'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('metadata connection limits', () => {
  it('aborts a stalled request and clears its timer', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_input, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(init.signal!.reason))
    })))
    const result = expect(metadataFetch('https://example.com/rest/v1/trips')).rejects.toMatchObject({ name: 'TimeoutError' })
    await vi.advanceTimersByTimeAsync(METADATA_TIMEOUT_MS)
    await result
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves caller cancellation', async () => {
    const upstream = new AbortController()
    vi.stubGlobal('fetch', vi.fn((_input, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(init.signal!.reason))
    })))
    const request = metadataFetch('https://example.com/auth/v1/user', { signal: upstream.signal })
    upstream.abort(new DOMException('Cancelled', 'AbortError'))
    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('does not impose the metadata timeout on uploads or long-running functions', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetch)
    const init = { method: 'POST', body: 'file contents' }
    await metadataFetch('https://example.com/storage/v1/object/tickets', init)
    expect(fetch).toHaveBeenCalledWith('https://example.com/storage/v1/object/tickets', init)
    expect(vi.getTimerCount()).toBe(0)
  })
})
