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

/** Lenient parse of model output: accepts a JSON object anywhere in the reply, keeps valid fields only. */
export function parseDetails(raw: unknown): ScanDetails | null {
  let value = raw
  if (typeof raw === 'string') {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    try { value = JSON.parse(match[0]) } catch { return null }
  }
  if (!value || typeof value !== 'object') return null
  const out: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(scanDetailsSchema.shape)) {
    const v = (value as Record<string, unknown>)[key]
    const parsed = field.safeParse(typeof v === 'string' && v.trim() === '' ? null : v ?? null)
    out[key] = parsed.success ? parsed.data : null
  }
  const details = out as ScanDetails
  return Object.values(details).some((v) => v !== null) ? details : null
}
