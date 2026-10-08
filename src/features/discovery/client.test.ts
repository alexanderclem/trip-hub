import { afterEach, expect, it, vi } from 'vitest'
import { requestAI } from './client'
import { ensureSession, supabase } from '@/lib/supabase'
vi.mock('@/lib/supabase', () => ({ ensureSession: vi.fn(), supabase: { auth: { getSession: vi.fn() } } }))
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('times out even when session validation never finishes', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('navigator', { onLine: true })
  vi.mocked(ensureSession).mockImplementation(() => new Promise(() => {}))
  const pending = expect(requestAI({ action: 'profile', description: 'Hiking' })).rejects.toThrow('took too long')
  await vi.advanceTimersByTimeAsync(90000)
  await pending
})
it('cancels while waiting for a session without sending an AI request later', async () => {
  vi.stubGlobal('navigator', { onLine: true })
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  let finish!: (id: string) => void
  vi.mocked(ensureSession).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null })
  const controller = new AbortController()
  const pending = expect(requestAI({ action: 'profile', description: 'Hiking' }, controller.signal)).rejects.toThrow('cancelled')
  controller.abort()
  await pending
  finish('user')
  await Promise.resolve()
  await Promise.resolve()
  expect(fetchMock).not.toHaveBeenCalled()
})
