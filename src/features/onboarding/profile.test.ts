import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/data/db'
import { useDevice } from '@/data/device'
import { NEUTRAL } from '@/features/discovery/model'
import { saveProfile } from '@/features/discovery/data'
import { afterEntry } from './profile'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const trip = '00000000-0000-4000-8000-000000000001'
const member = '00000000-0000-4000-8000-000000000002'
const path = `/t/${trip}/overview?joined=1`

beforeEach(() => {
  vi.stubGlobal('navigator', { onLine: true })
  useDevice.setState({ trips: { [trip]: { tripId: trip, memberId: member } } as never, travelProfile: null, quizSeen: false })
})
afterEach(async () => {
  vi.unstubAllGlobals()
  await db.member_preferences.clear()
  await db._outbox.clear()
})

describe('where someone lands after creating or joining a trip', () => {
  it('sends a new person to the quiz, which then continues to the trip', async () => {
    expect(await afterEntry(path)).toBe(`/quiz?next=${encodeURIComponent(path)}`)
  })

  it('goes straight to the trip once the quiz was taken or skipped', async () => {
    useDevice.getState().setQuizSeen()
    expect(await afterEntry(path)).toBe(path)
  })

  it('adopts a profile this person already has in the trip instead of asking again', async () => {
    await saveProfile(trip, member, { scores: { ...NEUTRAL }, description: 'Slow mornings', constraints: '' })
    expect(await afterEntry(path)).toBe(path)
    expect(useDevice.getState().travelProfile?.description).toBe('Slow mornings')
  })

  it('opens the trip when there is no signal', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    expect(await afterEntry(path)).toBe(path)
  })
})
