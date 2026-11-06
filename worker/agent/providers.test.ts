import { beforeEach, describe, expect, it } from 'vitest'
import { checkActivityTimes, forgetAirportZones, searchActivities, searchFlights } from './providers'
import { Ledger } from './schedule'

const args = { slices: [{ origin: 'SFO', destination: 'GUA', departure_date: '2027-03-20' }], adults: 2, cabin_class: 'economy' as const, max_connections: 0 }
const journey = {
  segments: [{ originCode: 'SFO', destinationCode: 'GUA', departureTime: '2027-03-20T07:00:00', arrivalTime: '2027-03-20T13:00:00', carrier: { marketingCode: 'AV' }, flight: { marketingNumber: '123' } }],
  offers: [{ offerId: 'offer/opaque+id=', expiration: '2027-03-20T12:00:00Z', pricing: { display: { total: 900.25, currency: 'USD' } } }],
}

describe('LiteAPI flights', () => {
  beforeEach(forgetAirportZones)
  it('labels the return leg inbound and omits an unrestricted stop filter', async () => {
    const fake = (async (_url, init) => {
      expect(JSON.parse(String(init!.body)).legs).toEqual([
        { origin: 'SFO', destination: 'GUA', date: '2027-03-20', direction: 'OUTBOUND' },
        { origin: 'GUA', destination: 'SFO', date: '2027-03-27', direction: 'INBOUND' },
      ])
      return Response.json({ data: [] })
    }) as typeof fetch
    await searchFlights({ ...args, max_connections: null, slices: [...args.slices, { origin: 'GUA', destination: 'SFO', departure_date: '2027-03-27' }] }, { LITEAPI_KEY: 'sandbox-key' }, new Ledger(), 'USD', fake)
  })

  it('sends the itinerary and trip currency, and resolves airport time zones once per airport', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const fake = (async (url, init) => {
      const u = String(url)
      calls.push({ url: u, init })
      if (u.endsWith('/flights/rates')) return Response.json({ data: [{ journeys: [journey, journey] }] })
      const iata = u.split('/').at(-1)!
      return Response.json({ data: [{ airport: { iata, tz: iata === 'SFO' ? 'America/Los_Angeles' : 'America/Guatemala' } }] })
    }) as typeof fetch
    const ledger = new Ledger()
    const offers = await searchFlights(args, { LITEAPI_KEY: 'sandbox-key' }, ledger, 'USD', fake)
    expect(calls).toHaveLength(3)
    expect(JSON.parse(String(calls[0]!.init!.body))).toEqual({
      legs: [{ origin: 'SFO', destination: 'GUA', date: '2027-03-20', direction: 'OUTBOUND', filters: { maxStops: 0 } }],
      adults: 2, currency: 'USD', cabinClass: 'ECONOMY', sort: { sortBy: 'price', sortOrder: 'asc' },
    })
    expect(new Headers(calls[0]!.init!.headers).get('X-API-Key')).toBe('sandbox-key')
    expect(offers).toHaveLength(1)
    expect(ledger.get('offer/opaque+id=')).toMatchObject({ totalMinor: 90025, currency: 'USD', expiresAt: journey.offers[0]!.expiration,
      segments: [{ departZone: 'America/Los_Angeles', arriveZone: 'America/Guatemala', departLocal: '2027-03-20T07:00:00', arriveLocal: '2027-03-20T13:00:00' }],
    })
  })

  it('converts explicit UTC timestamps to airport local times without losing the instant', async () => {
    const fake = (async (url) => {
      const u = String(url)
      if (u.endsWith('/flights/rates')) return Response.json({ data: [{ journeys: [{ ...journey, segments: [{ ...journey.segments[0], departureTime: '2027-03-20T14:00:00Z', arrivalTime: '2027-03-20T19:00:00Z' }] }] }] })
      const iata = u.split('/').at(-1)!
      return Response.json({ data: [{ airport: { iata, tz: iata === 'SFO' ? 'America/Los_Angeles' : 'America/Guatemala' } }] })
    }) as typeof fetch
    const ledger = new Ledger()
    await searchFlights(args, { LITEAPI_KEY: 'sandbox-key' }, ledger, 'USD', fake)
    expect(ledger.get('offer/opaque+id=')).toMatchObject({ segments: [{ departLocal: '2027-03-20T07:00:00', arriveLocal: '2027-03-20T13:00:00' }] })
  })

  it('excludes flights when an airport time zone cannot be verified', async () => {
    const fake = (async (url) => String(url).endsWith('/flights/rates')
      ? Response.json({ data: [{ journeys: [journey] }] })
      : Response.json({ data: [{ airport: { iata: String(url).split('/').at(-1), tz: 'invalid/zone' } }] })) as typeof fetch
    const ledger = new Ledger()
    expect(await searchFlights(args, { LITEAPI_KEY: 'sandbox-key' }, ledger, 'USD', fake)).toEqual([])
    expect(ledger.all()).toEqual([])
  })

  it('does not accept prices in a different currency or silently guess an expiry', async () => {
    const fake = (async () => Response.json({ data: [{ journeys: [{ ...journey, offers: [
      { ...journey.offers[0], pricing: { display: { total: 100, currency: 'EUR' } } },
      { ...journey.offers[0], expiration: 'unknown' },
    ] }] }] })) as typeof fetch
    expect(await searchFlights(args, { LITEAPI_KEY: 'sandbox-key' }, new Ledger(), 'USD', fake)).toEqual([])
  })

  it('needs a LiteAPI key and rejects malformed successful responses', async () => {
    await expect(searchFlights(args, {}, new Ledger(), 'USD')).rejects.toThrow('LITEAPI_KEY')
    const fake = (async () => Response.json({ data: [{ offers: [] }] })) as typeof fetch
    await expect(searchFlights(args, { LITEAPI_KEY: 'sandbox-key' }, new Ledger(), 'USD', fake)).rejects.toThrow()
  })
})

