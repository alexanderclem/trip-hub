// Provider adapters. Each one: call the API, keep the full normalised result in the ledger, and hand
// the model a compact summary (ids, times, prices in minor units), never raw provider JSON.
// Field names follow each provider's current public docs; check them against your sandbox accounts
// before going live (docs/AGENT_PLANNER.md, "Activation").
import { z } from 'zod'
import { DateTime, IANAZone } from 'luxon'
import type { Args } from './tools'
import type { ActivitySlot, FlightOffer, HotelRate, Ledger } from './schedule'

export interface ProviderEnv {
  LITEAPI_KEY?: string
}
type Fetch = typeof fetch

export class SetupError extends Error {}
const need = (value: string | undefined, name: string) => { if (!value) throw new SetupError(`${name} is not set on the server.`); return value }

/** "123.45" in USD → 12345. Uses the currency's own minor-unit count (JPY 0, USD 2, KWD 3). */
export function toMinor(amount: string | number, currency: string): number {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
  return Math.round(Number(amount) * 10 ** digits)
}

async function call(doFetch: Fetch, url: string, init: RequestInit): Promise<unknown> {
  const res = await doFetch(url, { ...init, signal: AbortSignal.timeout(20000) })
  if (!res.ok) {
    console.warn('[agent-provider]', { host: new URL(url).host, path: new URL(url).pathname, status: res.status })
    throw new Error(`${new URL(url).host} ${res.status}`)
  }
  return res.json()
}

// ─── LiteAPI flights ─────────────────────────────────────────────────────────
// Contract: https://docs.liteapi.travel/openapi/openapiflights.json (5 Nov 2026).
// Flight search does not include airport time zones; resolve those from airport metadata.
const liteFlights = z.object({ data: z.array(z.object({ journeys: z.array(z.object({
  segments: z.array(z.object({
    originCode: z.string().regex(/^[A-Z]{3}$/), destinationCode: z.string().regex(/^[A-Z]{3}$/),
    departureTime: z.string(), arrivalTime: z.string(),
    carrier: z.object({ marketingCode: z.string() }), flight: z.object({ marketingNumber: z.string() }),
  })).min(1),
  offers: z.array(z.object({ offerId: z.string().min(1), expiration: z.string(),
    pricing: z.object({ display: z.object({ total: z.number().nonnegative(), currency: z.string() }) }),
  })),
})) })) })
const liteAirport = z.object({ data: z.array(z.object({ airport: z.object({ iata: z.string(), tz: z.string() }) })) })
/** An airport's zone never changes, so each Worker isolate looks one up once (saves a round of calls per search). */
const AIRPORT_ZONES = new Map<string, string>()
/** Tests only: forget the zones earlier tests looked up. */
export const forgetAirportZones = () => AIRPORT_ZONES.clear()
const liteHeaders = (key: string) => ({ 'X-API-Key': key, 'Content-Type': 'application/json', Accept: 'application/json' })

