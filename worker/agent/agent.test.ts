import { describe, expect, it } from 'vitest'
import { DateTime } from 'luxon'
import { Ledger, repairStay, resolve, type Constraints, type FlightOffer, type HotelRate, type ActivitySlot } from './schedule'
import { applyRoute, planRoutes } from './routes'
import { DEEPSEEK_TOOLS, TOOLS } from './tools'
import { AGENT_SYSTEM } from './prompt'
import { runAgent } from './loop'
import { toMinor } from './providers'
import type { SubmittedNode } from './tools'

const NOW = DateTime.fromISO('2027-01-10T12:00:00Z')
const zone = 'America/Guatemala'
const trip: Constraints = { start: '2027-03-20', end: '2027-03-27', zone, currency: 'USD', budgetMinor: 300000, adults: 2,
  places: [{ id: 'p-cerro', name: 'Cerro de la Cruz', lat: 14.5626, lng: -90.7317 }, { id: 'p-market', name: 'Mercado', lat: 14.5568, lng: -90.7381 }] }

const flight: FlightOffer = { kind: 'flight', id: 'off_1', totalMinor: 90000, currency: 'USD', expiresAt: '2027-01-11T00:00:00Z', segments: [
  { from: 'SFO', to: 'GUA', departLocal: '2027-03-20T00:30:00', departZone: 'America/Los_Angeles', arriveLocal: '2027-03-20T08:00:00', arriveZone: zone, flight: 'AV561' },
  { from: 'GUA', to: 'SFO', departLocal: '2027-03-27T14:00:00', departZone: zone, arriveLocal: '2027-03-27T19:30:00', arriveZone: 'America/Los_Angeles', flight: 'AV560' },
] }
const hotel: HotelRate = { kind: 'hotel', id: 'rate_1', hotelId: 'lp1', name: 'Casa Antigua', lat: 14.5586, lng: -90.7339, checkin: '2027-03-20', checkout: '2027-03-27', totalMinor: 140000, currency: 'USD', refundable: true }
const slot = (id: string, date: string, start: string, durationMin = 180, lat: number | null = 14.47, lng: number | null = -90.88): ActivitySlot =>
  ({ kind: 'slot', id, productCode: id.split('~')[0]!, title: `Tour ${id}`, date, start, durationMin, totalMinor: 10000, currency: 'USD', lat, lng })
const ledger = (...extra: ActivitySlot[]) => { const l = new Ledger(); [flight, hotel, ...extra].forEach((e) => l.put(e)); return l }
const node = (n: Partial<SubmittedNode> & Pick<SubmittedNode, 'kind' | 'day'>): SubmittedNode => ({ ref: null, start_time: null, duration_minutes: null, note: '', ...n })
const base = [node({ kind: 'flight', ref: 'off_1', day: '2027-03-20' }), node({ kind: 'hotel', ref: 'rate_1', day: '2027-03-20' })]

