import { describe, expect, it } from 'vitest'
import type { ItineraryItem } from '@/data/types'
import { toInstant } from '@/lib/time'
import { layoutDay, onDay, planDays } from './layout'

const GT = 'America/Guatemala'
const NY = 'America/New_York'

function item(id: string, start: string, end: string | null, over: Partial<ItineraryItem> = {}): ItineraryItem {
  const startTz = over.start_tz ?? GT
  const endTz = over.end_tz ?? startTz
  return {
    id, trip_id: 't', title: id, kind: 'activity', place_id: null, to_place_id: null, all_day: false,
    start_local: start, start_tz: startTz, end_local: end, end_tz: end ? endTz : null,
    start_at: toInstant(start, startTz), end_at: end ? toInstant(end, endTz) : null,
    status: 'confirmed', confirmation_code: null, attendee_ids: null, details: {}, notes: null,
    est_cost_minor: null, est_cost_currency: null, ...over,
  }
}

describe('layoutDay', () => {
  it('positions items in minutes from midnight, in the display zone', () => {
    const d = layoutDay([item('breakfast', '2027-03-15T08:00', '2027-03-15T09:00')], '2027-03-15', GT)
    expect(d.blocks[0]).toMatchObject({ startMin: 480, endMin: 540, lane: 0, lanes: 1 })
    // Same item seen from New York (EDT, UTC−4) is two hours later.
    const ny = layoutDay([item('breakfast', '2027-03-15T08:00', '2027-03-15T09:00')], '2027-03-15', NY)
    expect(ny.blocks[0]).toMatchObject({ startMin: 600, endMin: 660 })
  })

  it('puts overlapping items side by side and flags the conflict', () => {
    const d = layoutDay(
      [
        item('volcano', '2027-03-15T05:00', '2027-03-15T12:00'),
        item('coffee tour', '2027-03-15T10:00', '2027-03-15T13:00'),
        item('lunch', '2027-03-15T13:00', '2027-03-15T14:00'),
      ],
      '2027-03-15',
      GT,
    )
    const by = Object.fromEntries(d.blocks.map((b) => [b.item.id, b]))
    expect(by.volcano).toMatchObject({ lane: 0, lanes: 2, conflict: true })
    expect(by['coffee tour']).toMatchObject({ lane: 1, lanes: 2, conflict: true })
    expect(by.lunch).toMatchObject({ lane: 0, lanes: 1, conflict: false }) // back-to-back is fine
    expect(d.fromHour).toBe(5) // widened for the 5 am start
  })

  it('people doing different things at the same time is not a conflict', () => {
    const d = layoutDay(
      [
        item('spa', '2027-03-15T10:00', '2027-03-15T12:00', { attendee_ids: ['ana'] }),
        item('hike', '2027-03-15T10:00', '2027-03-15T12:00', { attendee_ids: ['ben'] }),
      ],
      '2027-03-15',
      GT,
    )
    expect(d.blocks.map((b) => [b.lanes, b.conflict])).toEqual([[2, false], [2, false]])
  })

  it('an overnight bus shows on both days, clipped, marked as continuing', () => {
    const bus = item('night bus to Flores', '2027-03-16T21:00', '2027-03-17T07:00', { kind: 'transport' })
    const d1 = layoutDay([bus], '2027-03-16', GT)
    const d2 = layoutDay([bus], '2027-03-17', GT)
    expect(d1.blocks[0]).toMatchObject({ startMin: 1260, endMin: 1440, continuesAfter: true, continuesBefore: false })
    expect(d2.blocks[0]).toMatchObject({ startMin: 0, endMin: 420, continuesBefore: true })
  })

  it('lodging is a "staying at" banner on each night, not a block; checkout day excluded', () => {
    const stay = item('Casa Atitlan', '2027-03-17T15:00', '2027-03-19T11:00', { kind: 'lodging' })
    expect(layoutDay([stay], '2027-03-17', GT).stays.map((s) => s.id)).toEqual(['Casa Atitlan'])
    expect(layoutDay([stay], '2027-03-18', GT).stays).toHaveLength(1)
    expect(layoutDay([stay], '2027-03-19', GT).stays).toHaveLength(0)
    expect(layoutDay([stay], '2027-03-17', GT).blocks).toHaveLength(0)
  })

  it('all-day items use their date, whatever the display zone', () => {
    const market = item('Chichicastenango market', '2027-03-18T00:00', null, { all_day: true })
    expect(onDay(market, '2027-03-18', 'Asia/Tokyo')).toBe(true)
    expect(layoutDay([market], '2027-03-18', GT).allDay).toHaveLength(1)
  })

  it('leaves out cancelled and deleted items', () => {
    const d = layoutDay(
      [item('a', '2027-03-15T09:00', null, { status: 'cancelled' }), item('b', '2027-03-15T09:00', null, { deleted_at: 'x' })],
      '2027-03-15',
      GT,
    )
    expect(d.blocks).toEqual([])
  })
})

describe('planDays', () => {
  it('covers the trip dates and any item outside them', () => {
    const early = item('flight', '2027-03-12T23:00', '2027-03-13T06:00')
    expect(planDays('2027-03-13', '2027-03-15', [early], GT)).toEqual(['2027-03-12', '2027-03-13', '2027-03-14', '2027-03-15'])
  })
})
