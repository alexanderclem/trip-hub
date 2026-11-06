// The agent loop (docs/AGENT_PLANNER.md, "Orchestration").
// One HTTP request runs the whole conversation: model → tool calls (in parallel) → model … until it
// submits an itinerary that passes resolve() and the route check. The Ledger is the only state;
// the model's messages carry summaries and ids, never the authoritative data.
import { DateTime } from 'luxon'
import { AGENT_SYSTEM, tripMessage } from './prompt'
import { DEEPSEEK_TOOLS, argSchemas, type ToolName } from './tools'
import { Ledger, destinationWindow, repairStay, resolve, stayFor, type Constraints, type Resolved } from './schedule'
import { MAX_ROUTE_REQUESTS, applyRoute, computeRoute, planRoutes, type Optimised } from './routes'
import { SetupError, ToolInputError, checkActivityTimes, findAirport, searchActivities, searchFlights, searchHotels, type ProviderEnv } from './providers'

export interface AgentEnv extends ProviderEnv {
  DEEPSEEK_API_KEY?: string
  /** Exact model id from DeepSeek's /models list (we were asked to run "DeepSeek V4.1 Flash"). */
  DEEPSEEK_MODEL?: string
  /** https://api.deepseek.com/beta is needed for `strict` tool schemas. */
  DEEPSEEK_BASE_URL?: string
  GOOGLE_ROUTES_API_KEY?: string
}
export type AgentInput = Constraints & { origin: string | null; destination: string; countryCode: string; vibe: string; notes: string; travelMode: 'DRIVE' | 'WALK' }

export const LIMITS = { modelTurns: 12, toolCalls: 30, submitAttempts: 4, subrequests: 45 }

interface ToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }
type Message =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }
interface Completion { choices: { message: { content: string | null; tool_calls?: ToolCall[] }; finish_reason: string }[]; usage?: { prompt_tokens: number; completion_tokens: number; prompt_cache_hit_tokens?: number } }

export interface FinalPlan {
  summary: string; assumptions: string[]; currency: string; totalMinor: number
  days: { date: string; stay: { name: string; rateId: string; refundable: boolean; photo?: string | null; address?: string | null; checkin?: string; checkout?: string } | null
    items: { node: number; kind: string; title: string; start: string; end: string; ref: string | null; routed: boolean; photo?: string | null; url?: string | null; placeId?: string | null
      /** Flights only: each end's local wall-clock time ('yyyy-MM-ddTHH:mm') and zone, as on the ticket. start/end are these times too. */
      depart?: { local: string; zone: string; airport: string }; arrive?: { local: string; zone: string; airport: string } }[] }[]
  /** What a "Book" step must act on, in order. Offers expire, so the client shows expiresAt. */
  bookable: { kind: 'flight' | 'hotel' | 'activity'; ref: string; totalMinor: number; expiresAt: string | null; label?: string }[]
  unrouted: number[]
  usage: { modelTurns: number; promptTokens: number; cachedPromptTokens: number; completionTokens: number; timings?: Timings }
}
/** Where a plan's time went, in milliseconds: each model turn, each tool call, and routing. */
export interface Timings { totalMs: number; prefetchMs: number; modelMs: number[]; tools: { name: string; ms: number }[]; routeMs: number }

const TOURS_OFF = 'Tours cannot be booked for this trip. Do not search for tours again; leave that time free.'

/** What the server already looked up for the trip's own dates (see tripMessage). */
export interface Ready {
  /** Round trip from the origin on the trip's first and last days, when the destination airport is clear. */
  flights?: { slices: { origin: string; destination: string; departure_date: string }[]; results: unknown[] }
  hotels: { checkin: string; checkout: string; rooms: number; adults_per_room: number; results: unknown[] }[]
  tours: unknown[] | 'unavailable'
}

/**
 * Hotels for the trip's dates (and from the next day, when an overnight flight lands a day late) and
 * tours for the whole trip, all in parallel. Failures just leave the model to search itself.
 */
