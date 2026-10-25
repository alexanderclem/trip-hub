import { describe, expect, it } from 'vitest'
import { tripPhase } from './phase'

const dates = { start_date: '2027-03-13', end_date: '2027-03-20', timezone: 'America/Guatemala' }
const at = (iso: string) => Date.parse(iso)

describe('Home priority in the trip’s time zone', () => {
  it('keeps undated trips in planning mode', () => {
    expect(tripPhase({ ...dates, start_date: null, end_date: null }, at('2027-03-13T18:00:00Z'))).toBe('planning')
  })
  it('starts preparation seven calendar days before departure', () => {
    expect(tripPhase(dates, at('2027-03-06T05:59:59Z'))).toBe('planning')
    expect(tripPhase(dates, at('2027-03-06T06:00:00Z'))).toBe('preparing')
  })
  it('prioritizes travel only from local departure midnight through the last day', () => {
    expect(tripPhase(dates, at('2027-03-13T05:59:59Z'))).toBe('preparing')
    expect(tripPhase(dates, at('2027-03-13T06:00:00Z'))).toBe('traveling')
    expect(tripPhase(dates, at('2027-03-21T05:59:59Z'))).toBe('traveling')
    expect(tripPhase(dates, at('2027-03-21T06:00:00Z'))).toBe('complete')
  })
  it('treats a trip with only a start date as one day, not permanently traveling', () => {
    expect(tripPhase({ ...dates, end_date: null }, at('2027-03-14T06:00:00Z'))).toBe('complete')
  })
  it('handles the US DST change with calendar days rather than 168-hour arithmetic', () => {
    const ny = { start_date: '2027-03-20', end_date: '2027-03-21', timezone: 'America/New_York' }
    expect(tripPhase(ny, at('2027-03-13T05:00:00Z'))).toBe('preparing')
    expect(tripPhase(ny, at('2027-03-20T03:59:59Z'))).toBe('preparing')
    expect(tripPhase(ny, at('2027-03-20T04:00:00Z'))).toBe('traveling')
  })
})
