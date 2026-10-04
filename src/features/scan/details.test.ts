import { describe, expect, it } from 'vitest'
import { parseDetails } from './details'

describe('parseDetails', () => {
  it('finds the JSON in a chatty reply and keeps valid fields', () => {
    expect(parseDetails('Sure! {"title":"Dinner at Café Sky","merchant":"Café Sky","amount":450,"currency":"GTQ","date":"2027-03-15","confirmation_code":null,"flight":null,"notes":""}')).toEqual({
      title: 'Dinner at Café Sky', merchant: 'Café Sky', amount: 450, currency: 'GTQ', date: '2027-03-15', confirmation_code: null, flight: null, notes: null,
    })
  })

  it('drops invented or malformed values instead of failing', () => {
    expect(parseDetails({ title: 'Ticket', amount: -3, currency: 'quetzales', date: '15/03/2027', confirmation_code: 'ABC123' })).toEqual({
      title: 'Ticket', merchant: null, amount: null, currency: null, date: null, confirmation_code: 'ABC123', flight: null, notes: null,
    })
  })

  it('returns null when nothing useful came back', () => {
    expect(parseDetails('I cannot read this image.')).toBeNull()
    expect(parseDetails({ title: '', amount: null })).toBeNull()
    expect(parseDetails('{not json')).toBeNull()
  })
})
