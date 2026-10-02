import { describe, expect, it } from 'vitest'
import { buildIcs, escapeText, foldLine } from './ics'

const NOW = '2027-03-01T12:00:00Z'
const lines = (ics: string) => ics.split('\r\n')

describe('escapeText', () => {
  it('escapes the characters calendars treat as separators', () => {
    expect(escapeText('Dinner; tacos, beer\nBring cash \\ card')).toBe('Dinner\\; tacos\\, beer\\nBring cash \\\\ card')
  })
})

describe('foldLine', () => {
  it('leaves short lines alone', () => {
    expect(foldLine('SUMMARY:Short')).toBe('SUMMARY:Short')
  })

  it('folds at 75 bytes without splitting a character', () => {
    const folded = foldLine(`SUMMARY:${'é'.repeat(80)}`)
    const parts = folded.split('\r\n')
    expect(parts.length).toBeGreaterThan(1)
    for (const p of parts) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75)
    for (const p of parts.slice(1)) expect(p.startsWith(' ')).toBe(true)
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(`SUMMARY:${'é'.repeat(80)}`)
  })
})

describe('buildIcs', () => {
  it('writes a timed event as UTC instants', () => {
    const ics = buildIcs([{ uid: 'a@stowaway', title: 'UA 1234', start: '2027-03-13T12:10:00.000Z', end: '2027-03-13T17:05:00.000Z', updatedAt: '2027-02-01T00:00:00Z' }], 'Guatemala', NOW)
    const l = lines(ics)
    expect(l[0]).toBe('BEGIN:VCALENDAR')
    expect(l).toContain('UID:a@stowaway')
    expect(l).toContain('DTSTART:20270313T121000Z')
    expect(l).toContain('DTEND:20270313T170500Z')
    expect(l).toContain('DTSTAMP:20270301T120000Z')
    expect(l).toContain('LAST-MODIFIED:20270201T000000Z')
    expect(l).toContain('STATUS:CONFIRMED')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('leaves out the end when there is none, and never writes one before the start', () => {
    const ics = buildIcs([
      { uid: 'a', title: 'Sunrise', start: '2027-03-14T11:00:00Z' },
      { uid: 'b', title: 'Odd', start: '2027-03-14T11:00:00Z', end: '2027-03-14T10:00:00Z' },
    ], 'Trip', NOW)
    expect(ics).not.toContain('DTEND')
  })

  it('writes all-day events as dates with an exclusive end', () => {
    const l = lines(buildIcs([
      { uid: 'one', title: 'Market day', start: '2027-03-15', allDay: true },
      { uid: 'stay', title: 'Casa Atitlan', start: '2027-03-15', end: '2027-03-18', allDay: true },
    ], 'Trip', NOW))
    expect(l.filter((x) => x.startsWith('DTSTART'))).toEqual(['DTSTART;VALUE=DATE:20270315', 'DTSTART;VALUE=DATE:20270315'])
    expect(l.filter((x) => x.startsWith('DTEND'))).toEqual(['DTEND;VALUE=DATE:20270316', 'DTEND;VALUE=DATE:20270319'])
  })

  it('a later edit has a higher sequence number', () => {
    const seq = (updatedAt: string) => Number(/SEQUENCE:(\d+)/.exec(buildIcs([{ uid: 'a', title: 'x', start: NOW, updatedAt }], 'Trip', NOW))![1])
    expect(seq('2027-02-02T00:00:00Z')).toBeGreaterThan(seq('2027-02-01T00:00:00Z'))
  })

  it('includes place, map position, notes and tentative status', () => {
    const l = lines(buildIcs([{
      uid: 'a', title: 'Coffee tour', start: NOW, location: 'Finca Filadelfia, Antigua', geo: { lat: 14.5801234, lng: -90.7412 },
      description: 'Code: K7XQ2P\nBring cash', url: 'https://example.test/t/1/plan/a', tentative: true,
    }], 'Trip; spring', NOW))
    expect(l).toContain('X-WR-CALNAME:Trip\\; spring')
    expect(l).toContain('LOCATION:Finca Filadelfia\\, Antigua')
    expect(l).toContain('GEO:14.580123;-90.741200')
    expect(l).toContain('DESCRIPTION:Code: K7XQ2P\\nBring cash')
    expect(l).toContain('URL:https://example.test/t/1/plan/a')
    expect(l).toContain('STATUS:TENTATIVE')
  })
})
