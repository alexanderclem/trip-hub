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

export interface Tables {
  trips: Trip
  members: Member
  places: Place
  links: Link
}
export type TableName = keyof Tables
