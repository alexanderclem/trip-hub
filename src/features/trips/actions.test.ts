import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ ensureSession: vi.fn(), rpc: vi.fn(), setMember: vi.fn(), pull: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ ensureSession: mocks.ensureSession, supabase: { rpc: mocks.rpc } }))
vi.mock('@/data/device', () => ({ useDevice: { getState: () => ({ setMember: mocks.setMember }) } }))
vi.mock('@/data/sync/engine', () => ({ pull: mocks.pull }))
import { claimMember, createMemberAndClaim } from './actions'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.ensureSession.mockResolvedValue('signed-in-user')
  mocks.rpc.mockResolvedValue({ error: null })
  mocks.pull.mockResolvedValue({ error: null })
})

describe('claiming a trip identity', () => {
  it('checks the session before adding a traveler', async () => {
    await createMemberAndClaim('trip-id', '  Alex  ', '#295361')
    expect(mocks.ensureSession).toHaveBeenCalledOnce()
    expect(mocks.ensureSession.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]!)
    expect(mocks.rpc).toHaveBeenCalledWith('create_member_and_claim', expect.objectContaining({ p_trip_id: 'trip-id', p_name: 'Alex' }))
    expect(mocks.setMember).toHaveBeenCalledOnce()
    expect(mocks.pull).toHaveBeenCalledOnce()
  })
  it('checks the session before claiming an existing member', async () => {
    await claimMember('trip-id', 'member-id')
    expect(mocks.ensureSession.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]!)
    expect(mocks.setMember).toHaveBeenCalledWith('trip-id', 'member-id')
  })
  it('does not call a protected RPC when sign-in fails', async () => {
    mocks.ensureSession.mockRejectedValue(new Error('Could not sign in'))
    await expect(createMemberAndClaim('trip-id', 'Alex', '#295361')).rejects.toThrow('Could not sign in')
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.setMember).not.toHaveBeenCalled()
  })
  it('does not claim the identity locally if the server rejects the request', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'permission denied for function create_member_and_claim' } })
    await expect(createMemberAndClaim('trip-id', 'Alex', '#295361')).rejects.toThrow('permission denied')
    expect(mocks.setMember).not.toHaveBeenCalled()
    expect(mocks.pull).not.toHaveBeenCalled()
  })
})
