import { describe, expect, it } from 'vitest'
import { tripCover, tripStatus } from './presentation'

const trip = { start_date: '2027-03-15', end_date: '2027-03-18', timezone: 'America/New_York' }
describe('trip journal labels', () => {
  it('counts calendar days across DST in the destination zone', () => {
    expect(tripStatus(trip, Date.parse('2027-03-14T04:30:00Z')).label).toBe('In 2 days')
    expect(tripStatus(trip, Date.parse('2027-03-14T05:30:00Z')).label).toBe('In 1 day')
    expect(tripStatus(trip, Date.parse('2027-03-15T03:59:00Z')).label).toBe('In 1 day')
    expect(tripStatus(trip, Date.parse('2027-03-15T04:00:00Z')).label).toBe('Traveling now')
    expect(tripStatus(trip, Date.parse('2027-03-19T04:00:00Z')).phase).toBe('complete')
  })
  it('never invents a countdown for undated or invalid trips', () => {
    expect(tripStatus({ ...trip, start_date: null }, Date.now()).label).toBe('Dates to come')
    expect(tripStatus({ ...trip, start_date: 'not a date' }, Date.now()).label).toBe('Dates to come')
  })
  it('honors plain covers and safely falls back for unknown synced values', () => {
    expect(tripCover({ id: 'abc', settings: { journal_cover: 'none' } })).toBe('none')
    expect(tripCover({ id: 'abc', settings: { journal_cover: 'mountains' } })).toBe('mountains')
    expect(tripCover({ id: 'abc', settings: { journal_cover: '<invalid>' } })).toBe(tripCover({ id: 'abc', settings: {} }))
  })
})