export async function prefetch(c: AgentInput, env: AgentEnv, ledger: Ledger, doFetch: typeof fetch): Promise<Ready> {
  if (!env.LITEAPI_KEY) return { hotels: [], tours: [] } // the tools report the missing key themselves
  const rooms = Math.ceil(c.adults / 2)
  const perRoom = Math.ceil(c.adults / rooms)
  const nextDay = DateTime.fromISO(c.start).plus({ days: 1 }).toISODate()!
  const stays = [{ checkin: c.start, checkout: c.end }, ...(c.origin && nextDay < c.end ? [{ checkin: nextDay, checkout: c.end }] : [])]
  const [flights, hotels, tours] = await Promise.all([
    // The slowest call (often 10 to 15 s on a route the provider hasn't cached), so it starts first.
    (async (): Promise<Ready['flights']> => {
      if (!c.origin) return undefined
      try {
        const destination = await findAirport(c.destination, c.countryCode, env, doFetch)
        if (!destination || destination === c.origin) return undefined
        const slices = [{ origin: c.origin, destination, departure_date: c.start }, { origin: destination, destination: c.origin, departure_date: c.end }]
        const results = await searchFlights({ slices, adults: c.adults, cabin_class: 'economy', max_connections: null }, env, ledger, c.currency, doFetch)
        return results.length ? { slices, results } : undefined
      } catch (error) { if (error instanceof SetupError || error instanceof AgentError) throw error; return undefined }
    })(),
    Promise.all(stays.filter((s) => s.checkout > s.checkin).map(async (s) => {
      try {
        const results = await searchHotels({ city_name: c.destination, country_code: c.countryCode, checkin: s.checkin, checkout: s.checkout, adults_per_room: perRoom, rooms, currency: c.currency, max_nightly_minor: null, min_stars: null }, env, ledger, doFetch)
        return results.length ? [{ ...s, rooms, adults_per_room: perRoom, results }] : []
      } catch (error) { if (error instanceof SetupError) throw error; return [] }
    })),
    searchActivities({ destination_name: c.destination, start_date: c.start, end_date: c.end, tags: [], currency: c.currency, max_price_minor: null }, env, ledger, doFetch)
      .then((r): unknown[] | 'unavailable' => r)
      .catch((error: unknown): unknown[] | 'unavailable' => { if (error instanceof SetupError) throw error; return error instanceof Error && / 40[13]$/.test(error.message) ? 'unavailable' : [] }),
  ])
  return { ...(flights ? { flights } : {}), hotels: hotels.flat(), tours }
}

export class AgentError extends Error {}

