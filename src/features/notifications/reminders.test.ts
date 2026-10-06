import { describe, expect, it, vi } from 'vitest'
import type { ItineraryItem, Place } from '@/data/types'
import type { Transfer } from '@/features/itinerary/travel'
import { remindersFor } from './reminders'

// Reminder formatting is independent of the backend client and its credentials.
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }))

const now = Date.parse('2027-03-15T14:00:00Z')
const item = (id: string, start: string) => ({ id, start_at: start }) as ItineraryItem
const place = (name: string) => ({ name }) as Place

function transfer(toId: string, start: string, leaveAt: number, memberIds: string[]): Transfer {
  return {
    from: item('prev', '2027-03-15T13:00:00Z'), to: item(toId, start), fromPlace: place('Panajachel dock'), toPlace: place('San Marcos'),
    option: { mode: 'boat', minS: 1500, maxS: 2400, source: 'typical', distanceM: null }, gapS: null, leaveAt, memberIds,
  } as Transfer
}

describe('remindersFor', () => {
  it('keeps my upcoming transfers in the next 48 hours, with a short travel note', () => {
    const rows = remindersFor([
      transfer('mine', '2027-03-15T16:00:00Z', Date.parse('2027-03-15T15:20:00Z'), ['alex', 'sam']),
      transfer('theirs', '2027-03-15T17:00:00Z', Date.parse('2027-03-15T16:20:00Z'), ['sam']),
      transfer('past', '2027-03-15T14:10:00Z', Date.parse('2027-03-15T13:30:00Z'), ['alex']),
      transfer('far', '2027-03-18T10:00:00Z', Date.parse('2027-03-18T09:00:00Z'), ['alex']),
    ], 'alex', now)
    expect(rows).toEqual([{ item_id: 'mine', leave_at: '2027-03-15T15:20:00.000Z', item_start_at: '2027-03-15T16:00:00.000Z', note: 'Lancha from Panajachel dock, 25–40 min' }])
  })

  it('treats a plan with no members yet as everyone’s', () => {
    expect(remindersFor([transfer('x', '2027-03-15T16:00:00Z', Date.parse('2027-03-15T15:00:00Z'), ['everyone'])], 'alex', now)).toHaveLength(1)
  })
})
