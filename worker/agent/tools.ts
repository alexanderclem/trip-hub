// Tool definitions for the booking agent (docs/AGENT_PLANNER.md), in OpenAI tool-calling format with
// `strict: true`. Strict mode needs every property listed in `required` and
// `additionalProperties: false`, so optional values are `["type", "null"]`.
// The zod schemas below are the server's own check: the model's arguments are parsed again before any
// provider is called, because strict decoding is a provider feature we don't control.
import { z } from 'zod'

const iata = { type: 'string', pattern: '^[A-Z]{3}$', description: 'IATA airport or city code, e.g. "GUA". Never guess: ask if unknown.' } as const
const isoDate = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Local date, YYYY-MM-DD' } as const
const currency = { type: 'string', pattern: '^[A-Z]{3}$', description: 'ISO 4217 code from the trip constraints' } as const

function tool<const N extends string>(name: N, description: string, properties: Record<string, unknown>) {
  return { type: 'function', function: { name, description, strict: true, parameters: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false } } } as const
}

export const TOOLS = [
  tool('search_flights', 'Search bookable flights (LiteAPI). One call per itinerary; a round trip is two slices. Uses the trip currency. Returns offer ids that expire.', {
    slices: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'object', properties: { origin: iata, destination: iata, departure_date: isoDate }, required: ['origin', 'destination', 'departure_date'], additionalProperties: false } },
    adults: { type: 'integer', minimum: 1, maximum: 9 },
    cabin_class: { type: 'string', enum: ['economy', 'premium_economy', 'business', 'first'] },
    max_connections: { type: ['integer', 'null'], minimum: 0, maximum: 2 },
  }),
  tool('search_hotels', 'Search bookable hotel rates (LiteAPI) for one stay. Returns rate offer ids, names, coordinates and refundability.', {
    city_name: { type: 'string', minLength: 1, maxLength: 80 },
    country_code: { type: 'string', pattern: '^[A-Z]{2}$', description: 'ISO 3166-1 alpha-2' },
    checkin: isoDate,
    checkout: isoDate,
    adults_per_room: { type: 'integer', minimum: 1, maximum: 6 },
    rooms: { type: 'integer', minimum: 1, maximum: 9 },
    currency,
    max_nightly_minor: { type: ['integer', 'null'], minimum: 0, description: 'Upper bound per room per night in minor units' },
    min_stars: { type: ['integer', 'null'], minimum: 1, maximum: 5 },
  }),
  tool('search_activities', 'Search bookable tours and activities (LiteAPI Experiences) in a destination for a date range. Returns product codes and durations, not start times.', {
    destination_name: { type: 'string', minLength: 1, maxLength: 80 },
    start_date: isoDate,
    end_date: isoDate,
    tags: { type: 'array', maxItems: 5, items: { type: 'string', enum: ['food', 'culture', 'nature', 'adventure', 'nightlife', 'relaxation', 'family', 'water'] } },
    currency,
    max_price_minor: { type: ['integer', 'null'], minimum: 0, description: 'Per person, minor units' },
  }),
  tool('check_activity_times', 'Get real bookable start times and party totals (LiteAPI Experiences) for one product on one date. Required before scheduling an activity.', {
    product_code: { type: 'string', pattern: '^[0-9]{1,20}$', description: 'A product_code returned by search_activities' },
    travel_date: isoDate,
    adults: { type: 'integer', minimum: 1, maximum: 9 },
    currency,
  }),
  tool('submit_itinerary', 'Finish. Submit the itinerary as nodes that reference offer ids you received. The server checks every reference and every time; it will return errors to fix if any.', {
    summary: { type: 'string', maxLength: 600 },
    nodes: { type: 'array', minItems: 1, maxItems: 80, items: { type: 'object', additionalProperties: false,
      required: ['kind', 'ref', 'day', 'start_time', 'duration_minutes', 'note'],
      properties: {
        kind: { type: 'string', enum: ['flight', 'hotel', 'activity', 'free'] },
        ref: { type: ['string', 'null'], description: 'flight: offer_id. hotel: rate_id. activity: slot_id from check_activity_times. free: a place_id from trip.places, or null.' },
        day: isoDate,
        start_time: { type: ['string', 'null'], pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', description: 'Local 24h time. null for flights and hotels (the offer fixes it). For free nodes, the earliest you intend to start.' },
        duration_minutes: { type: ['integer', 'null'], minimum: 15, maximum: 600, description: 'Free nodes only: time to spend there. null otherwise.' },
        note: { type: 'string', maxLength: 200 },
      } } },
    assumptions: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 200 } },
  }),
] as const