export async function runAgent(input: AgentInput, env: AgentEnv, doFetch: typeof fetch = fetch, now: DateTime = DateTime.utc(), ledger: Ledger = new Ledger()): Promise<FinalPlan> {
  if (!env.DEEPSEEK_API_KEY || !env.DEEPSEEK_MODEL) throw new SetupError('DEEPSEEK_API_KEY and DEEPSEEK_MODEL must be set on the server.')
  let subrequests = 0
  const counted: typeof fetch = (url, init) => {
    if (++subrequests > LIMITS.subrequests) throw new AgentError('This plan needed more lookups than one request allows. Narrow the dates or the brief.')
    return doFetch(url, init)
  }
  const started = Date.now()
  const timings: Timings = { totalMs: 0, prefetchMs: 0, modelMs: [], tools: [], routeMs: 0 }
  // Hotels and tours for the trip's own dates don't depend on anything the model decides, so the
  // server looks them up before the first turn. That saves the model one or two round trips.
  const ready = await prefetch(input, env, ledger, counted)
  let toursOff = ready.tours === 'unavailable'
  timings.prefetchMs = Date.now() - started
  const messages: Message[] = [{ role: 'system', content: AGENT_SYSTEM }, { role: 'user', content: tripMessage(input, ready) }]
  const usage: FinalPlan['usage'] = { modelTurns: 0, promptTokens: 0, cachedPromptTokens: 0, completionTokens: 0, timings }
  let toolCalls = 0, submits = 0

  for (let turn = 0; turn < LIMITS.modelTurns; turn++) {
    const turnStart = Date.now()
    const completion = await chat(messages, env, counted)
    timings.modelMs.push(Date.now() - turnStart)
    usage.modelTurns++
    usage.promptTokens += completion.usage?.prompt_tokens ?? 0
    usage.cachedPromptTokens += completion.usage?.prompt_cache_hit_tokens ?? 0
    usage.completionTokens += completion.usage?.completion_tokens ?? 0
    const message = completion.choices[0]?.message
    if (!message) throw new AgentError('The planner returned nothing.')
    // Requests explicitly disable thinking, so tool history carries no reasoning_content.
    messages.push({ role: 'assistant', content: message.content, ...(message.tool_calls?.length ? { tool_calls: message.tool_calls } : {}) })
    if (!message.tool_calls?.length) { messages.push({ role: 'user', content: 'Continue with tool calls. Finish only by calling submit_itinerary.' }); continue }

    toolCalls += message.tool_calls.length
    if (toolCalls > LIMITS.toolCalls) throw new AgentError('The planner searched too many times without finishing. Try a simpler brief.')
    let final: FinalPlan | null = null
    const results = await Promise.all(message.tool_calls.map(async (callItem) => {
      const name = callItem.function.name
      const toolStart = Date.now()
      const reply = (body: unknown) => { timings.tools.push({ name, ms: Date.now() - toolStart }); return { role: 'tool' as const, tool_call_id: callItem.id, content: JSON.stringify(body) } }
      if (!Object.hasOwn(argSchemas, name)) return reply({ error: `Unknown tool ${callItem.function.name}.` })
      let args: unknown
      try { args = JSON.parse(callItem.function.arguments) } catch { return reply({ error: 'Arguments were not valid JSON.' }) }
      const parsed = argSchemas[name as ToolName].safeParse(args)
      if (!parsed.success) return reply({ error: 'Invalid arguments', issues: parsed.error.issues.map((i: { path: PropertyKey[]; message: string }) => `${i.path.join('.')}: ${i.message}`) })
      if (toursOff && (name === 'search_activities' || name === 'check_activity_times')) return reply({ error: TOURS_OFF })
      try {
        if (name === 'submit_itinerary') {
          // Parallel submits in one turn are checked one at a time; once a plan passes, the rest are moot.
          if (final) return reply({ ok: true })
          submits++
          let a = argSchemas.submit_itinerary.parse(parsed.data)
          let resolved = resolve(a.nodes, ledger, input, now)
          // A hotel booked from the wrong night is swapped for the same hotel's rate on the right
          // nights when we already have one, instead of costing a resubmit.
          let swapped = resolved.errors.length ? repairStay(a.nodes, resolved, ledger, input) : null
          // No rate for the right nights yet (the flights land or leave a day off from the hotel):
          // search the same city for exactly those nights once, here, rather than in another model turn.
          if (!swapped && resolved.stays.length === 1 && resolved.errors.length && resolved.errors.every((e) => e.startsWith('No hotel for the night'))) {
            const { first, last } = destinationWindow(resolved.blocks, input)
            if (first < last) {
              const rooms = Math.ceil(input.adults / 2)
              try {
                await searchHotels({ city_name: input.destination, country_code: input.countryCode, checkin: first, checkout: last, adults_per_room: Math.ceil(input.adults / rooms), rooms, currency: input.currency, max_nightly_minor: null, min_stars: null }, env, ledger, counted)
                swapped = repairStay(a.nodes, resolved, ledger, input) ?? cheapestStay(a.nodes, resolved, ledger, input, first, last)
              } catch (error) { if (error instanceof SetupError || error instanceof AgentError) throw error }
            }
          }
          if (swapped) {
            const again = resolve(swapped, ledger, input, now)
            if (again.errors.length < resolved.errors.length) { a = { ...a, nodes: swapped }; resolved = again }
          }
          if (resolved.errors.length) {
            console.warn('[agent-submit]', { attempt: submits, errors: resolved.errors.slice(0, 12) })
            if (submits >= LIMITS.submitAttempts) throw new AgentError(giveUpMessage(resolved.errors))
            return reply({ ok: false, errors: resolved.errors })
          }
          const routeStart = Date.now()
          const routed = await optimise(resolved, input, env, counted, now)
          timings.routeMs = Date.now() - routeStart
          final = finalPlan(a, resolved, routed.optimised, routed.unrouted, input, ledger, usage)
          return reply({ ok: true })
        }
        const data = name === 'search_flights' ? await searchFlights(argSchemas.search_flights.parse(parsed.data), env, ledger, input.currency, counted)
          : name === 'search_hotels' ? await searchHotels(argSchemas.search_hotels.parse(parsed.data), env, ledger, counted)
          : name === 'search_activities' ? await searchActivities(argSchemas.search_activities.parse(parsed.data), env, ledger, counted)
          : await checkActivityTimes(argSchemas.check_activity_times.parse(parsed.data), env, ledger, counted)
        return reply(data.length ? { results: data } : { results: [], hint: 'Nothing matched. Loosen one filter (price, stars, dates) and search again, or leave that part as free time.' })
      } catch (error) {
        if (error instanceof SetupError || error instanceof AgentError) throw error
        if (error instanceof ToolInputError) return reply({ error: error.message })
        // Tours not enabled on the provider account: say so once instead of letting the model retry.
        if ((name === 'search_activities' || name === 'check_activity_times') && error instanceof Error && / 40[13]$/.test(error.message)) { toursOff = true; return reply({ error: TOURS_OFF }) }
        console.warn('[agent-tool]', { tool: name, error: error instanceof Error ? error.message.slice(0, 1000) : 'unknown' })
        // A provider failing is reported to the model, which can retry once or plan around it.
        return reply({ error: 'The provider did not answer. Try once more, or plan this part as free time.' })
      }
    }))
    messages.push(...results)
    if (final) {
      timings.totalMs = Date.now() - started
      console.log('[agent-timings]', JSON.stringify(timings))
      return final
    }
  }
  throw new AgentError('The planner ran out of steps before finishing. Try a shorter trip or fewer requirements.')
}