export async function searchFlights(a: Args<'search_flights'>, env: ProviderEnv, ledger: Ledger, currency: string, doFetch: Fetch = fetch) {
  const key = need(env.LITEAPI_KEY, 'LITEAPI_KEY')
  const roundTrip = a.slices.length === 2 && a.slices[0]!.origin === a.slices[1]!.destination && a.slices[0]!.destination === a.slices[1]!.origin
  const body = {
    legs: a.slices.map((s, i) => ({ origin: s.origin, destination: s.destination, date: s.departure_date, direction: roundTrip && i === 1 ? 'INBOUND' : 'OUTBOUND',
      ...(a.max_connections !== null ? { filters: { maxStops: a.max_connections } } : {}),
    })),
    adults: a.adults, currency, cabinClass: a.cabin_class.toUpperCase(), sort: { sortBy: 'price', sortOrder: 'asc' },
  }
  const batches = liteFlights.parse(await call(doFetch, 'https://api.liteapi.travel/v3.0/flights/rates', {
    method: 'POST', headers: liteHeaders(key), body: JSON.stringify(body),
  })).data
  const candidates = batches.flatMap((b) => b.journeys.flatMap((j) => j.offers
    .filter((o) => o.pricing.display.currency === currency && DateTime.fromISO(o.expiration, { setZone: true }).isValid)
    .map((o) => ({ ...o, segments: j.segments }))))
    .sort((x, y) => x.pricing.display.total - y.pricing.display.total).slice(0, 8)
  // Bound metadata calls within the agent's shared subrequest budget. Unresolved journeys are
  // excluded rather than assigning guessed zones or interpreting local times as UTC.
  const codes = [...new Set(candidates.flatMap((o) => o.segments.flatMap((s) => [s.originCode, s.destinationCode])))].slice(0, 12)
  const zones = new Map<string, string>()
  for (const code of codes) { const known = AIRPORT_ZONES.get(code); if (known) zones.set(code, known) }
  await Promise.all(codes.filter((code) => !zones.has(code)).map(async (code) => {
    try {
      const result = liteAirport.parse(await call(doFetch, `https://api.liteapi.travel/v3.0/data/flights/airports/iatas/${code}`, { method: 'GET', headers: liteHeaders(key) }))
      const airport = result.data.find((d) => d.airport.iata === code)?.airport
      if (airport && IANAZone.isValidZone(airport.tz)) { zones.set(code, airport.tz); AIRPORT_ZONES.set(code, airport.tz) }
    } catch { /* this airport's journeys cannot safely be scheduled */ }
  }))
  const offers: FlightOffer[] = []
  for (const o of candidates) {
    if (offers.some((other) => other.id === o.offerId)) continue
    const segments: FlightOffer['segments'] = []
    for (const s of o.segments) {
      const departZone = zones.get(s.originCode), arriveZone = zones.get(s.destinationCode)
      if (!departZone || !arriveZone) break
      const depart = DateTime.fromISO(s.departureTime, { zone: departZone }).setZone(departZone)
      const arrive = DateTime.fromISO(s.arrivalTime, { zone: arriveZone }).setZone(arriveZone)
      if (!depart.isValid || !arrive.isValid || arrive <= depart) break
      segments.push({ from: s.originCode, to: s.destinationCode, departLocal: depart.toFormat("yyyy-MM-dd'T'HH:mm:ss"),
        arriveLocal: arrive.toFormat("yyyy-MM-dd'T'HH:mm:ss"), departZone, arriveZone, flight: `${s.carrier.marketingCode}${s.flight.marketingNumber}` })
    }
    if (segments.length !== o.segments.length) continue
    offers.push({ kind: 'flight', id: o.offerId, totalMinor: toMinor(o.pricing.display.total, currency), currency, expiresAt: o.expiration, segments })
  }
  offers.forEach((o) => ledger.put(o))
  return offers.map((o) => ({ offer_id: ledger.reference(o.id), total_minor: o.totalMinor, currency: o.currency, expires_at: o.expiresAt,
    segments: o.segments.map((s) => `${s.flight} ${s.from} ${s.departLocal.slice(0, 16)} → ${s.to} ${s.arriveLocal.slice(0, 16)} (local times)`) }))
}

// ─── LiteAPI ─────────────────────────────────────────────────────────────────
const liteRates = z.object({
  data: z.array(z.object({ hotelId: z.string(), roomTypes: z.array(z.object({
    offerId: z.string(), offerRetailRate: z.object({ amount: z.number(), currency: z.string() }),
    rates: z.array(z.object({ name: z.string(), cancellationPolicies: z.object({ refundableTag: z.string() }).partial().optional() })).min(1),
  })).min(1) })).default([]),
  hotels: z.array(z.object({ id: z.string(), name: z.string(), latitude: z.number().nullish(), longitude: z.number().nullish(), rating: z.number().nullish(),
    main_photo: z.string().url().refine((u) => u.startsWith('https://')).nullish().catch(null), address: z.string().max(300).nullish().catch(null) })).optional(),
})

