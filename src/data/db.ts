import Dexie, { type EntityTable } from 'dexie'
import type { LegOverride, LocalColumns, Link, Member, Place, RouteLeg, TableName, Trip } from './types'

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

export interface Meta {
  key: string
  value: string
}

export class TripDb extends Dexie {
  trips!: EntityTable<Trip & LocalColumns, 'id'>
  members!: EntityTable<Member & LocalColumns, 'id'>
  places!: EntityTable<Place & LocalColumns, 'id'>
  links!: EntityTable<Link & LocalColumns, 'id'>
  route_legs!: EntityTable<RouteLeg & LocalColumns, 'id'>
  leg_overrides!: EntityTable<LegOverride & LocalColumns, 'id'>
  _outbox!: EntityTable<OutboxEntry, 'seq'>
  _deadletter!: EntityTable<DeadLetter, 'id'>
  _meta!: EntityTable<Meta, 'key'>

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
  }
}

export const db = new TripDb()
