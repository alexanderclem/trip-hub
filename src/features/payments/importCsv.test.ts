import { describe, expect, it } from 'vitest'
import { contactsFromCsv, guessMapping, parseCsv, parseDate, parseTime, planFromCsv } from './importCsv'

describe('parseCsv', () => {
  it('reads quotes, commas and line breaks inside fields, CRLF and a byte-order mark', () => {
    expect(parseCsv('﻿Name,Notes\r\n"Ola, Jr.","Said ""hi""\nthen left"\r\n\r\nPat,\n')).toEqual([
      ['Name', 'Notes'], ['Ola, Jr.', 'Said "hi"\nthen left'], ['Pat', ''],
    ])
  })
  it('detects semicolons and tabs', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']])
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('guessMapping', () => {
  it('finds columns by their usual names, each used once', () => {
    expect(guessMapping(['First Name', 'Last Name', 'E-mail', 'Tags'], ['name', 'first', 'last', 'email', 'tags'] as const))
      .toEqual({ name: null, first: 0, last: 1, email: 2, tags: 3 })
    expect(guessMapping(['Traveler name', 'Email'], ['name', 'email'] as const)).toEqual({ name: 0, email: 1 })
    expect(guessMapping(['Date', 'Start time', 'End time', 'Activity', 'Notes'], ['date', 'start', 'end', 'title', 'notes'] as const))
      .toEqual({ date: 0, start: 1, end: 2, title: 3, notes: 4 })
  })
})

describe('contactsFromCsv', () => {
  it('keeps one row per valid email, joins first and last names, and splits tags', () => {
    const rows = parseCsv('First,Last,Email,Tags\nOla,Nordmann,OLA@example.com,"VIP; repeat"\nPat,,not-an-email,\nOla,N,ola@example.com,\n,,kim@example.com,')
    expect(contactsFromCsv(rows, { name: null, first: 0, last: 1, email: 2, tags: 3 })).toEqual({
      ok: [{ name: 'Ola Nordmann', email: 'ola@example.com', tags: ['vip', 'repeat'] }, { name: 'kim', email: 'kim@example.com', tags: [] }],
      skipped: [3, 4],
    })
  })
})

describe('dates and times', () => {
  it('reads ISO, US and dotted dates, and rejects impossible ones', () => {
    expect(['2027-03-14', '3/14/2027', '14.03.2027', '2027-02-30', 'soon'].map(parseDate)).toEqual(['2027-03-14', '2027-03-14', '2027-03-14', null, null])
  })
  it('reads 24-hour and am/pm times', () => {
    expect(['14:30', '2:30 PM', '2pm', '12am', '9.15', '', '25:00', '7'].map(parseTime)).toEqual(['14:30', '14:30', '14:00', '00:00', '09:15', '', null, null])
  })
})

describe('planFromCsv', () => {
  it('makes tentative plan items in the trip zone; no start time means all day', () => {
    const rows = parseCsv('Date,Start,End,Activity,Notes\n2027-03-14,7:00 am,9:00 am,Volcano sunrise,Bring a jacket\n3/15/2027,,,Free day,\n2027-03-16,10:00,9:00,Backwards,\nbad,10:00,,Nope,')
    const { ok, skipped } = planFromCsv(rows, { date: 0, start: 1, end: 2, title: 3, notes: 4 }, 'trip', 'America/Guatemala')
    expect(ok.map((i) => [i.title, i.start_local, i.end_local, i.all_day, i.start_tz, i.status, i.notes])).toEqual([
      ['Volcano sunrise', '2027-03-14T07:00', '2027-03-14T09:00', false, 'America/Guatemala', 'tentative', 'Bring a jacket'],
      ['Free day', '2027-03-15T00:00', null, true, 'America/Guatemala', 'tentative', null],
    ])
    expect(skipped).toEqual([4, 5])
  })
})