// DeepSeek strict mode supports anyOf, but not min/max string or array lengths. Keep those
// bounds in our zod validators and adapt only the wire schema, including nullable properties.
// https://api-docs.deepseek.com/guides/tool_calls/
export function deepseekSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepseekSchema)
  if (!value || typeof value !== 'object') return value
  const schema = value as Record<string, unknown>
  const out = Object.fromEntries(Object.entries(schema)
    .filter(([key]) => !['minLength', 'maxLength', 'minItems', 'maxItems'].includes(key))
    .map(([key, child]) => [key, deepseekSchema(child)]))
  if (Array.isArray(out.type)) {
    const { type, description, ...constraints } = out
    return { ...(description ? { description } : {}), anyOf: (type as unknown[]).map((t) => t === 'null' ? { type: 'null' } : { type: t, ...constraints }) }
  }
  return out
}
export const DEEPSEEK_TOOLS = TOOLS.map((t) => ({ ...t, function: { ...t.function, parameters: deepseekSchema(t.function.parameters) } }))

export type ToolName = (typeof TOOLS)[number]['function']['name']

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const code3 = z.string().regex(/^[A-Z]{3}$/)
export const argSchemas = {
  search_flights: z.object({ slices: z.array(z.object({ origin: code3, destination: code3, departure_date: date })).min(1).max(4), adults: z.number().int().min(1).max(9), cabin_class: z.enum(['economy', 'premium_economy', 'business', 'first']), max_connections: z.number().int().min(0).max(2).nullable() }).strict(),
  search_hotels: z.object({ city_name: z.string().min(1).max(80), country_code: z.string().regex(/^[A-Z]{2}$/), checkin: date, checkout: date, adults_per_room: z.number().int().min(1).max(6), rooms: z.number().int().min(1).max(9), currency: code3, max_nightly_minor: z.number().int().min(0).nullable(), min_stars: z.number().int().min(1).max(5).nullable() }).strict().refine((v) => v.checkout > v.checkin, 'checkout must be after checkin'),
  search_activities: z.object({ destination_name: z.string().min(1).max(80), start_date: date, end_date: date, tags: z.array(z.enum(['food', 'culture', 'nature', 'adventure', 'nightlife', 'relaxation', 'family', 'water'])).max(5), currency: code3, max_price_minor: z.number().int().min(0).nullable() }).strict(),
  check_activity_times: z.object({ product_code: z.string().regex(/^[0-9]{1,20}$/), travel_date: date, adults: z.number().int().min(1).max(9), currency: code3 }).strict(),
  submit_itinerary: z.object({
    summary: z.string().max(600),
    nodes: z.array(z.object({ kind: z.enum(['flight', 'hotel', 'activity', 'free']), ref: z.string().nullable(), day: date, start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(), duration_minutes: z.number().int().min(15).max(600).nullable(), note: z.string().max(200) }).strict()).min(1).max(80),
    assumptions: z.array(z.string().max(200)).max(8),
  }).strict(),
} satisfies Record<ToolName, z.ZodType>

export type Args<T extends ToolName> = z.infer<(typeof argSchemas)[T]>
export type SubmittedNode = Args<'submit_itinerary'>['nodes'][number]
