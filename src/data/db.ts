import Dexie, { type EntityTable } from 'dexie'
import type { Draft } from '@/features/discovery/model'
import type { WeatherRow } from '@/features/itinerary/weather'
import type { MemberPreference } from './types'
import type { Attachment, DayNote, ExpenseRow, FxSnapshot, SettlementRow, ItineraryItem, LegOverride, LocalColumns, Link, Member, Place, PlaceRating, Poll, PollOption, PollVote, RouteLeg, TableName, Trip, TripTask, PackingItem, PackingCheck, MemberSafety } from './types'

export interface OutboxEntry {
  seq?: number
  table: TableName
  rowId: string
  lrev: number
  payload: Record<string, unknown>
  attempts: number
  nextAttemptAt: number
  lastError?: string
}

export interface DeadLetter {
  id?: number
  table: TableName
  rowId: string
  payload: Record<string, unknown>
  error: string
  at: number
}

/** Offline map files, when the browser can't write them to OPFS. */
export interface StoredFile {
  name: string
  blob: Blob
}

export interface Meta {
  key: string
  value: string
}

export class TripDb extends Dexie {
  trips!: EntityTable<Trip & LocalColumns, 'id'>
  members!: EntityTable<Member & LocalColumns, 'id'>
  member_preferences!: EntityTable<MemberPreference & LocalColumns, 'id'>
  ai_drafts!: EntityTable<Draft, 'id'>
  places!: EntityTable<Place & LocalColumns, 'id'>
  links!: EntityTable<Link & LocalColumns, 'id'>
  route_legs!: EntityTable<RouteLeg & LocalColumns, 'id'>
  leg_overrides!: EntityTable<LegOverride & LocalColumns, 'id'>
  polls!: EntityTable<Poll & LocalColumns, 'id'>
  poll_options!: EntityTable<PollOption & LocalColumns, 'id'>
  poll_votes!: EntityTable<PollVote & LocalColumns, 'id'>
  place_ratings!: EntityTable<PlaceRating & LocalColumns, 'id'>
  itinerary_items!: EntityTable<ItineraryItem & LocalColumns, 'id'>
  day_notes!: EntityTable<DayNote & LocalColumns, 'id'>
  expenses!: EntityTable<ExpenseRow & LocalColumns, 'id'>
  settlements!: EntityTable<SettlementRow & LocalColumns, 'id'>
  fx_snapshots!: EntityTable<FxSnapshot & LocalColumns, 'id'>
  attachments!: EntityTable<Attachment & LocalColumns, 'id'>
  trip_tasks!: EntityTable<TripTask & LocalColumns, 'id'>
  packing_items!: EntityTable<PackingItem & LocalColumns, 'id'>
  packing_checks!: EntityTable<PackingCheck & LocalColumns, 'id'>
  member_safety!: EntityTable<MemberSafety & LocalColumns, 'id'>
  _outbox!: EntityTable<OutboxEntry, 'seq'>
  _deadletter!: EntityTable<DeadLetter, 'id'>
  _meta!: EntityTable<Meta, 'key'>
  files!: EntityTable<StoredFile, 'name'>
  /** Weather for plan days; this phone only, never synced. */
  weather!: EntityTable<WeatherRow, 'id'>

  constructor(name = 'trip-hub') {
    super(name)
    this.version(1).stores({
      trips: 'id',
      members: 'id, trip_id',
      places: 'id, trip_id, [trip_id+category], [trip_id+status]',
      links: 'id, trip_id, place_id',
      _outbox: '++seq, &[table+rowId], nextAttemptAt',
      _deadletter: '++id',
      _meta: 'key',
    })
    this.version(2).stores({
      route_legs: 'id, trip_id, from_place_id, to_place_id',
      leg_overrides: 'id, trip_id, place_a_id, place_b_id',
    })
    this.version(3).stores({ files: 'name' })
    this.version(4).stores({
      polls: 'id, trip_id',
      poll_options: 'id, trip_id, poll_id, place_id',
      poll_votes: 'id, trip_id, poll_id, option_id, member_id',
      place_ratings: 'id, trip_id, place_id, member_id',
    })
    this.version(5).stores({
      itinerary_items: 'id, trip_id, place_id, to_place_id, start_at',
      day_notes: 'id, trip_id',
    })
    this.version(6).stores({
      expenses: 'id, trip_id, item_id, place_id',
      settlements: 'id, trip_id',
      fx_snapshots: 'id, trip_id',
    })
    this.version(7).stores({ attachments: 'id, trip_id, item_id' })
    this.version(8).stores({ trip_tasks: 'id, trip_id, assignee_id, due_date' })
    this.version(9).stores({ member_preferences: 'id, trip_id, member_id', ai_drafts: 'id, scope, createdAt' })
    this.version(10).stores({ weather: 'id, trip_id' })
    this.version(11).stores({ packing_items: 'id, trip_id, owner_id', packing_checks: 'id, trip_id, item_id' })
    this.version(12).stores({ member_safety: 'id, trip_id, member_id' })
  }
}

export const db = new TripDb()
