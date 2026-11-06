// The agent loop (docs/AGENT_PLANNER.md, "Orchestration").
// One HTTP request runs the whole conversation: model → tool calls (in parallel) → model … until it
// submits an itinerary that passes resolve() and the route check. The Ledger is the only state;
// the model's messages carry summaries and ids, never the authoritative data.
import { DateTime } from 'luxon'
import { AGENT_SYSTEM, tripMessage } from './prompt'
import { DEEPSEEK_TOOLS, argSchemas, type ToolName } from './tools'
import { Ledger, resolve, stayFor, type Constraints, type Resolved } from './schedule'
import { MAX_ROUTE_REQUESTS, applyRoute, computeRoute, planRoutes, type Optimised } from './routes'
import { SetupError, ToolInputError, checkActivityTimes, searchActivities, searchFlights, searchHotels, type ProviderEnv } from './providers'

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
  days: { date: string; stay: { name: string; rateId: string; refundable: boolean } | null; items: { node: number; kind: string; title: string; start: string; end: string; ref: string | null; routed: boolean }[] }[]
  /** What a "Book" step must act on, in order. Offers expire, so the client shows expiresAt. */
  bookable: { kind: 'flight' | 'hotel' | 'activity'; ref: string; totalMinor: number; expiresAt: string | null }[]
  unrouted: number[]
  usage: { modelTurns: number; promptTokens: number; cachedPromptTokens: number; completionTokens: number }
}

export class AgentError extends Error {}

export async function runAgent(input: AgentInput, env: AgentEnv, doFetch: typeof fetch = fetch, now: DateTime = DateTime.utc()): Promise<FinalPlan> {
  if (!env.DEEPSEEK_API_KEY || !env.DEEPSEEK_MODEL) throw new SetupError('DEEPSEEK_API_KEY and DEEPSEEK_MODEL must be set on the server.')
  const ledger = new Ledger()
  let subrequests = 0
  const counted: typeof fetch = (url, init) => {
    if (++subrequests > LIMITS.subrequests) throw new AgentError('This plan needed more lookups than one request allows. Narrow the dates or the brief.')
    return doFetch(url, init)
  }
  const messages: Message[] = [{ role: 'system', content: AGENT_SYSTEM }, { role: 'user', content: tripMessage(input) }]
  const usage = { modelTurns: 0, promptTokens: 0, cachedPromptTokens: 0, completionTokens: 0 }
  let toolCalls = 0, submits = 0

  for (let turn = 0; turn < LIMITS.modelTurns; turn++) {
    const completion = await chat(messages, env, counted)
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
      const reply = (body: unknown) => ({ role: 'tool' as const, tool_call_id: callItem.id, content: JSON.stringify(body) })
      if (!Object.hasOwn(argSchemas, name)) return reply({ error: `Unknown tool ${callItem.function.name}.` })
      let args: unknown
      try { args = JSON.parse(callItem.function.arguments) } catch { return reply({ error: 'Arguments were not valid JSON.' }) }
      const parsed = argSchemas[name as ToolName].safeParse(args)
      if (!parsed.success) return reply({ error: 'Invalid arguments', issues: parsed.error.issues.map((i: { path: PropertyKey[]; message: string }) => `${i.path.join('.')}: ${i.message}`) })
      try {
        if (name === 'submit_itinerary') {
          if (++submits > LIMITS.submitAttempts) throw new AgentError('The planner could not produce a plan without clashes. Try fewer activities or a looser budget.')
          const a = argSchemas.submit_itinerary.parse(parsed.data)
          const resolved = resolve(a.nodes, ledger, input, now)
          if (resolved.errors.length) {
            console.warn('[agent-submit]', { errors: resolved.errors.slice(0, 12) })
            return reply({ ok: false, errors: resolved.errors })
          }
          const routed = await optimise(resolved, input, env, counted, now)
          if (routed.errors.length) return reply({ ok: false, errors: routed.errors })
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
        console.warn('[agent-tool]', { tool: name, error: error instanceof Error ? error.message.slice(0, 1000) : 'unknown' })
        // A provider failing is reported to the model, which can retry once or plan around it.
        return reply({ error: 'The provider did not answer. Try once more, or plan this part as free time.' })
      }
    }))
    messages.push(...results)
    if (final) return final
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
  const errors: string[] = []
  // Without a Routes key the plan is still valid; it just isn't reordered.
  if (!env.GOOGLE_ROUTES_API_KEY) return { optimised, unrouted: [...unrouted, ...segments.flatMap((s) => s.stops)], errors }
  for (const seg of segments.slice(0, MAX_ROUTE_REQUESTS)) {
    try {
      const { result, error } = applyRoute(seg, await computeRoute(seg.body, env.GOOGLE_ROUTES_API_KEY, doFetch), c.zone)
      if (error) errors.push(error)
      if (result) optimised.push(result)
    } catch (error) {
      if (error instanceof AgentError) throw error
      unrouted.push(...seg.stops)
    }
  }
  unrouted.push(...segments.slice(MAX_ROUTE_REQUESTS).flatMap((s) => s.stops))
  return { optimised, unrouted, errors }
}

function finalPlan(a: { summary: string; assumptions: string[] }, r: Resolved, routes: Optimised[], unrouted: Resolved['blocks'], c: AgentInput, ledger: Ledger, usage: FinalPlan['usage']): FinalPlan {
  const retimed = new Map(routes.flatMap((o) => o.times.map((t) => [t.node, t] as const)))
  const notRouted = new Set(unrouted.map((b) => b.node))
  const days = new Map<string, FinalPlan['days'][number]['items']>()
  for (const b of r.blocks) {
    const local = b.start.setZone(c.zone)
    const day = local.toISODate()!
    const t = retimed.get(b.node)
    const node = { node: b.node, kind: b.kind, title: b.title, start: t?.start ?? local.toFormat('HH:mm'), end: t?.end ?? b.end.setZone(c.zone).toFormat('HH:mm'), ref: b.ref, routed: !notRouted.has(b.node) && b.kind !== 'flight' }
    days.set(day, [...(days.get(day) ?? []), node])
  }
  const bookable: FinalPlan['bookable'] = []
  const refs = new Set([...r.blocks.filter((b) => b.kind !== 'free').map((b) => b.ref!), ...r.stays.map((s) => s.rate.id)])
  for (const ref of refs) {
    const entry = ledger.get(ref)
    if (entry?.kind === 'flight') bookable.push({ kind: 'flight', ref, totalMinor: entry.totalMinor, expiresAt: entry.expiresAt })
    if (entry?.kind === 'hotel') bookable.push({ kind: 'hotel', ref, totalMinor: entry.totalMinor, expiresAt: null })
    if (entry?.kind === 'slot') bookable.push({ kind: 'activity', ref, totalMinor: entry.totalMinor, expiresAt: null })
  }
  return {
    summary: a.summary, assumptions: a.assumptions, currency: c.currency, totalMinor: r.totalMinor,
    days: [...days.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([date, items]) => {
      const stay = stayFor(date, r.stays)
      return { date, stay: stay ? { name: stay.name, rateId: stay.id, refundable: stay.refundable } : null, items: items.sort((x, y) => x.start.localeCompare(y.start)) }
    }),
    bookable, unrouted: [...notRouted], usage,
  }
}
