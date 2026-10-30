import { z } from 'zod'

export const countrySchema = z.object({ name: z.string(), currencies: z.array(z.string()), languages: z.array(z.string()), callingCodes: z.array(z.string()) })
export const holidaySchema = z.object({ date: z.string(), name: z.string(), regional: z.boolean(), regions: z.array(z.string()) })
export const eventSchema = z.object({ id: z.string(), name: z.string(), date: z.string(), time: z.string().nullable(), zone: z.string().nullable(), venue: z.string(), url: z.string().url() })
export const flightSchema = z.object({ number: z.string(), date: z.string(), status: z.string(), departure: z.string(), arrival: z.string(), gate: z.string().nullable(), terminal: z.string().nullable(), scheduled: z.string().nullable(), estimated: z.string().nullable(), delay: z.number().nullable() })
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s)
const common = { tripId: z.string().uuid() }
export const travelRequestSchema = z.discriminatedUnion('action', [
  z.object({ ...common, action: z.literal('country'), country: z.string().regex(/^[A-Z]{2}$/) }),
  z.object({ ...common, action: z.literal('holidays'), country: z.string().regex(/^[A-Z]{2}$/), year: z.number().int().min(2020).max(2100) }),
  z.object({ ...common, action: z.literal('events'), city: z.string().trim().min(1).max(100), country: z.string().regex(/^[A-Z]{2}$/), start: date, end: date }).refine((v) => v.start <= v.end, { message: 'End date precedes start date' }),
  z.object({ ...common, action: z.literal('flight'), number: z.string().regex(/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/), date }),
])
export type TravelRequest = z.infer<typeof travelRequestSchema>
export type TravelEvent = z.infer<typeof eventSchema>
