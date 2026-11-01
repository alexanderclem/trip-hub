import { describe, expect, it } from 'vitest'
import { can, GROUP_ACCESS, needsRefetch, newAttachmentAccess, parseAccess, writeRefusal, type Capability, type TripAccess } from './access'

const CAPS: Capability[] = ['read', 'participate', 'plan', 'money', 'docs', 'roster', 'staff']
const hosted = (role: TripAccess['role']): TripAccess => ({ ...GROUP_ACCESS, mode: 'hosted', role })
const allowed = (a: TripAccess) => CAPS.filter((c) => can(a, c))

describe('capabilities (mirror of private.can)', () => {
  it('gives everyone in a group trip everything except organizing', () => {
    expect(allowed(GROUP_ACCESS)).toEqual(['read', 'participate', 'plan', 'money', 'docs', 'roster'])
    expect(allowed({ ...GROUP_ACCESS, role: 'owner' })).toEqual(CAPS)
  })
  it('splits roles in a hosted trip', () => {
    expect(allowed(hosted('owner'))).toEqual(CAPS)
    expect(allowed(hosted('admin'))).toEqual(CAPS)
    expect(allowed(hosted('traveler'))).toEqual(['read', 'participate'])
    expect(allowed(hosted('viewer'))).toEqual(['read'])
    expect(allowed(hosted('pending'))).toEqual([])
  })
  it('gives nothing to a removed phone or one that never joined', () => {
    expect(allowed({ ...GROUP_ACCESS, removed: true })).toEqual([])
    expect(allowed({ ...GROUP_ACCESS, role: null })).toEqual([])
  })
})

describe('refetching after an access change', () => {
  it('refetches when the role, mode or epoch changes, never on the first answer', () => {
    expect(needsRefetch(undefined, hosted('traveler'))).toBe(false)
    expect(needsRefetch(GROUP_ACCESS, GROUP_ACCESS)).toBe(false)
    expect(needsRefetch(GROUP_ACCESS, { ...GROUP_ACCESS, epoch: 1 })).toBe(true)
    expect(needsRefetch(hosted('pending'), hosted('traveler'))).toBe(true)
  })
})

describe('parsing the server answer', () => {
  it('reads my_trip_access', () => {
    expect(parseAccess({ role: 'traveler', mode: 'hosted', epoch: 2, removed: false, can_remove: false, organized: true, removed_members: null }))
      .toEqual({ role: 'traveler', mode: 'hosted', epoch: 2, removed: false, canRemove: false, organized: true, removedMembers: [] })
    expect(parseAccess(null)).toBeNull()
  })
})

describe('refusing writes the server would refuse', () => {
  const me = 'me'
  const traveler = hosted('traveler')
  it('never refuses anything new in a group trip, or anything for organizers', () => {
    expect(writeRefusal(GROUP_ACCESS, 'places', { trip_id: 't' }, me)).toBeNull()
    expect(writeRefusal(hosted('owner'), 'expenses', { trip_id: 't', payers: [], split: [] }, me)).toBeNull()
  })
  it('keeps hosted travelers to their own things', () => {
    expect(writeRefusal(traveler, 'itinerary_items', {}, me)).toMatch(/organizers/)
    expect(writeRefusal(traveler, 'poll_votes', { member_id: me }, me)).toBeNull()
    expect(writeRefusal(traveler, 'poll_votes', { member_id: 'ben' }, me)).toMatch(/your own/)
    expect(writeRefusal(traveler, 'packing_items', { kind: 'personal', owner_id: me }, me)).toBeNull()
    expect(writeRefusal(traveler, 'packing_items', { kind: 'group' }, me)).toMatch(/organizers/)
    expect(writeRefusal(traveler, 'expenses', { created_by: 'ana', payers: [{ member_id: 'ana' }], split: [{ member_id: me }] }, me)).toBeNull()
    expect(writeRefusal(traveler, 'expenses', { created_by: 'ana', payers: [{ member_id: 'ana' }], split: [{ member_id: 'cy' }] }, me)).toMatch(/your own/)
    expect(writeRefusal(traveler, 'attachments', { owner_member_id: me, visibility: 'owner' }, me)).toBeNull()
    expect(writeRefusal(traveler, 'route_legs', {}, me)).toBeNull()
  })
  it('lets viewers and people waiting change nothing', () => {
    expect(writeRefusal(hosted('viewer'), 'poll_votes', { member_id: me }, me)).toMatch(/look at/)
    expect(writeRefusal(hosted('pending'), 'members', { id: me }, me)).toMatch(/let you in/)
    expect(writeRefusal({ ...GROUP_ACCESS, removed: true }, 'places', {}, me)).toMatch(/removed/)
  })
})

describe('new documents', () => {
  it('stay private to a hosted traveler, shared for organizers, and untouched in group trips', () => {
    expect(newAttachmentAccess(GROUP_ACCESS, 'me')).toEqual({})
    expect(newAttachmentAccess(hosted('traveler'), 'me')).toEqual({ visibility: 'owner', owner_member_id: 'me' })
    expect(newAttachmentAccess(hosted('owner'), 'me')).toEqual({ visibility: 'trip', owner_member_id: 'me' })
  })
})
