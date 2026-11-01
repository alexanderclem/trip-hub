// More → Payments → Rooming board (Pro): who sleeps where. Rooms are named by the organizer; each
// traveler is moved with a select, so it works by keyboard, VoiceOver and touch alike, offline too
// (room_assignments syncs like the rest of the plan). "Unassigned" is a null room, never a delete.

import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download } from 'lucide-react'
import { db } from '@/data/db'
import { useDevice } from '@/data/device'
import { useTrip } from '@/data/hooks'
import { save } from '@/data/repo'
import { stableId } from '@/lib/ids'
import type { Booking, RoomAssignment } from '@/data/types'
import { Button, Card, ErrorNote, Input, PageHeader, SectionTitle, Select } from '@/ui'
import { LoadingState } from '@/ui/LoadingState'
import { downloadText, roomingCsv, useTripBookings, useTripOffer } from './data'
import { ProBadge, useMyOrganizer } from './pro'

export function RoomingScreen() {
  const { tripId } = useParams() as { tripId: string }
  const trip = useTrip(tripId)
  const offer = useTripOffer(tripId)
  const bookings = useTripBookings(tripId)
  const rooms = useLiveQuery(() => db.room_assignments.where('trip_id').equals(tripId).toArray(), [tripId])
  const me = useDevice((s) => s.trips[tripId]?.memberId ?? null)
  const pro = useMyOrganizer()
  const [extra, setExtra] = useState<string[]>([])
  const [newRoom, setNewRoom] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!trip || offer === undefined || !bookings || !rooms) return <LoadingState fullScreen title="Loading rooms…" />
  const live = bookings.filter((b) => b.status === 'active' || b.status === 'paid').sort((a, z) => a.traveler_name.localeCompare(z.traveler_name))
  const roomOf = new Map(rooms.filter((r) => !r.deleted_at).map((r) => [r.booking_id, r.room_name]))
  const names = [...new Set([...rooms.filter((r) => !r.deleted_at && r.room_name).map((r) => r.room_name!), ...extra])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const typeOf = (b: Booking) => offer?.room_options?.find((o) => o.id === b.room_option)?.label

  async function move(b: Booking, room: string | null) {
    setError(null)
    const row: RoomAssignment = { ...(rooms!.find((r) => r.booking_id === b.id) ?? {}), id: stableId(tripId, 'room', b.id), trip_id: tripId, booking_id: b.id, room_name: room } as RoomAssignment
    try { await save('room_assignments', row, me) } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }
  function add(e: FormEvent) {
    e.preventDefault()
    const name = newRoom.trim().slice(0, 60)
    if (name && !names.includes(name)) setExtra([...extra, name])
    setNewRoom('')
  }

  const person = (b: Booking) => (
    <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
      <span className="min-w-0 break-words">{b.traveler_name}{typeOf(b) && <span className="text-muted"> · {typeOf(b)}</span>}{b.answers?.accessibility && <span className="text-muted"> · access: {b.answers.accessibility}</span>}</span>
      <Select aria-label={`Room for ${b.traveler_name}`} value={roomOf.get(b.id) ?? ''} onChange={(e) => void move(b, e.target.value || null)} className="w-40">
        <option value="">Unassigned</option>
        {names.map((n) => <option key={n} value={n}>{n}</option>)}
      </Select>
    </li>
  )
  const unassigned = live.filter((b) => !roomOf.get(b.id))

  return (
    <div className="pb-16">
      <PageHeader title="Rooming" back={`/t/${tripId}/more/payments`} />
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <Card>
          <SectionTitle>Rooms<ProBadge beta={pro?.beta ?? true} /></SectionTitle>
          <form onSubmit={add} className="mt-2 flex items-end gap-2">
            <Input aria-label="New room name" maxLength={60} placeholder="Casa 1, Room 204…" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} className="w-auto min-w-0 flex-1" />
            <Button type="submit" variant="secondary" disabled={!newRoom.trim()}>Add room</Button>
          </form>
          <ErrorNote error={error} />
          {live.length > 0 && offer && <button type="button" className="ui-link mt-2 inline-flex min-h-11 items-center gap-2" onClick={() => downloadText(`${trip.name.replace(/[^\w-]+/g, '-').toLowerCase()}-rooming.csv`, roomingCsv(bookings, rooms, offer))}><Download aria-hidden="true" className="size-4" />Rooming list for the hotel (CSV)</button>}
        </Card>

        <Card>
          <SectionTitle>Unassigned ({unassigned.length})</SectionTitle>
          {unassigned.length === 0 ? <p className="mt-2 text-sm text-muted">{live.length ? 'Everyone has a room.' : 'No bookings yet.'}</p> : <ul className="mt-1 divide-y divide-line text-sm">{unassigned.map(person)}</ul>}
        </Card>

        {names.map((n) => {
          const inRoom = live.filter((b) => roomOf.get(b.id) === n)
          return (
            <Card key={n}>
              <SectionTitle>{n} ({inRoom.length})</SectionTitle>
              {inRoom.length === 0 ? <p className="mt-2 text-sm text-muted">Empty. Choose this room for someone above.</p> : <ul className="mt-1 divide-y divide-line text-sm">{inRoom.map(person)}</ul>}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