export async function searchHotels(a: Args<'search_hotels'>, env: ProviderEnv, ledger: Ledger, doFetch: Fetch = fetch) {
  const key = need(env.LITEAPI_KEY, 'LITEAPI_KEY')
  const body = {
    cityName: a.city_name, countryCode: a.country_code, checkin: a.checkin, checkout: a.checkout, currency: a.currency,
    guestNationality: 'US', occupancies: Array.from({ length: a.rooms }, () => ({ adults: a.adults_per_room })),
    maxRatesPerHotel: 1, includeHotelData: true, limit: 30, ...(a.min_stars ? { starRating: Array.from({ length: 6 - a.min_stars }, (_, i) => a.min_stars! + i) } : {}),
  }
  const parsed = liteRates.parse(await call(doFetch, 'https://api.liteapi.travel/v3.0/hotels/rates', {
    method: 'POST', headers: { 'X-API-Key': key, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body),
  }))
  const nights = Math.round((Date.parse(a.checkout) - Date.parse(a.checkin)) / 86400000)
  const info = new Map((parsed.hotels ?? []).map((h) => [h.id, h]))
  const rates = parsed.data.flatMap((h) => {
    const room = h.roomTypes[0]!
    const hotel = info.get(h.hotelId)
    const rate: HotelRate = { kind: 'hotel', id: room.offerId, hotelId: h.hotelId, name: hotel?.name ?? h.hotelId, lat: hotel?.latitude ?? null, lng: hotel?.longitude ?? null,
      checkin: a.checkin, checkout: a.checkout, totalMinor: toMinor(room.offerRetailRate.amount, room.offerRetailRate.currency), currency: room.offerRetailRate.currency,
      refundable: room.rates[0]!.cancellationPolicies?.refundableTag === 'RFN', photo: hotel?.main_photo ?? null, address: hotel?.address ?? null }
    return a.max_nightly_minor !== null && rate.totalMinor / nights / a.rooms > a.max_nightly_minor ? [] : [rate]
  }).sort((x, y) => x.totalMinor - y.totalMinor).slice(0, 8)
  rates.forEach((r) => ledger.put(r))
  return rates.map((r) => ({ rate_id: ledger.reference(r.id), hotel: r.name, total_minor: r.totalMinor, currency: r.currency, refundable: r.refundable, has_location: r.lat !== null }))
}

// ─── LiteAPI Experiences ─────────────────────────────────────────────────────
// Contract: https://docs.liteapi.travel/openapi/api-experiences.json (5 Nov 2026).
const liteTours = z.object({ data: z.object({ tours: z.array(z.object({
  id: z.number().int().positive(), title: z.string(),
  price: z.object({ amount: z.number().nonnegative(), currency: z.string() }),
  durations: z.array(z.object({ value: z.number().positive(), unit: z.string() })).optional(),
  pictures: z.array(z.object({ url: z.string() })).nullish().catch(null), sourceUrl: z.string().url().refine((u) => u.startsWith('https://')).nullish().catch(null),
})) }) })

function durationMinutes(value: number | undefined, unit: string | undefined): number | null {
  const factor = unit === 'minutes' || unit === 'minute' ? 1 : unit === 'hours' || unit === 'hour' ? 60 : unit === 'days' || unit === 'day' ? 1440 : null
  return value && factor && Number.isFinite(value) ? Math.ceil(value * factor) : null
}

export async function searchActivities(a: Args<'search_activities'>, env: ProviderEnv, ledger: Ledger, doFetch: Fetch = fetch) {
  const key = need(env.LITEAPI_KEY, 'LITEAPI_KEY')
  const query = new URLSearchParams({ language: 'en', currency: a.currency, textSearch: [a.destination_name, ...a.tags].join(' '),
    'dateRange[from]': a.start_date, 'dateRange[to]': a.end_date, 'pagination[limit]': '20', 'pagination[offset]': '0' })
  if (a.max_price_minor !== null) {
    const digits = new Intl.NumberFormat('en', { style: 'currency', currency: a.currency }).resolvedOptions().maximumFractionDigits ?? 2
    query.set('price[max]', String(a.max_price_minor / 10 ** digits))
  }
  const parsed = liteTours.parse(await call(doFetch, `https://api.liteapi.travel/v3.0/experiences/tours?${query}`, { method: 'GET', headers: liteHeaders(key) }))
  const products = parsed.data.tours.filter((p) => p.price.currency === a.currency).map((p) => {
    const durations = (p.durations ?? []).flatMap((d) => { const m = durationMinutes(d.value, d.unit); return m ? [m] : [] })
    return { kind: 'product' as const, id: String(p.id), title: p.title, durationMin: durations.length ? Math.max(...durations) : 0,
      fromMinor: toMinor(p.price.amount, p.price.currency), currency: p.price.currency,
      photo: p.pictures?.find((pic) => pic.url.startsWith('https://'))?.url ?? null, url: p.sourceUrl ?? null }
  }).slice(0, 12)
  products.forEach((p) => ledger.put(p))
  return products.map((p) => ({ product_code: p.id, title: p.title, duration_minutes: p.durationMin || null, from_price_minor: p.fromMinor, currency: p.currency }))
}

