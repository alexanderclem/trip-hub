import { z } from 'zod'
import { ITEM_KINDS } from '@/data/types'

const short = (max: number) => z.string().trim().max(max).nullable()
export const importEntrySchema = z.object({
  title: z.string().trim().min(1).max(200), kind: z.enum(ITEM_KINDS),
  start_local: short(16), end_local: short(16), start_tz: short(80), end_tz: short(80),
  address: short(400), confirmation_code: short(80), flight: short(30),
  notes: short(2000), source_url: short(2000),
})
export const importResultSchema = z.object({ entries: z.array(importEntrySchema).max(20) })
export type ImportEntry = z.infer<typeof importEntrySchema>
export const importRequestSchema = z.object({ text: z.string().trim().min(5).max(20000), timezone: z.string().min(1).max(80) })

export function safeSource(value: string | null): string | null {
  if (!value) return null
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null } catch { return null }
}
