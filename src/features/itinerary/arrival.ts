import type { ItineraryItem } from '@/data/types'

/** Explicit time at the destination before the activity starts. Never assume airline policy. */
export function arrivalMinutes(item: Pick<ItineraryItem, 'details' | 'all_day' | 'kind'>): number {
  if (item.all_day || item.kind === 'lodging') return 0
  const value = Number(item.details?.arrival_buffer_minutes ?? 0)
  return Number.isInteger(value) && value >= 0 && value <= 1440 ? value : 0
}