async function chat(messages: Message[], env: AgentEnv, doFetch: typeof fetch): Promise<Completion> {
  const res = await doFetch(`${env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/beta'}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: env.DEEPSEEK_MODEL, messages, tools: DEEPSEEK_TOOLS, thinking: { type: 'disabled' }, tool_choice: 'auto', parallel_tool_calls: true, temperature: 0.2, max_tokens: 4000 }),
    signal: AbortSignal.timeout(90000),
  })
  if (res.status === 402) throw new SetupError('The DeepSeek account has no balance left.')
  if (!res.ok) throw new AgentError(`The planner is unavailable (${res.status}). Try again shortly.`)
  return res.json() as Promise<Completion>
}

async function optimise(r: Resolved, c: AgentInput, env: AgentEnv, doFetch: typeof fetch, now: DateTime) {
  const { segments, unrouted } = planRoutes(r, c, c.travelMode, now)
  const optimised: Optimised[] = []
  // Without a Routes key the plan is still valid; it just isn't reordered.
  if (!env.GOOGLE_ROUTES_API_KEY) return { optimised, unrouted: [...unrouted, ...segments.flatMap((s) => s.stops)] }
  for (const seg of segments.slice(0, MAX_ROUTE_REQUESTS)) {
    try {
      const { result, error } = applyRoute(seg, await computeRoute(seg.body, env.GOOGLE_ROUTES_API_KEY, doFetch), c.zone)
      if (result) optimised.push(result)
      // The stops already passed the 30-minute rule, so a tight or unroutable segment keeps the model's
      // times and is flagged as unrouted. Rejecting the whole plan over free time used up every attempt.
      else { unrouted.push(...seg.stops); if (error) console.warn('[agent-route]', { error }) }
    } catch (error) {
      if (error instanceof AgentError) throw error
      unrouted.push(...seg.stops)
    }
  }
  unrouted.push(...segments.slice(MAX_ROUTE_REQUESTS).flatMap((s) => s.stops))
  return { optimised, unrouted }
}

/** The model's hotel isn't available for the right nights: take the cheapest rate that is. */
function cheapestStay(nodes: Parameters<typeof repairStay>[0], r: Resolved, ledger: Ledger, c: AgentInput, first: string, last: string) {
  const stay = r.stays[0]
  const rate = ledger.all().filter((e) => e.kind === 'hotel' && e.checkin === first && e.checkout === last && e.currency === c.currency)
    .sort((x, y) => (x.kind === 'hotel' && y.kind === 'hotel' ? x.totalMinor - y.totalMinor : 0))[0]
  return stay && rate ? nodes.map((n, i) => (i === stay.node ? { ...n, ref: rate.id, day: first } : n)) : null
}

/** What to tell the traveller when every attempt failed, based on what the last one got wrong. */
export function giveUpMessage(errors: string[]): string {
  const all = errors.join('\n')
  if (/over the budget/.test(all)) return 'The planner could not fit flights, hotels and tours within the budget. Try a higher budget or fewer booked activities.'
  if (/No hotel for the night|Two hotels overlap/.test(all)) return 'The planner could not line up a hotel for every night. Try again, or check the trip dates.'
  if (/clashes/.test(all)) return 'The planner could not fit the booked tours around the flights. Try fewer activities.'
  return 'The planner could not finish a plan that passed every check. Try again, or simplify the brief.'
}

function finalPlan(a: { summary: string; assumptions: string[] }, r: Resolved, routes: Optimised[], unrouted: Resolved['blocks'], c: AgentInput, ledger: Ledger, usage: FinalPlan['usage']): FinalPlan {
  const retimed = new Map(routes.flatMap((o) => o.times.map((t) => [t.node, t] as const)))
  const notRouted = new Set(unrouted.map((b) => b.node))
  const days = new Map<string, FinalPlan['days'][number]['items']>()
  for (const b of r.blocks) {
    // A flight is listed on the day it leaves, at the times printed on the ticket (each airport's own clock).
    const local = b.kind === 'flight' ? b.start : b.start.setZone(c.zone)
    const day = local.toISODate()!
    const t = retimed.get(b.node)
    const slot = b.kind === 'activity' && b.ref ? ledger.get(b.ref) : undefined
    const extra = slot?.kind === 'slot' ? { photo: slot.photo ?? null, url: slot.url ?? null, placeId: null } : { photo: null, url: null, placeId: b.kind === 'free' ? b.ref : null }
    const end = b.kind === 'flight' ? b.end : b.end.setZone(c.zone)
    const [from, to] = b.kind === 'flight' ? (b.title.split(' ')[1] ?? '').split('→') : []
    const ends = b.kind === 'flight' ? { depart: { local: b.start.toFormat("yyyy-MM-dd'T'HH:mm"), zone: b.start.zoneName!, airport: from ?? '' }, arrive: { local: b.end.toFormat("yyyy-MM-dd'T'HH:mm"), zone: b.end.zoneName!, airport: to ?? '' } } : {}
    const node = { node: b.node, kind: b.kind, title: b.title, start: t?.start ?? local.toFormat('HH:mm'), end: t?.end ?? end.toFormat('HH:mm'), ref: b.ref, routed: !notRouted.has(b.node) && b.kind !== 'flight', ...extra, ...ends }
    days.set(day, [...(days.get(day) ?? []), node])
  }
  const bookable: FinalPlan['bookable'] = []
  const refs = new Set([...r.blocks.filter((b) => b.kind !== 'free').map((b) => b.ref!), ...r.stays.map((s) => s.rate.id)])
  for (const ref of refs) {
    const entry = ledger.get(ref)
    if (entry?.kind === 'flight') bookable.push({ kind: 'flight', ref, totalMinor: entry.totalMinor, expiresAt: entry.expiresAt, label: `${entry.segments[0]!.from === entry.segments.at(-1)!.to ? `Round trip from ${entry.segments[0]!.from}` : `${entry.segments[0]!.from} → ${entry.segments.at(-1)!.to}`} · ${entry.segments.map((s) => s.flight).join(', ')}` })
    if (entry?.kind === 'hotel') { const nights = Math.round((Date.parse(entry.checkout) - Date.parse(entry.checkin)) / 86400000); bookable.push({ kind: 'hotel', ref, totalMinor: entry.totalMinor, expiresAt: null, label: `${entry.name} · ${nights} ${nights === 1 ? 'night' : 'nights'}` }) }
    if (entry?.kind === 'slot') bookable.push({ kind: 'activity', ref, totalMinor: entry.totalMinor, expiresAt: null, label: entry.title })
  }
  return {
    summary: a.summary, assumptions: a.assumptions, currency: c.currency, totalMinor: r.totalMinor,
    days: [...days.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([date, items]) => {
      const stay = stayFor(date, r.stays)
      return { date, stay: stay ? { name: stay.name, rateId: stay.id, refundable: stay.refundable, photo: stay.photo ?? null, address: stay.address ?? null, checkin: stay.checkin, checkout: stay.checkout } : null, items: items.sort((x, y) => x.start.localeCompare(y.start)) }
    }),
    bookable, unrouted: [...notRouted], usage,
  }
}
