// Seam for showing a third-party rating badge next to the group's own rating, if the group ever
// accepts a credit card (e.g. TripAdvisor's 5,000 free calls/month). Deliberately empty in v1:
// every provider either needs a card or forbids caching, so badges would be online-only and must
// never be stored in IndexedDB or Supabase.
import type { ReactNode } from 'react'
import type { Place } from '@/data/types'

export interface RatingBadge {
  rating: number // provider's scale, normalised to 0–5
  count: number
  url: string // where the reviews live
}

export interface RatingProvider {
  id: string
  onlineOnly: true
  getBadge(place: Place): Promise<RatingBadge | null>
  attribution: ReactNode // logo/text the provider's terms require
}

export const RATING_PROVIDERS: RatingProvider[] = []
