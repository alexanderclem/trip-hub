import { describe, expect, it } from 'vitest'
import {
  checkLocalTime,
  dayKey,
  findConflicts,
  formatInZone,
  toInstant,
  tripDays,
  type TimedItem,
} from './time'

const GT = 'America/Guatemala'
const CHI = 'America/Chicago'
const NY = 'America/New_York'
const TOKYO = 'Asia/Tokyo'

describe('local time + zone → instant', () => {
  it('Guatemala is UTC−6 with no DST', () => {
    expect(toInstant('2027-03-15T09:30', GT)).toBe('2027-03-15T15:30:00.000Z')
    expect(toInstant('2027-07-15T09:30', GT)).toBe('2027-07-15T15:30:00.000Z')
  })

  it('flags the US spring-forward gap on 2027-03-14', () => {
    const r = checkLocalTime('2027-03-14T02:30', NY)
    expect(r.kind).toBe('gap')
    expect(formatInZone(r.instant, NY)).toBe('03:30')
  })

  it('flags the US fall-back ambiguity and, like Postgres, picks the later (standard-time) instant', () => {
    const r = checkLocalTime('2027-11-07T01:30', NY)
    expect(r.kind).toBe('ambiguous')
    if (r.kind !== 'ambiguous') return
    expect(r.instant).toBe('2027-11-07T06:30:00.000Z') // EST, same as the server trigger
    expect(r.alternative).toBe('2027-11-07T05:30:00.000Z') // EDT
  })

  it('accepts the server format with seconds', () => {
    expect(toInstant('2027-03-15T09:30:00', GT)).toBe(toInstant('2027-03-15T09:30', GT))
  })

  it('normal times are ok', () => {
    expect(checkLocalTime('2027-03-14T12:00', NY).kind).toBe('ok')
  })

  it('rejects bad input', () => {
    expect(() => toInstant('not a time', GT)).toThrow()
    expect(() => toInstant('2027-03-14T12:00', 'Mars/Olympus')).toThrow()
  })
})

describe('the local / destination toggle', () => {
  // GUA 07:10 departure, ORD 12:05 arrival (Chicago is on CDT, UTC−5, after 14 Mar).
  const flight = {
    start_at: toInstant('2027-03-21T07:10', GT),
    end_at: toInstant('2027-03-21T12:05', CHI),
  }

  it('shows trip time', () => {
    expect(formatInZone(flight.start_at, GT)).toBe('07:10')
    expect(formatInZone(flight.end_at, GT)).toBe('11:05')
  })

  it("shows the viewer's phone time", () => {
    expect(formatInZone(flight.start_at, NY)).toBe('09:10')
    expect(formatInZone(flight.end_at, NY)).toBe('13:05')
    expect(formatInZone(flight.start_at, TOKYO)).toBe('22:10')
  })

  it('groups items into days in the display zone', () => {
    const lateDinner = toInstant('2027-03-15T21:00', GT) // 03:00Z next day
    expect(dayKey(lateDinner, GT)).toBe('2027-03-15')
    expect(dayKey(lateDinner, TOKYO)).toBe('2027-03-16')
  })
})

describe('tripDays', () => {
  it('lists every day inclusive', () => {
    expect(tripDays('2027-03-13', '2027-03-16')).toEqual([
      '2027-03-13',
      '2027-03-14',
      '2027-03-15',
      '2027-03-16',
    ])
  })
})

describe('findConflicts', () => {
  const at = (hhmm: string) => toInstant(`2027-03-15T${hhmm}`, GT)
  const item = (id: string, s: string, e: string | null, over: Partial<TimedItem> = {}) => ({
    id,
    start_at: at(s),
    end_at: e ? at(e) : null,
    ...over,
  })

  it('finds overlapping items', () => {
    expect(
      findConflicts([item('a', '09:00', '11:00'), item('b', '10:30', '12:00'), item('c', '12:00', '13:00')]),
    ).toEqual([['a', 'b']])
  })

  it('back-to-back is not a conflict', () => {
    expect(findConflicts([item('a', '09:00', '10:00'), item('b', '10:00', '11:00')])).toEqual([])
  })

  it('an item with no end counts as one hour', () => {
    expect(findConflicts([item('a', '09:00', null), item('b', '09:45', '10:30')])).toEqual([['a', 'b']])
  })

  it('different people doing different things is not a conflict', () => {
    expect(
      findConflicts([
        item('a', '09:00', '11:00', { attendee_ids: ['ana', 'ben'] }),
        item('b', '10:00', '12:00', { attendee_ids: ['cy'] }),
      ]),
    ).toEqual([])
  })

  it('ignores cancelled, all-day and lodging items', () => {
    expect(
      findConflicts([
        item('a', '09:00', '11:00'),
        item('b', '10:00', '12:00', { status: 'cancelled' }),
        item('c', '10:00', '12:00', { all_day: true }),
        item('d', '00:00', '23:00', { kind: 'lodging' }),
      ]),
    ).toEqual([])
  })
})