const liteAvailability = z.object({ data: z.object({
  categories: z.array(z.object({ ticketCategory: z.string() })),
  availableDates: z.array(z.object({ date: z.string() })),
  participantsRange: z.object({ min: z.number().int().optional(), max: z.number().int().optional() }).optional(),
}) })
const liteOptions = z.object({ data: z.object({ tourId: z.number().int(), date: z.string(), currency: z.string(), options: z.array(z.object({
  optionId: z.number().int().positive(), duration: z.number().positive().optional(), durationUnit: z.string().optional(),
  coordinates: z.object({ lat: z.number().min(-90).max(90), long: z.number().min(-180).max(180) }).nullish(),
  slots: z.array(z.object({ dateTime: z.string(), isAvailable: z.boolean(), vacancies: z.number().int().optional(),
    minParticipants: z.number().int().optional(), maxParticipants: z.number().int().optional(),
    pricing: z.object({ totals: z.object({ net: z.number().nonnegative(), currency: z.string() }) }).optional(),
  })).optional(),
})) }) })

export async function checkActivityTimes(a: Args<'check_activity_times'>, env: ProviderEnv, ledger: Ledger, doFetch: Fetch = fetch) {
  const key = need(env.LITEAPI_KEY, 'LITEAPI_KEY')
  const product = ledger.get(a.product_code)
  if (!product || product.kind !== 'product') throw new ToolInputError('Unknown product_code. Use one returned by search_activities.')
  const base = `https://api.liteapi.travel/v3.0/experiences/tours/${encodeURIComponent(a.product_code)}`
  const availability = liteAvailability.parse(await call(doFetch, `${base}/availability?language=en`, { method: 'GET', headers: liteHeaders(key) })).data
  // Use an actual category from availability; an adult-only planner must not guess an age band.
  const category = availability.categories.find((c) => c.ticketCategory === 'adult')?.ticketCategory
  const range = availability.participantsRange
  if (!category || !availability.availableDates.some((d) => d.date === a.travel_date) || (range?.min !== undefined && a.adults < range.min) || (range?.max !== undefined && a.adults > range.max)) return []
  const body = { language: 'en', currency: a.currency, date: a.travel_date, participants: { [category]: a.adults } }
  const parsed = liteOptions.parse(await call(doFetch, `${base}/booking-options`, { method: 'POST', headers: liteHeaders(key), body: JSON.stringify(body) })).data
  if (String(parsed.tourId) !== a.product_code || parsed.date !== a.travel_date || parsed.currency !== a.currency) throw new Error('Tour booking options do not match the request.')
  const slots = parsed.options.flatMap((option) => {
    const durationMin = durationMinutes(option.duration, option.durationUnit) ?? product.durationMin
    if (!durationMin) return [] // never invent a duration or a start time for open-entry tickets
    return (option.slots ?? []).flatMap((b): ActivitySlot[] => {
      const price = b.pricing?.totals
      const start = DateTime.fromISO(b.dateTime, { setZone: true })
      if (!b.isAvailable || !price || price.currency !== a.currency || !start.isValid || start.toISODate() !== a.travel_date ||
        (b.vacancies !== undefined && b.vacancies < a.adults) || (b.minParticipants !== undefined && a.adults < b.minParticipants) || (b.maxParticipants !== undefined && a.adults > b.maxParticipants)) return []
      return [{ kind: 'slot', id: `liteapi~${a.product_code}~${option.optionId}~${b.dateTime}~${a.adults}`, productCode: a.product_code, title: product.title,
        date: a.travel_date, start: start.toFormat('HH:mm'), durationMin, totalMinor: toMinor(price.net, price.currency), currency: price.currency,
        lat: option.coordinates?.lat ?? null, lng: option.coordinates?.long ?? null, photo: product.photo ?? null, url: product.url ?? null }]
    })
  }).slice(0, 24)
  slots.forEach((s) => ledger.put(s))
  return slots.map((s) => ({ slot_id: s.id, start_time: s.start, end_time: addMinutes(s.start, s.durationMin), total_minor: s.totalMinor, currency: s.currency }))
}

const addMinutes = (hhmm: string, minutes: number) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  const t = (h * 60 + m + minutes) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** The model passed something the server won't act on; tell it why instead of failing the plan. */
export class ToolInputError extends Error {}
