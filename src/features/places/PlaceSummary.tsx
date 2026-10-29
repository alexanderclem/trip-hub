import { Check, Clock3, Lightbulb, ListPlus, Ticket, X } from 'lucide-react'
import type { Place, PlaceStatus } from '@/data/types'
import { CATEGORY_STYLE, STATUS_LABEL } from './categories'

const statusStyles: Record<PlaceStatus, { Icon: typeof Check; className: string }> = {
  catalog: { Icon: Lightbulb, className: 'bg-mist/60 text-muted' },
  shortlist: { Icon: ListPlus, className: 'bg-brand-50 text-ink' },
  planned: { Icon: Clock3, className: 'bg-mist text-action' },
  booked: { Icon: Ticket, className: 'bg-warning text-warning-ink' },
  visited: { Icon: Check, className: 'bg-success text-success-ink' },
  rejected: { Icon: X, className: 'bg-mist/60 text-muted' },
}

export function PlaceStatusBadge({ status }: { status: PlaceStatus }) {
  const { Icon, className } = statusStyles[status]
  return <span className={`inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-xs font-medium ${className}`}><Icon aria-hidden="true" className="size-3.5" />{STATUS_LABEL[status]}</span>
}

export function PlaceCategoryIcon({ category }: { category: Place['category'] }) {
  const { Icon, color } = CATEGORY_STYLE[category]
  return <span className="flex size-11 shrink-0 items-center justify-center rounded-control border border-line bg-mist/40" style={{ color }}><Icon aria-hidden="true" className="size-5" /></span>
}

// Only public web links are suitable for these external quick actions.
export function webLink(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null
  } catch { return null }
}

export const placeActionClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-control hover:bg-brand-50 active:bg-brand-50'