const tourArgs = { destination_name: 'Antigua Guatemala', start_date: '2027-03-20', end_date: '2027-03-27', tags: ['culture' as const], currency: 'USD', max_price_minor: 5000 }
const timeArgs = { product_code: '1', travel_date: '2027-03-22', adults: 2, currency: 'USD' }
const tour = { id: 1, title: 'Antigua walk', price: { amount: 40, currency: 'USD' }, durations: [{ value: 2, unit: 'hours' }] }
const availability = { data: { categories: [{ ticketCategory: 'adult' }], availableDates: [{ date: timeArgs.travel_date }], participantsRange: { min: 1, max: 10 } } }
const slot = { dateTime: '2027-03-22T09:30:00', isAvailable: true, vacancies: 4, minParticipants: 1, maxParticipants: 10, pricing: { totals: { net: 95.5, commission: 5, currency: 'USD' } } }
const option = { optionId: 123, duration: 150, durationUnit: 'minutes', coordinates: { lat: 14.56, long: -90.73 }, slots: [slot] }
const optionsBody = (options = [option]) => ({ data: { tourId: 1, date: timeArgs.travel_date, currency: 'USD', options } })

describe('LiteAPI Experiences', () => {
  it('searches with date and price filters and keeps real durations and tour IDs', async () => {
    const ledger = new Ledger()
    const fake = (async (url, init) => {
      const u = new URL(String(url))
      expect(u.pathname).toBe('/v3.0/experiences/tours')
      expect(u.searchParams.get('dateRange[from]')).toBe('2027-03-20')
      expect(u.searchParams.get('price[max]')).toBe('50')
      expect(u.searchParams.get('textSearch')).toBe('Antigua Guatemala culture')
      expect(init?.method).toBe('GET')
      expect(new Headers(init?.headers).get('X-API-Key')).toBe('key')
      return Response.json({ data: { tours: [tour] } })
    }) as typeof fetch
    expect(await searchActivities(tourArgs, { LITEAPI_KEY: 'key' }, ledger, fake)).toEqual([
      { product_code: '1', title: 'Antigua walk', duration_minutes: 120, from_price_minor: 4000, currency: 'USD' },
    ])
    expect(ledger.get('1')).toMatchObject({ kind: 'product', durationMin: 120 })
  })

  it('uses adult categories from availability and the chosen slot party total and meeting point', async () => {
    const ledger = new Ledger()
    ledger.put({ kind: 'product', id: '1', title: tour.title, durationMin: 120, fromMinor: 4000, currency: 'USD' })
    const fake = (async (url, init) => {
      if (String(url).includes('/availability?')) return Response.json(availability)
      expect(String(url)).toBe('https://api.liteapi.travel/v3.0/experiences/tours/1/booking-options')
      expect(JSON.parse(String(init?.body))).toEqual({ language: 'en', currency: 'USD', date: '2027-03-22', participants: { adult: 2 } })
      return Response.json(optionsBody())
    }) as typeof fetch
    const result = await checkActivityTimes(timeArgs, { LITEAPI_KEY: 'key' }, ledger, fake)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ start_time: '09:30', end_time: '12:00', total_minor: 9550, currency: 'USD' })
    expect(ledger.get(result[0]!.slot_id)).toMatchObject({ durationMin: 150, lat: 14.56, lng: -90.73, totalMinor: 9550 })
    expect(result[0]!.slot_id).toContain('~123~2027-03-22T09:30:00~2')
  })

  it('rejects unavailable, undersized, unpriced and wrong-date slots', async () => {
    const ledger = new Ledger()
    ledger.put({ kind: 'product', id: '1', title: tour.title, durationMin: 120, fromMinor: 4000, currency: 'USD' })
    const fake = (async (url) => String(url).includes('/availability?') ? Response.json(availability)
      : Response.json(optionsBody([{ ...option, slots: [
        { ...slot, isAvailable: false }, { ...slot, vacancies: 1 }, { ...slot, minParticipants: 3 }, { ...slot, maxParticipants: 1 },
        { ...slot, pricing: { totals: { net: 80, commission: 0, currency: 'EUR' } } }, { ...slot, dateTime: '2027-03-23T09:30:00' },
      ] }, { ...option, optionId: 124, slots: [{ dateTime: slot.dateTime, isAvailable: true } as typeof slot] }]))) as typeof fetch
    expect(await checkActivityTimes(timeArgs, { LITEAPI_KEY: 'key' }, ledger, fake)).toEqual([])
  })

  it('does not guess a participant category or price when there is no adult availability', async () => {
    const ledger = new Ledger()
    ledger.put({ kind: 'product', id: '1', title: tour.title, durationMin: 120, fromMinor: 4000, currency: 'USD' })
    let calls = 0
    const fake = (async () => { calls++; return Response.json({ data: { ...availability.data, categories: [{ ticketCategory: 'child' }] } }) }) as typeof fetch
    expect(await checkActivityTimes(timeArgs, { LITEAPI_KEY: 'key' }, ledger, fake)).toEqual([])
    expect(calls).toBe(1)
    await expect(checkActivityTimes({ ...timeArgs, product_code: '9' }, { LITEAPI_KEY: 'key' }, ledger, fake)).rejects.toThrow('Unknown product_code')
  })
})
