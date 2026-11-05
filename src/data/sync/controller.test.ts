// syncNow never rejects (it reports through useSyncStatus). syncNowChecked must reject whenever the
// cycle did not actually send this phone's changes and pull fresh data, so "Ready for offline"
// cannot record a failed refresh as verified.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TripAccess } from '../access'

const engine = vi.hoisted(() => ({
  push: vi.fn(async () => ({ retryLater: false, deadLettered: 0 })),
  pull: vi.fn(async (..._args: unknown[]) => ({ error: null as null | { message: string } })),
  rejected: vi.fn(async () => 0),
  access: vi.fn(async (): Promise<TripAccess | 'unknown'> => 'unknown'),
  refetch: vi.fn(() => false),
  dropped: vi.fn(async () => {}),
}))
vi.mock('./engine', () => ({ push: engine.push, pull: engine.pull, resetBackoff: vi.fn(async () => {}), SYNCED_TABLES: ['trips', 'members', 'places', 'comments'] }))
vi.mock('./remote', () => ({ supabaseRemote: {} }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('../db', () => ({ db: { _outbox: { orderBy: () => ({ first: async () => ({ lastError: 'Server busy' }) }), filter: () => ({ count: async () => 0 }) }, _deadletter: { filter: () => ({ count: engine.rejected }) } } }))
vi.mock('../access', () => ({ fetchAccess: engine.access, needsRefetch: engine.refetch }))
vi.mock('../device', () => ({ useDevice: { getState: () => ({ access: {}, setAccess: () => {} }) } }))
vi.mock('../reset', () => ({ dropTrip: engine.dropped }))
vi.mock('@/features/notifications/reminders', () => ({ publishReminders: vi.fn(async () => {}) }))
vi.mock('@/features/funnel/events', () => ({ flushEvents: vi.fn(async () => {}), sendToSupabase: {} }))

const { syncNow, syncNowChecked, useSyncStatus } = await import('./controller')
const TRIP = '00000000-0000-4000-8000-000000000001'
let online = true

beforeEach(() => {
  online = true
  vi.stubGlobal('navigator', { get onLine() { return online } })
  engine.push.mockReset().mockResolvedValue({ retryLater: false, deadLettered: 0 })
  engine.pull.mockReset().mockResolvedValue({ error: null })
  engine.rejected.mockReset().mockResolvedValue(0)
  engine.access.mockReset().mockResolvedValue('unknown')
  engine.refetch.mockReset().mockReturnValue(false)
  engine.dropped.mockClear()
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
    engine.push.mockResolvedValue({ retryLater: true, deadLettered: 0 })
    await expect(syncNowChecked(TRIP)).rejects.toThrow(/haven't been shared yet: Server busy/)
  })
  it('rejects when the engine throws', async () => {
    engine.push.mockRejectedValue(new Error('aborted'))
    await expect(syncNowChecked(TRIP)).rejects.toThrow('aborted')
  })
  it('does not claim completion after a rejected write and successful pull', async () => {
    engine.push.mockResolvedValue({ retryLater: false, deadLettered: 1 })
    engine.rejected.mockResolvedValue(1)
    await expect(syncNowChecked(TRIP)).rejects.toThrow(/saved changes need review/)
    expect(engine.pull).toHaveBeenCalled()
    expect(useSyncStatus.getState().phase).toBe('error')
  })
  it('keeps unresolved rejections visible on later successful cycles', async () => {
    engine.rejected.mockResolvedValue(1)
    await expect(syncNowChecked(TRIP)).rejects.toThrow(/saved changes need review/)
    engine.rejected.mockResolvedValue(0)
    await expect(syncNowChecked(TRIP)).resolves.toBeUndefined()
  })
  it('pulls only tables hinted by realtime, in dependency order', async () => {
    await syncNow(TRIP, ['comments', 'places'])
    expect(engine.pull.mock.calls[0]?.[3]).toEqual(['places', 'comments'])
  })
  it('fully rehydrates after a permission change even when only one table was hinted', async () => {
    engine.access.mockResolvedValue({ role: 'traveler', mode: 'hosted', epoch: 2, removed: false, canRemove: false, organized: true, removedMembers: [] })
    engine.refetch.mockReturnValue(true)
    await syncNow(TRIP, ['comments'])
    expect(engine.dropped).toHaveBeenCalledWith(TRIP)
    expect(engine.pull.mock.calls[0]?.[3]).toBeUndefined()
  })
  it('does not pull again after access was removed', async () => {
    engine.access.mockResolvedValue({ role: null, mode: 'hosted', epoch: 2, removed: true, canRemove: false, organized: true, removedMembers: [] })
    await expect(syncNowChecked(TRIP)).rejects.toThrow(/no longer have access/)
    expect(engine.dropped).toHaveBeenCalledWith(TRIP)
    expect(engine.pull).not.toHaveBeenCalled()
  })
  it('coalesces pending hints without downgrading a full refresh', async () => {
    let release!: () => void
    engine.push.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ retryLater: false, deadLettered: 0 }) }))
    const running = syncNow(TRIP, ['comments'])
    void syncNow(TRIP, ['places'])
    void syncNow(TRIP)
    void syncNow(TRIP, ['comments'])
    release()
    await running
    expect(engine.pull.mock.calls).toHaveLength(2)
    expect(engine.pull.mock.calls[0]?.[3]).toEqual(['comments'])
    expect(engine.pull.mock.calls[1]?.[3]).toBeUndefined()
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
