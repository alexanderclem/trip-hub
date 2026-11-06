// Details an AI pulls out of a ticket, receipt or document. Shared by the Worker (/api/scan) and
// the app, so both validate the same shape. Every field is optional: null means "not visible".

import { z } from 'zod'

const text = (max: number) => z.string().trim().min(1).max(max).nullable()

export const scanDetailsSchema = z.object({
  title: text(120).describe('Short name, e.g. "Boarding pass UA 1234" or "Dinner at Café Sky"'),
  merchant: text(120).describe('Business, airline, hotel or issuer'),
  amount: z.number().positive().max(10_000_000).nullable().describe('Total paid, as printed (major units)'),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable().describe('ISO 4217 code of the amount'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().describe('Date of purchase, travel or check-in, YYYY-MM-DD'),
  confirmation_code: text(40).describe('Booking reference, PNR or confirmation number'),
  flight: text(20).describe('Flight number like "UA 1234"'),
  notes: text(300).describe('Anything else useful in one short sentence'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().describe('Travel, event or check-in date printed on the document; never the purchase date'),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional().describe('Printed departure, event or check-in time, HH:mm; null if absent'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().describe('Printed arrival, end or check-out date'),
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional().describe('Printed arrival, end or check-out time, HH:mm'),
  start_timezone: text(80).optional().describe('IANA time zone only if explicitly identifiable from the document; null if uncertain'),
  end_timezone: text(80).optional().describe('IANA arrival time zone only if explicitly identifiable from the document; null if uncertain'),
  item_kind: z.enum(['flight', 'transport', 'lodging', 'reservation', 'activity', 'meal']).nullable().optional().describe('Type of booking, if identifiable'),
  baggage: text(500).optional().describe('Printed baggage allowance or restrictions; never infer airline policy'),
  breakfast: text(500).optional().describe('Printed breakfast inclusions or extra charges'),
  parking: text(500).optional().describe('Printed parking availability, instructions or costs'),
  cancellation: text(1000).optional().describe('Printed cancellation deadline, penalties or refund terms'),
})
export type ScanDetails = z.infer<typeof scanDetailsSchema>

export const SCAN_KINDS = ['ticket', 'reservation', 'receipt', 'document', 'photo'] as const

export const scanRequestSchema = z.object({
  kind: z.enum(SCAN_KINDS),
  /** JPEG, base64 without the data: prefix; optional when the text alone is enough. */
  image: z.string().max(2_000_000).regex(/^[A-Za-z0-9+/=]+$/).nullable(),
  text: z.string().max(20_000),
})
export type ScanRequest = z.infer<typeof scanRequestSchema>

/** Currency symbols models sometimes return instead of a code. "$" is left out: too many dollars. */
const SYMBOLS: Record<string, string> = { Q: 'GTQ', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₩': 'KRW', '₹': 'INR', '₱': 'PHP', '฿': 'THB', 'R$': 'BRL', 'MX$': 'MXN', 'C$': 'CAD', 'A$': 'AUD', 'US$': 'USD' }

function parseObject(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { /* try again with bare keys quoted */ }
  try { return JSON.parse(match[0].replace(/([{,]\s*)([A-Za-z_][\w]*)\s*:/g, '$1"$2":')) } catch { return null }
}

/** Lenient parse of model output: accepts a JSON object anywhere in the reply, keeps valid fields only. */
export function parseDetails(raw: unknown): ScanDetails | null {
  const value = typeof raw === 'string' ? parseObject(raw) : raw
  if (!value || typeof value !== 'object') return null
  const out: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(scanDetailsSchema.shape)) {
    let v = (value as Record<string, unknown>)[key]
    if (v === undefined && field.isOptional()) continue
    if (key === 'currency' && typeof v === 'string') v = SYMBOLS[v.trim()] ?? v.trim().toUpperCase()
    const parsed = field.safeParse(typeof v === 'string' && v.trim() === '' ? null : v ?? null)
    out[key] = parsed.success ? parsed.data : null
  }
  const details = out as ScanDetails
  return Object.values(details).some((v) => v !== null) ? details : null
}

/** Keeps `a`'s values and fills its gaps from `b`. */
export function mergeDetails(a: ScanDetails | null, b: ScanDetails | null): ScanDetails | null {
  if (!a || !b) return a ?? b
  return Object.fromEntries(Object.keys(scanDetailsSchema.shape).filter(k => a[k as keyof ScanDetails] !== undefined || b[k as keyof ScanDetails] !== undefined).map((k) => [k, a[k as keyof ScanDetails] ?? b[k as keyof ScanDetails]])) as ScanDetails
}
