// syncNow never rejects (it reports through useSyncStatus). syncNowChecked must reject whenever the
// cycle did not actually send this phone's changes and pull fresh data, so "Ready for offline"
// cannot record a failed refresh as verified.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const engine = vi.hoisted(() => ({
  push: vi.fn(async () => ({ retryLater: false })),
  pull: vi.fn(async () => ({ error: null as null | { message: string } })),
}))
vi.mock('./engine', () => ({ push: engine.push, pull: engine.pull, resetBackoff: vi.fn(async () => {}), SYNCED_TABLES: [] }))
vi.mock('./remote', () => ({ supabaseRemote: {} }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('../db', () => ({ db: { _outbox: { orderBy: () => ({ first: async () => ({ lastError: 'Server busy' }) }) } } }))
vi.mock('../access', () => ({ fetchAccess: vi.fn(async () => 'unknown'), needsRefetch: () => false }))
vi.mock('../device', () => ({ useDevice: { getState: () => ({ access: {}, setAccess: () => {} }) } }))
vi.mock('../reset', () => ({ dropTrip: vi.fn() }))
vi.mock('@/features/notifications/reminders', () => ({ publishReminders: vi.fn(async () => {}) }))
vi.mock('@/features/funnel/events', () => ({ flushEvents: vi.fn(async () => {}), sendToSupabase: {} }))

const { syncNow, syncNowChecked, useSyncStatus } = await import('./controller')
const TRIP = '00000000-0000-4000-8000-000000000001'
let online = true

beforeEach(() => {
  online = true
  vi.stubGlobal('navigator', { get onLine() { return online } })
  engine.push.mockReset().mockResolvedValue({ retryLater: false })
  engine.pull.mockReset().mockResolvedValue({ error: null })
})

describe('syncNowChecked', () => {
  it('resolves after a clean push and pull', async () => {
    await expect(syncNowChecked(TRIP)).resolves.toBeUndefined()
    expect(useSyncStatus.getState().phase).toBe('idle')
  })
  it('rejects when the pull fails, though syncNow still resolves', async () => {
    engine.pull.mockResolvedValue({ error: { message: 'timeout' } })
    await expect(syncNow(TRIP)).resolves.toBeUndefined()
    await expect(syncNowChecked(TRIP)).rejects.toThrow(/latest trip data: timeout/)
  })
  it('rejects when changes are still waiting to be sent', async () => {
    engine.push.mockResolvedValue({ retryLater: true })
    await expect(syncNowChecked(TRIP)).rejects.toThrow(/haven't been shared yet: Server busy/)
  })
  it('rejects when the engine throws', async () => {
    engine.push.mockRejectedValue(new Error('aborted'))
    await expect(syncNowChecked(TRIP)).rejects.toThrow('aborted')
  })
  it('rejects offline', async () => {
    online = false
    await expect(syncNowChecked(TRIP)).rejects.toThrow(/offline/)
  })
  it('does not reuse an earlier success', async () => {
    await syncNowChecked(TRIP)
    engine.pull.mockResolvedValue({ error: { message: 'gone' } })
    await expect(syncNowChecked(TRIP)).rejects.toThrow(/gone/)
  })
})
