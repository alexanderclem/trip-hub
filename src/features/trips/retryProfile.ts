import { db, type TripDb } from '@/data/db'
import { save } from '@/data/repo'
import { normalizeVenmo } from './traveler'

/** Restore only profile fields onto the current row; preserve other changes from the group. */
export async function retrySavedProfile(id: number, tripId: string, me: string | null, database: TripDb = db) {
  await database.transaction('rw', database.members, database._outbox, database._deadletter, async () => {
    const entry = await database._deadletter.get(id)
    if (!entry || entry.table !== 'members' || entry.payload.trip_id !== tripId) throw new Error('This saved profile is no longer available.')
    const member = await database.members.get(entry.rowId)
    if (!member || member.deleted_at || member.trip_id !== tripId) throw new Error('This traveler is no longer in the trip.')
    if (await database._outbox.where('[table+rowId]').equals(['members', member.id]).first()) throw new Error('Sync your newer profile edit first before retrying this saved version.')
    const name = String(entry.payload.display_name ?? member.display_name).trim()
    if (!name || name.length > 100) throw new Error('Edit the traveler name before saving again.')
    const photo = entry.payload.avatar_url
    if (photo != null && (typeof photo !== 'string' || !photo.startsWith('data:image/jpeg;base64,') || photo.length > 200000)) throw new Error('Choose the profile photo again.')
    await save('members', {
      ...member, display_name: name,
      ...(Object.hasOwn(entry.payload, 'venmo_username') ? { venmo_username: normalizeVenmo(String(entry.payload.venmo_username ?? '')) } : {}),
      ...(Object.hasOwn(entry.payload, 'avatar_url') ? { avatar_url: photo as string | null } : {}),
    }, me, database)
    await database._deadletter.delete(id)
  })
}
