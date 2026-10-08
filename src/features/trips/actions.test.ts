import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ ensureSession: vi.fn(), rpc: vi.fn(), setMember: vi.fn(), pull: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ ensureSession: mocks.ensureSession, supabase: { rpc: mocks.rpc } }))
vi.mock('@/data/device', () => ({ useDevice: { getState: () => ({ setMember: mocks.setMember }) } }))
vi.mock('@/data/sync/engine', () => ({ pull: mocks.pull }))
import { claimMember, createMemberAndClaim, joinTargetQuery, parseJoinTarget, parseShareToken } from './actions'

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

describe('shared links that land on a page', () => {
  const poll = '0b9f7c1e-2a3d-4e5f-8a6b-7c8d9e0f1a2b'
  it('reads a vote target from a link or its query string', () => {
    expect(parseJoinTarget(`?to=vote/${poll}`)).toBe(`more/vote/${poll}`)
    expect(parseJoinTarget(`https://joinstowaway.app/join?to=vote/${poll.toUpperCase()}#t=abcdefghijklmnop`)).toBe(`more/vote/${poll}`)
    expect(parseJoinTarget(`?x=1&to=vote/${poll}&y=2`)).toBe(`more/vote/${poll}`)
  })
  it('ignores anything that is not a known target', () => {
    for (const bad of ['', '?to=//evil.example', '?to=more/settings', `?to=vote/${poll}/../../settings`, `?to=vote/${poll}x`, '?to=vote/not-an-id', `?into=vote/${poll}`]) {
      expect(parseJoinTarget(bad)).toBeNull()
    }
  })
  it('passes a target on unchanged, and nothing when there is none', () => {
    expect(joinTargetQuery(parseJoinTarget(`?to=vote/${poll}`))).toBe(`?to=vote/${poll}`)
    expect(joinTargetQuery(null)).toBe('')
  })
  it('keeps a pasted token readable when the link also has a target', () => {
    expect(parseShareToken(`https://joinstowaway.app/join?to=vote/${poll}#t=abcdefghijklmnop`)).toBe('abcdefghijklmnop')
  })
})
