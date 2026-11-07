import { Sparkles } from 'lucide-react'
import type { ItineraryItem } from '@/data/types'

/** Planned by Stowie: a trip-ideas draft (`ai_draft_id`) or a live-price plan (`live_plan_id`). */
export const isAiPlanned = (item: Pick<ItineraryItem, 'details'>) => !!(item.details?.ai_draft_id || item.details?.live_plan_id)

const CAVEAT = 'Planned by Stowie. Check costs and availability before booking.'

// Older AI items carry their caveat as a line of notes; the flag says it now.
const LEGACY_NOTES = ['AI draft; costs and availability need checking.', 'From a live-price plan. Not booked yet, and prices can change.']

/** An item's notes without the caveat line older AI drafts wrote into them. */
export function itemNotes(item: Pick<ItineraryItem, 'notes' | 'details'>): string | null {
  if (!item.notes || !isAiPlanned(item)) return item.notes
  const kept = item.notes.split('\n').filter((line) => !LEGACY_NOTES.includes(line.trim()))
  return kept.join('\n').trim() || null
}

/**
 * A small "AI" flag for plan items Stowie made. `full` spells out the caveat (item detail); the
 * compact flag keeps it for screen readers and as a tooltip.
 */
export function AiFlag({ full = false, className = '' }: { full?: boolean; className?: string }) {
  if (full) {
    return (
      <span className={`inline-flex items-start gap-1.5 text-sm text-muted ${className}`}>
        <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-mist px-1.5 text-[0.6875rem] leading-4 font-semibold text-ink"><Sparkles aria-hidden="true" className="size-3 text-action" />AI</span>
        <span>Planned by Stowie · check costs and availability before booking</span>
      </span>
    )
  }
  return (
    <span title={CAVEAT} className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-mist px-1.5 text-[0.6875rem] leading-4 font-semibold text-ink ${className}`}>
      <Sparkles aria-hidden="true" className="size-3 text-action" />
      <span aria-hidden="true">AI</span><span className="sr-only">{CAVEAT}</span>
    </span>
  )
}