describe('tool schemas', () => {
  it('sends DeepSeek-compatible strict schemas while retaining server limits', () => {
    const wire = JSON.stringify(DEEPSEEK_TOOLS)
    expect(wire).not.toMatch(/"(?:minLength|maxLength|minItems|maxItems)":/)
    expect(wire).toContain('"anyOf"')
    expect(wire).not.toContain('"type":[')
    expect(JSON.stringify(TOOLS)).toContain('"maxItems"')
  })
  it('are strict: every property required and nothing extra allowed', () => {
    for (const t of TOOLS) {
      const p = t.function.parameters
      expect(t.function.strict).toBe(true)
      expect(p.additionalProperties).toBe(false)
      expect([...p.required].sort()).toEqual(Object.keys(p.properties).sort())
    }
  })
  it('keeps the cached prompt prefix free of anything that changes per request', () => {
    expect(AGENT_SYSTEM).not.toMatch(/\d{4}-\d{2}-\d{2}|\$\{/)
  })
})

describe('resolve', () => {
  it('resolves short model references without changing the original provider IDs', () => {
    const l = ledger()
    const flightRef = l.reference(flight.id), hotelRef = l.reference(hotel.id)
    expect(l.reference(flight.id)).toBe(flightRef)
    expect(l.get(flightRef)?.id).toBe(flight.id)
    const r = resolve([node({ kind: 'flight', ref: flightRef, day: trip.start }), node({ kind: 'hotel', ref: hotelRef, day: trip.start })], l, trip, NOW)
    expect(r.errors).toEqual([])
    expect(r.stays[0]?.rate.id).toBe(hotel.id)
    expect(r.blocks[0]?.ref).toBe(flight.id)
    expect(r.totalMinor).toBe(flight.totalMinor + hotel.totalMinor)
  })
  it('books a round trip once when the model lists it for both directions', () => {
    const r = resolve([base[0]!, node({ kind: 'flight', ref: 'off_1', day: '2027-03-27' }), base[1]!], ledger(), trip, NOW)
    expect(r.errors).toEqual([])
    expect(r.totalMinor).toBe(flight.totalMinor + hotel.totalMinor)
    expect(r.blocks.filter((b) => b.kind === 'flight')).toHaveLength(2)
  })
  it('swaps a hotel booked from the wrong night for the same hotel on the right nights', () => {
    const late: HotelRate = { ...hotel, id: 'rate_late', checkin: '2027-03-21' }
    const l = ledger(); l.put(late)
    const nodes = [base[0]!, node({ kind: 'hotel', ref: 'rate_late', day: '2027-03-21' })]
    const r = resolve(nodes, l, trip, NOW)
    expect(r.errors).toContain('No hotel for the night of 2027-03-20.')
    const fixed = repairStay(nodes, r, l, trip)!
    expect(fixed[1]).toMatchObject({ ref: 'rate_1', day: '2027-03-20' })
    expect(resolve(fixed, l, trip, NOW).errors).toEqual([])
  })
  it('accepts a plan built from ledger ids and totals it', () => {
    const r = resolve([...base, node({ kind: 'activity', ref: 'T1~A~2027-03-22~09:00', day: '2027-03-22', start_time: '09:00' })], ledger(slot('T1~A~2027-03-22~09:00', '2027-03-22', '09:00')), trip, NOW)
    expect(r.errors).toEqual([])
    expect(r.totalMinor).toBe(90000 + 140000 + 10000)
  })
  it('rejects ids the model made up', () => {
    expect(resolve([...base, node({ kind: 'activity', ref: 'MADEUP~1', day: '2027-03-22' })], ledger(), trip, NOW).errors.join()).toMatch(/unknown reference/)
  })
  it('keeps the arrival buffer free: a 09:00 tour after an 08:00 landing clashes', () => {
    const s = slot('T2~A~2027-03-20~09:00', '2027-03-20', '09:00')
    expect(resolve([...base, node({ kind: 'activity', ref: s.id, day: '2027-03-20' })], ledger(s), trip, NOW).errors.join()).toMatch(/clashes.*airport and immigration/)
  })
  it('needs 30 minutes between two tours', () => {
    const a = slot('A~X~2027-03-22~09:00', '2027-03-22', '09:00', 120), b = slot('B~X~2027-03-22~11:15', '2027-03-22', '11:15', 60)
    const r = resolve([...base, node({ kind: 'activity', ref: a.id, day: a.date }), node({ kind: 'activity', ref: b.id, day: b.date })], ledger(a, b), trip, NOW)
    expect(r.errors.join()).toMatch(/30 min to get between stops/)
  })
  it('trims free time out of airport and tour buffers instead of rejecting the plan', () => {
    const s = slot('T4~A~2027-03-22~14:00', '2027-03-22', '14:00', 120)
    const r = resolve([...base,
      // Departure is 14:00 on the 27th, so the airport owns 11:00 onwards: dropped.
      node({ kind: 'free', ref: 'p-market', day: '2027-03-27', start_time: '12:00', duration_minutes: 60 }),
      // Runs into the tour's 30-minute lead-in: cut back to 13:30.
      node({ kind: 'free', ref: 'p-cerro', day: '2027-03-22', start_time: '12:00', duration_minutes: 120 }),
      // Overlaps the free time before it and then the tour: what's left is under 30 minutes, dropped.
      node({ kind: 'free', ref: null, note: 'Coffee', day: '2027-03-22', start_time: '13:15', duration_minutes: 30 }),
      // Outside the trip, and an unknown place: dropped, and kept as a plain note.
      node({ kind: 'free', ref: null, day: '2027-04-01', start_time: '10:00', duration_minutes: 60 }),
      node({ kind: 'free', ref: 'p-gone', note: 'Walk', day: '2027-03-23', start_time: '10:00', duration_minutes: 60 }),
      node({ kind: 'activity', ref: s.id, day: s.date })], ledger(s), trip, NOW)
    expect(r.errors).toEqual([])
    const free = r.blocks.filter((b) => b.kind === 'free').map((b) => [b.node, b.start.toFormat('MM-dd HH:mm'), b.end.toFormat('HH:mm'), b.ref])
    expect(free).toEqual([[3, '03-22 12:00', '13:30', 'p-cerro'], [6, '03-23 10:00', '11:00', null]])
  })
  it('still sends clashes between booked items back to the model', () => {
    const s = slot('T5~A~2027-03-27~12:00', '2027-03-27', '12:00', 60)
    expect(resolve([...base, node({ kind: 'activity', ref: s.id, day: s.date })], ledger(s), trip, NOW).errors.join()).toMatch(/clashes.*airport/)
  })
  it('catches a start time the model misremembered, budget overruns, missing nights and expired offers', () => {
    const s = slot('T3~A~2027-03-22~09:00', '2027-03-22', '09:00')
    expect(resolve([...base, node({ kind: 'activity', ref: s.id, day: s.date, start_time: '10:00' })], ledger(s), trip, NOW).errors.join()).toMatch(/starts at 09:00/)
    expect(resolve(base, ledger(), { ...trip, budgetMinor: 1000 }, NOW).errors.join()).toMatch(/over the budget/)
    expect(resolve([base[0]!], ledger(), trip, NOW).errors).toContain('No hotel for the night of 2027-03-20.')
    expect(resolve(base, ledger(), trip, DateTime.fromISO('2027-02-01T00:00:00Z')).errors.join()).toMatch(/expired/)
  })
})

describe('routes', () => {
  const day = '2027-03-22'
  const tour = slot(`T~A~${day}~13:00`, day, '13:00', 120)
  const nodes = [...base,
    node({ kind: 'free', ref: 'p-market', day, start_time: '09:00', duration_minutes: 60 }),
    node({ kind: 'free', ref: 'p-cerro', day, start_time: '10:00', duration_minutes: 60 }),
    node({ kind: 'activity', ref: tour.id, day })]
  const r = resolve(nodes, ledger(tour), trip, NOW)

  it('splits the day at the fixed tour and only reorders the free stops before it', () => {
    expect(r.errors).toEqual([])
    const { segments, unrouted } = planRoutes(r, trip, 'DRIVE', NOW)
    expect(unrouted).toEqual([])
    expect(segments).toHaveLength(1)
    expect(segments[0]!.from.title).toBe('Casa Antigua')
    expect(segments[0]!.to.title).toBe(tour.title)
    expect(segments[0]!.body).toMatchObject({ optimizeWaypointOrder: true, travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE', departureTime: '2027-03-22T14:00:00.000Z' })
    expect(segments[0]!.body.intermediates).toHaveLength(2)
  })
  it('applies Google’s order and re-times the stops', () => {
    const seg = planRoutes(r, trip, 'DRIVE', NOW).segments[0]!
    const { result, error } = applyRoute(seg, { routes: [{ optimizedIntermediateWaypointIndex: [1, 0], legs: [{ duration: '600s' }, { duration: '900s' }, { duration: '600s' }] }] }, zone)
    expect(error).toBeNull()
    expect(result!.order.map((b) => b.ref)).toEqual(['p-cerro', 'p-market'])
    // Cerro was asked for no earlier than 10:00, so the group waits; the market follows after the drive.
    expect(result!.times).toEqual([{ node: 3, start: '10:00', end: '11:00' }, { node: 2, start: '11:15', end: '12:15' }])
  })
  it('sends the plan back when the stops no longer fit before the tour', () => {
    const seg = planRoutes(r, trip, 'DRIVE', NOW).segments[0]!
    const { error } = applyRoute(seg, { routes: [{ optimizedIntermediateWaypointIndex: [0, 1], legs: [{ duration: '9000s' }, { duration: '9000s' }, { duration: '3600s' }] }] }, zone)
    expect(error).toMatch(/more minutes than there are/)
  })
})

describe('money', () => {
  it('uses each currency’s own minor units', () => {
    expect(toMinor('123.45', 'USD')).toBe(12345)
    expect(toMinor('1500', 'JPY')).toBe(1500)
  })
})

describe('runAgent', () => {
  it('runs tools, feeds clashes back, and returns a checked plan with bookable refs', async () => {
    const turns: { tool_calls: { id: string; type: 'function'; function: { name: string; arguments: string } }[] }[] = [
      { tool_calls: [
        { id: 'c1', type: 'function', function: { name: 'search_flights', arguments: JSON.stringify({ slices: [{ origin: 'SFO', destination: 'GUA', departure_date: '2027-03-20' }, { origin: 'GUA', destination: 'SFO', departure_date: '2027-03-27' }], adults: 2, cabin_class: 'economy', max_connections: null }) } },
        { id: 'c2', type: 'function', function: { name: 'search_hotels', arguments: JSON.stringify({ city_name: 'Antigua Guatemala', country_code: 'GT', checkin: '2027-03-20', checkout: '2027-03-27', adults_per_room: 2, rooms: 1, currency: 'USD', max_nightly_minor: null, min_stars: null }) } },
      ] },
      // First submission forgets the hotel (a booking problem the model has to fix).
      { tool_calls: [{ id: 'c3', type: 'function', function: { name: 'submit_itinerary', arguments: JSON.stringify({ summary: 'A week in Antigua.', assumptions: [], nodes: [
        { kind: 'flight', ref: 'off_1', day: '2027-03-20', start_time: null, duration_minutes: null, note: '' },
        { kind: 'free', ref: 'p-market', day: '2027-03-22', start_time: '10:00', duration_minutes: 60, note: '' },
      ] }) } }] },
      { tool_calls: [{ id: 'c4', type: 'function', function: { name: 'submit_itinerary', arguments: JSON.stringify({ summary: 'A week in Antigua.', assumptions: [], nodes: [
        { kind: 'flight', ref: 'off_1', day: '2027-03-20', start_time: null, duration_minutes: null, note: '' },
        { kind: 'hotel', ref: 'rate_1', day: '2027-03-20', start_time: null, duration_minutes: null, note: '' },
        { kind: 'free', ref: 'p-market', day: '2027-03-22', start_time: '10:00', duration_minutes: 60, note: '' },
      ] }) } }] },
    ]
    const sent: { messages: { role: string; content: string | null }[] }[] = []
    const fake = (async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('deepseek')) { const body = JSON.parse(String(init!.body)); sent.push(body); return Response.json({ choices: [{ message: { content: null, ...turns[sent.length - 1] }, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 1000, completion_tokens: 50, prompt_cache_hit_tokens: sent.length > 1 ? 900 : 0 } }) }
      if (u.endsWith('/flights/rates')) return Response.json({ data: [{ journeys: [{ segments: flight.segments.map((s) => ({ departureTime: s.departLocal, arrivalTime: s.arriveLocal, originCode: s.from, destinationCode: s.to, carrier: { marketingCode: 'AV' }, flight: { marketingNumber: s.flight.slice(2) } })), offers: [{ offerId: 'off_1', expiration: '2027-01-11T00:00:00Z', pricing: { display: { total: 900, currency: 'USD' } } }] }] }] })
      if (u.includes('/data/flights/airports/iatas/')) {
        const iata = u.split('/').at(-1)!
        return Response.json({ data: [{ airport: { iata, tz: iata === 'SFO' ? 'America/Los_Angeles' : zone } }] })
      }
      if (u.includes('liteapi')) return Response.json({ data: [{ hotelId: 'lp1', roomTypes: [{ offerId: 'rate_1', offerRetailRate: { amount: 1400, currency: 'USD' }, rates: [{ name: 'Double', cancellationPolicies: { refundableTag: 'RFN' } }] }] }], hotels: [{ id: 'lp1', name: 'Casa Antigua', latitude: 14.5586, longitude: -90.7339 }] })
      if (u.includes('routes.googleapis')) return Response.json({ routes: [{ optimizedIntermediateWaypointIndex: [0], legs: [{ duration: '300s' }, { duration: '300s' }] }] })
      throw new Error(`unexpected ${u}`)
    }) as typeof fetch
    const plan = await runAgent({ ...trip, origin: 'SFO', destination: 'Antigua Guatemala', countryCode: 'GT', vibe: 'relaxed', notes: '', travelMode: 'DRIVE' },
      { DEEPSEEK_API_KEY: 'k', DEEPSEEK_MODEL: 'm', LITEAPI_KEY: 'l', GOOGLE_ROUTES_API_KEY: 'g' }, fake, NOW)

    // The missing nights went back to the model as a tool result.
    const toolReply = sent[2]!.messages.at(-1)!
    expect(toolReply.role).toBe('tool')
    expect(toolReply.content).toMatch(/No hotel for the night/)
    // The system prompt is the unchanged first message on every turn (the cached prefix).
    expect(new Set(sent.map((s) => s.messages[0]!.content)).size).toBe(1)
    expect(plan.totalMinor).toBe(230000)
    expect(plan.bookable.map((b) => b.ref).sort()).toEqual(['off_1', 'rate_1'])
    expect(plan.days.find((d) => d.date === '2027-03-22')!.items[0]).toMatchObject({ title: 'Mercado', start: '10:00', routed: true })
    expect(plan.usage).toMatchObject({ modelTurns: 3, cachedPromptTokens: 1800 })
  })

  const submit = (id: string, nodes: object[]) => ({ tool_calls: [{ id, type: 'function' as const, function: { name: 'submit_itinerary', arguments: JSON.stringify({ summary: 'A week.', assumptions: [], nodes }) } }] })
  const flightAndHotel = [
    { kind: 'flight', ref: 'off_1', day: '2027-03-20', start_time: null, duration_minutes: null, note: '' },
    { kind: 'hotel', ref: 'rate_1', day: '2027-03-20', start_time: null, duration_minutes: null, note: '' },
  ]
  const scripted = (turns: object[], routes: unknown) => {
    let n = 0
    return (async (url: string | URL | Request) => {
      const u = String(url)
      if (u.includes('deepseek')) return Response.json({ choices: [{ message: { content: null, ...turns[n++] }, finish_reason: 'tool_calls' }] })
      if (u.includes('routes.googleapis')) return Response.json(routes)
      throw new Error(`unexpected ${u}`)
    }) as typeof fetch
  }
  // The ledger is seeded directly, standing in for the searches a real first turn would make.
  const run = (doFetch: typeof fetch, l: Ledger) => runAgent({ ...trip, origin: 'SFO', destination: 'Antigua Guatemala', countryCode: 'GT', vibe: 'relaxed', notes: '', travelMode: 'DRIVE' },
    { DEEPSEEK_API_KEY: 'k', DEEPSEEK_MODEL: 'm', GOOGLE_ROUTES_API_KEY: 'g' }, doFetch, NOW, l)

  it('looks up hotels and tours before the first turn, and stops tour searches the account cannot make', async () => {
    const sent: { messages: { role: string; content: string | null }[] }[] = []
    let tourCalls = 0
    const turns = [
      { tool_calls: [{ id: 't1', type: 'function', function: { name: 'search_activities', arguments: JSON.stringify({ destination_name: 'Antigua', start_date: '2027-03-20', end_date: '2027-03-27', tags: ['food'], currency: 'USD', max_price_minor: null }) } }] },
      submit('s1', flightAndHotel),
    ]
    const fake = (async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('deepseek')) { sent.push(JSON.parse(String(init!.body))); return Response.json({ choices: [{ message: { content: null, ...turns[sent.length - 1] }, finish_reason: 'tool_calls' }] }) }
      if (u.includes('/experiences/tours')) { tourCalls++; return new Response('{}', { status: 403 }) }
      if (u.endsWith('/hotels/rates')) return Response.json({ data: [{ hotelId: 'lp2', roomTypes: [{ offerId: `pre_${JSON.parse(String(init!.body)).checkin}`, offerRetailRate: { amount: 700, currency: 'USD' }, rates: [{ name: 'Double' }] }] }], hotels: [{ id: 'lp2', name: 'Posada' }] })
      if (u.includes('routes.googleapis')) return Response.json({ routes: [] })
      throw new Error(`unexpected ${u}`)
    }) as typeof fetch
    const plan = await runAgent({ ...trip, origin: 'SFO', destination: 'Antigua Guatemala', countryCode: 'GT', vibe: 'relaxed', notes: '', travelMode: 'DRIVE' },
      { DEEPSEEK_API_KEY: 'k', DEEPSEEK_MODEL: 'm', LITEAPI_KEY: 'l' }, fake, NOW, ledger())
    const ready = JSON.parse(sent[0]!.messages[1]!.content!).ready
    expect(ready.tours).toBe('unavailable')
    // The trip's own dates, plus the day after for a flight that lands a day late.
    expect(ready.hotels.map((h: { checkin: string }) => h.checkin)).toEqual(['2027-03-20', '2027-03-21'])
    expect(tourCalls).toBe(1)
    expect(sent[1]!.messages.at(-1)!.content).toMatch(/Tours cannot be booked/)
    expect(plan.usage.timings?.modelMs).toHaveLength(2)
  })

  it('searches the round trip itself when the destination airport is clear, so the model can submit at once', async () => {
    const sent: { messages: { role: string; content: string | null }[] }[] = []
    let flightBody: { legs: { origin: string; destination: string; date: string }[] } | null = null
    const fake = (async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('deepseek')) { sent.push(JSON.parse(String(init!.body))); return Response.json({ choices: [{ message: { content: null, ...submit('s1', flightAndHotel) }, finish_reason: 'tool_calls' }] }) }
      if (u.includes('/data/flights/airports?')) return Response.json({ data: [{ airports: [{ iata: 'ANU', country: 'Antigua and Barbuda', tz: 'America/Antigua' }, { iata: 'GUA', country: 'GT', tz: zone }] }] })
      if (u.endsWith('/flights/rates')) { flightBody = JSON.parse(String(init!.body)); return Response.json({ data: [] }) }
      if (u.endsWith('/hotels/rates') || u.includes('/experiences/')) return Response.json({ data: [] })
      throw new Error(`unexpected ${u}`)
    }) as typeof fetch
    await runAgent({ ...trip, origin: 'SFO', destination: 'Antigua', countryCode: 'GT', vibe: '', notes: '', travelMode: 'DRIVE' },
      { DEEPSEEK_API_KEY: 'k', DEEPSEEK_MODEL: 'm', LITEAPI_KEY: 'l' }, fake, NOW, ledger())
    // The airport in the trip's country (LiteAPI sends its ISO code) wins over a better text match elsewhere.
    expect(flightBody!.legs.map((l) => [l.origin, l.destination, l.date])).toEqual([['SFO', 'GUA', '2027-03-20'], ['GUA', 'SFO', '2027-03-27']])
    expect(sent).toHaveLength(1)
  })

  it('searches the right nights itself when the hotel does not cover the stay, instead of another turn', async () => {
    let n = 0
    const turns = [submit('s1', [flightAndHotel[0]!, { ...flightAndHotel[1]!, ref: 'rate_short', day: '2027-03-20' }])]
    const fake = (async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('deepseek')) return Response.json({ choices: [{ message: { content: null, ...turns[n++] }, finish_reason: 'tool_calls' }] })
      if (u.endsWith('/hotels/rates')) {
        const body = JSON.parse(String(init!.body))
        expect([body.checkin, body.checkout]).toEqual(['2027-03-20', '2027-03-27'])
        return Response.json({ data: [{ hotelId: 'lp1', roomTypes: [{ offerId: 'rate_full', offerRetailRate: { amount: 1500, currency: 'USD' }, rates: [{ name: 'Double' }] }] }], hotels: [{ id: 'lp1', name: 'Casa Antigua' }] })
      }
      if (u.includes('routes.googleapis')) return Response.json({ routes: [] })
      throw new Error(`unexpected ${u}`)
    }) as typeof fetch
    const l = new Ledger(); l.put(flight); l.put({ ...hotel, id: 'rate_short', checkout: '2027-03-25' })
    const plan = await runAgent({ ...trip, origin: null, destination: 'Antigua Guatemala', countryCode: 'GT', vibe: '', notes: '', travelMode: 'DRIVE' },
      { DEEPSEEK_API_KEY: 'k', DEEPSEEK_MODEL: 'm', LITEAPI_KEY: 'l' }, fake, NOW, l)
    expect(n).toBe(1)
    expect(plan.bookable.find((b) => b.kind === 'hotel')).toMatchObject({ ref: 'rate_full', totalMinor: 150000 })
  })

  it('keeps a plan whose free stops do not fit Google’s drive times, flagged as unrouted', async () => {
    const plan = await run(scripted([submit('s1', [...flightAndHotel,
      { kind: 'free', ref: 'p-market', day: '2027-03-22', start_time: '20:00', duration_minutes: 115, note: '' },
    ])], { routes: [{ optimizedIntermediateWaypointIndex: [0], legs: [{ duration: '600s' }, { duration: '1800s' }] }] }), ledger())
    const item = plan.days.find((d) => d.date === '2027-03-22')!.items[0]!
    expect(item).toMatchObject({ start: '20:00', end: '21:55', routed: false })
  })

  it('checks the last attempt and explains what was wrong when every attempt fails', async () => {
    const broke = [flightAndHotel[0]!]
    await expect(run(scripted([submit('a', broke), submit('b', broke), submit('c', broke), submit('d', broke), submit('e', broke)], {}), ledger()))
      .rejects.toThrow(/hotel for every night/)
    // The fourth attempt is checked, and a valid one there is accepted.
    const ok = await run(scripted([submit('a', broke), submit('b', broke), submit('c', broke), submit('d', flightAndHotel)], {}), ledger())
    expect(ok.bookable.map((b) => b.ref).sort()).toEqual(['off_1', 'rate_1'])
  })
})
