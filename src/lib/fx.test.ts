import { describe, expect, it } from 'vitest'
import { convertMinor, fetchRates, rateFor } from './fx'

const snapshot = { rates: { USD: 1, GTQ: 7.63, EUR: 0.9 }, as_of: '2027-03-01' }

describe('rateFor', () => {
  it('same currency is 1', () => {
    expect(rateFor('USD', 'USD', snapshot)).toEqual({ rate: 1, source: 'same', asOf: null })
  })
  it('reads the snapshot (GTQ per USD)', () => {
    expect(rateFor('GTQ', 'USD', snapshot)).toEqual({ rate: 7.63, source: 'snapshot', asOf: '2027-03-01' })
  })
  it('crosses through USD for a non-USD base (GTQ per EUR)', () => {
    expect(rateFor('GTQ', 'EUR', snapshot)!.rate).toBeCloseTo(7.63 / 0.9, 10)
    expect(rateFor('USD', 'GTQ', snapshot)!.rate).toBeCloseTo(1 / 7.63, 10)
  })
  it('falls back to built-in rates when there is no snapshot or the currency is missing', () => {
    expect(rateFor('GTQ', 'USD', null)).toEqual({ rate: 7.7, source: 'fallback', asOf: null })
    expect(rateFor('MXN', 'USD', snapshot)!.source).toBe('fallback')
  })
  it('unknown currency → null', () => {
    expect(rateFor('XYZ', 'USD', snapshot)).toBeNull()
  })
})

describe('convertMinor', () => {
  it('USD → GTQ for display', () => {
    // $58.98 at 7.63 GTQ/USD = Q450.02
    expect(convertMinor(5898, 'USD', 'GTQ', 7.63)).toBe(45002)
  })
  it('handles different minor units (USD → JPY)', () => {
    expect(convertMinor(1000, 'USD', 'JPY', 150)).toBe(1500)
  })
  it('same currency is unchanged', () => {
    expect(convertMinor(123, 'USD', 'USD', 1)).toBe(123)
  })
})

describe('fetchRates', () => {
  it('parses an open.er-api.com response', async () => {
    const f = (async () => new Response(JSON.stringify({ result: 'success', rates: { USD: 1, GTQ: 7.6266 }, time_last_update_unix: 1790726551 }))) as typeof fetch
    const r = await fetchRates(f)
    expect(r.rates.GTQ).toBe(7.6266)
    expect(r.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('throws when the API fails', async () => {
    const f = (async () => new Response('{"result":"error"}')) as typeof fetch
    await expect(fetchRates(f)).rejects.toThrow(/unavailable/)
  })
})
