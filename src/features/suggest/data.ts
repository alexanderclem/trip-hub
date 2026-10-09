import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import type { ItineraryItem, Place } from '@/data/types'
import { combine, profileSchema } from '@/features/discovery/model'
import type { DayLayout } from '@/features/itinerary/layout'
import type { LatLng } from '@/lib/geo'
import { suggestForDay, type Suggestion } from './rank'

/** Rain is "likely" from here up, which is when an outdoor idea stops being a good one. */
const RAINY_PCT = 50

/** Ideas for the free parts of one day, kept live from IndexedDB. undefined while loading. */
export function useDaySuggestions({ tripId, day, places, items, layout, anchor, rainPct }: {
  tripId: string; day: string; places: Place[]; items: ItineraryItem[]; layout: DayLayout; anchor: LatLng | null; rainPct: number | null
}): Suggestion[] | undefined {
  const group = useLiveQuery(async () => {
    const rows = (await db.member_preferences.where('trip_id').equals(tripId).toArray()).filter((r) => !r.deleted_at)
    return combine(rows.flatMap((r) => { const p = profileSchema.safeParse(r); return p.success ? [p.data] : [] }))?.mean ?? null
  }, [tripId])
  const ratings = useLiveQuery(async () => {
    const sums = new Map<string, { total: number; n: number }>()
    for (const r of await db.place_ratings.where('trip_id').equals(tripId).toArray()) {
      if (r.deleted_at || r.stars === null) continue
      const sum = sums.get(r.place_id) ?? { total: 0, n: 0 }
      sums.set(r.place_id, { total: sum.total + r.stars, n: sum.n + 1 })
    }
    return new Map([...sums].map(([id, { total, n }]) => [id, total / n]))
  }, [tripId])

  return useMemo(() => {
    if (group === undefined || ratings === undefined) return undefined
    const live = items.filter((i) => !i.deleted_at && i.status !== 'cancelled')
    const plannedPlaceIds = new Set(live.flatMap((i) => [i.place_id, i.to_place_id]).filter((id): id is string => !!id))
    // "Where you're staying" only when that is what the day is anchored on.
    const staying = layout.stays.some((s) => { const p = places.find((x) => x.id === s.place_id); return p?.lat != null && p.lng != null })
    return suggestForDay({ day, places, layout, anchor, staying, group, ratings, rainy: (rainPct ?? 0) >= RAINY_PCT, plannedPlaceIds })
  }, [group, ratings, items, places, layout, anchor, day, rainPct])
}
