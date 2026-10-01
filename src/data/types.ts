// Row shapes mirror supabase/migrations. Every synced row carries the standard columns.

export interface SyncColumns {
  id: string
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
  created_by?: string | null
  updated_by?: string | null
}

/** Local-only bookkeeping on every row mirrored in IndexedDB. */
export interface LocalColumns {
  _dirty?: 0 | 1 // has edits not yet accepted by the server
  _lrev?: number // local revision, bumped on every local save
}

export interface Trip extends SyncColumns {
  name: string
  timezone: string
  start_date: string | null
  end_date: string | null
  base_currency: string
  local_currency: string | null
  route_factor_low: number
  route_factor_high: number
  bbox: number[] | null
  offline_pack: unknown
  share_token: string
  settings: Record<string, unknown>
}

export interface Member extends SyncColumns {
  trip_id: string
  display_name: string
  color: string | null
  avatar_emoji: string | null
  home_timezone: string | null
}

export const PLACE_CATEGORIES = [
  'lodging',
  'food',
  'drink',
  'activity',
  'sight',
  'reservation',
  'transport',
  'flight',
  'shopping',
  'other',
] as const
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number]

export const PLACE_STATUSES = [
  'catalog',
  'shortlist',
  'planned',
  'booked',
  'visited',
  'rejected',
] as const
export type PlaceStatus = (typeof PLACE_STATUSES)[number]

export interface Place extends SyncColumns {
  trip_id: string
  name: string
  category: PlaceCategory
  tags: string[]
  lat: number | null
  lng: number | null
  address: string | null
  area: string | null
  status: PlaceStatus
  notes: string | null
  phone: string | null
  website: string | null
  opening_hours: string | null
  external_ids: Record<string, string>
  source: 'osm' | 'manual' | 'import' | 'suggestion'
}

export const LINK_KINDS = ['booking', 'menu', 'info', 'map', 'other'] as const
export type LinkKind = (typeof LINK_KINDS)[number]

export interface Link extends SyncColumns {
  trip_id: string
  place_id: string | null
  item_id: string | null
  expense_id: string | null
  url: string
  label: string | null
  kind: LinkKind
}

export const TRAVEL_MODES = ['walk', 'drive', 'tuktuk', 'shuttle', 'bus', 'boat', 'flight'] as const
export type TravelMode = (typeof TRAVEL_MODES)[number]

/** Computed by the route-legs Edge Function. Directional. */
export interface RouteLeg extends SyncColumns {
  trip_id: string
  from_place_id: string
  to_place_id: string
  mode: 'drive' | 'walk'
  distance_m: number | null
  duration_s: number | null
  source: 'ors' | 'osrm'
  from_lat: number | null
  from_lng: number | null
  to_lat: number | null
  to_lng: number | null
  computed_at: string
}

/** A time someone reported for a pair of places. Undirected: place_a_id < place_b_id. */
export interface LegOverride extends SyncColumns {
  trip_id: string
  place_a_id: string
  place_b_id: string
  mode: TravelMode
  min_s: number
  max_s: number
  note: string | null
}

/** Typical town-to-town options (lanchas, tourist shuttles), kept in trips.settings.area_routes. */
export interface AreaRoute {
  a: string
  b: string
  mode: TravelMode
  min_min: number
  max_min: number
  note?: string
}

/** 0 No way · 1 Fine · 2 Want · 3 Must-do. */
export const VOTE_SCORES = [0, 1, 2, 3] as const
export type VoteScore = (typeof VOTE_SCORES)[number]

export interface Poll extends SyncColumns {
  trip_id: string
  title: string
  description: string | null
  status: 'open' | 'closed'
  winner_option_id: string | null
}

export interface PollOption extends SyncColumns {
  trip_id: string
  poll_id: string
  label: string
  place_id: string | null
  url: string | null
  description: string | null
}

/** One per (option, member); id = stableId(trip, 'vote', option, member). score null = no vote. */
export interface PollVote extends SyncColumns {
  trip_id: string
  poll_id: string
  option_id: string
  member_id: string
  score: VoteScore | null
}

/** One per (place, member); id = stableId(trip, 'rating', place, member). stars null = withdrawn. */
export interface PlaceRating extends SyncColumns {
  trip_id: string
  place_id: string
  member_id: string
  stars: number | null
  note: string | null
}

export const ITEM_KINDS = ['activity', 'meal', 'flight', 'transport', 'lodging', 'reservation', 'free'] as const
export type ItemKind = (typeof ITEM_KINDS)[number]
export const ITEM_STATUSES = ['idea', 'tentative', 'confirmed', 'cancelled'] as const
export type ItemStatus = (typeof ITEM_STATUSES)[number]

/** Times are wall-clock local + IANA zone per end; start_at/end_at are derived instants. */
export interface ItineraryItem extends SyncColumns {
  trip_id: string
  title: string
  kind: ItemKind
  place_id: string | null
  to_place_id: string | null
  all_day: boolean
  start_local: string // 'yyyy-MM-ddTHH:mm' (server adds ':00')
  start_tz: string
  end_local: string | null
  end_tz: string | null
  start_at: string
  end_at: string | null
  status: ItemStatus
  confirmation_code: string | null
  attendee_ids: string[] | null // null = everyone
  details: Record<string, string>
  notes: string | null
  est_cost_minor: number | null
  est_cost_currency: string | null
}

/** One per (trip, date); id = stableId(trip, 'day', date). */
export interface DayNote extends SyncColumns {
  trip_id: string
  date: string // 'yyyy-MM-dd'
  title: string | null
  notes: string | null
}

export interface Tables {
  trips: Trip
  members: Member
  places: Place
  links: Link
  route_legs: RouteLeg
  leg_overrides: LegOverride
  polls: Poll
  poll_options: PollOption
  poll_votes: PollVote
  place_ratings: PlaceRating
  itinerary_items: ItineraryItem
  day_notes: DayNote
}
export type TableName = keyof Tables
