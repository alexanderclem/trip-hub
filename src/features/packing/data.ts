import { useLiveQuery } from 'dexie-react-hooks'
import { db, type TripDb } from '@/data/db'
import { save, saveMany, softDelete } from '@/data/repo'
import type { PackingCheck, PackingItem, PackingKind } from '@/data/types'
import { newId, stableId } from '@/lib/ids'
import type { Starter } from './starters'

const alive = <T extends { deleted_at?: string | null }>(r: T) => !r.deleted_at

export function usePacking(tripId: string) {
  return useLiveQuery(async () => {
    const [items, checks] = await Promise.all([
      db.packing_items.where('trip_id').equals(tripId).filter(alive).toArray(),
      db.packing_checks.where('trip_id').equals(tripId).toArray(),
    ])
    items.sort((a, b) => (a.category ?? '~').localeCompare(b.category ?? '~') || a.title.localeCompare(b.title))
    return { items, checks }
  }, [tripId])
}

export function usePackingItem(id: string | undefined) {
  return useLiveQuery(async () => (id ? (await db.packing_items.get(id)) ?? null : null), [id])
}

export const checkId = (tripId: string, itemId: string, memberId: string) => stableId(tripId, 'pack', itemId, memberId)

export type PackingFields = Pick<PackingItem, 'title' | 'kind' | 'category' | 'owner_id' | 'quantity' | 'notes'>

/** Who owns an item of this kind: nobody for "everyone", me for "personal", the chosen person for group gear. */
function ownerFor(kind: PackingKind, owner: string | null, me: string | null) {
  if (kind === 'everyone') return null
  if (kind === 'personal') return me
  return owner
}

export async function savePackingItem(tripId: string, id: string | undefined, fields: PackingFields, me: string | null, database: TripDb = db) {
  const title = fields.title.trim()
  if (!title || title.length > 200) throw new Error('Use a name between 1 and 200 characters.')
  if (fields.kind === 'personal' && !me) throw new Error('Choose who you are first, so this goes on your list.')
  if (fields.quantity != null && (!Number.isInteger(fields.quantity) || fields.quantity < 1 || fields.quantity > 99)) throw new Error('Quantity must be between 1 and 99.')
  const existing = id ? await database.packing_items.get(id) : undefined
  if (id && (!existing || existing.deleted_at || existing.trip_id !== tripId)) throw new Error('This item was removed. Return to Packing to add it again.')
  const owner_id = ownerFor(fields.kind, fields.owner_id, existing?.kind === 'personal' && fields.kind === 'personal' ? existing.owner_id : me)
  if (owner_id) {
    const member = await database.members.get(owner_id)
    if (!member || member.trip_id !== tripId || member.deleted_at) throw new Error('Choose someone who is still in this trip.')
  }
  const row: PackingItem = {
    ...existing, id: id ?? newId(), trip_id: tripId, packed: existing?.packed ?? false,
    ...fields, owner_id, title, category: fields.category?.trim() || null, notes: fields.notes?.trim() || null,
  }
  await save('packing_items', row, me, database)
  return row.id
}

/** Group gear and personal items: one shared packed tick. */
export async function setPacked(id: string, packed: boolean, me: string | null, database: TripDb = db) {
  const item = await database.packing_items.get(id)
  if (!item || item.deleted_at) throw new Error('This item has been removed.')
  await save('packing_items', { ...item, packed }, me, database)
}

/** Claim group gear (or hand it back with null). Claiming resets the packed tick. */
export async function claim(id: string, owner: string | null, me: string | null, database: TripDb = db) {
  const item = await database.packing_items.get(id)
  if (!item || item.deleted_at || item.kind !== 'group') throw new Error('This item has been removed.')
  await save('packing_items', { ...item, owner_id: owner, packed: owner === item.owner_id ? item.packed : false }, me, database)
}

/** My tick on an "everyone brings" item. Clearing stores null; ticks are never deleted. */
export async function setMyCheck(tripId: string, itemId: string, memberId: string, state: PackingCheck['state'], database: TripDb = db) {
  const row: PackingCheck = { id: checkId(tripId, itemId, memberId), trip_id: tripId, item_id: itemId, member_id: memberId, state }
  const existing = await database.packing_checks.get(row.id)
  await save('packing_checks', { ...existing, ...row }, memberId, database)
}

export const deletePackingItem = (id: string, me: string | null) => softDelete('packing_items', id, me)

/** Adds suggested items that aren't on the list yet. Stable ids, so two phones tapping it agree. */
export async function addStarters(tripId: string, starters: Starter[], me: string | null, database: TripDb = db) {
  const rows: PackingItem[] = []
  for (const s of starters) {
    const id = stableId(tripId, 'pack-starter', s.key)
    const existing = await database.packing_items.get(id)
    if (existing) continue // already added, or removed on purpose (deletes are sticky)
    rows.push({ id, trip_id: tripId, title: s.title, kind: s.kind, category: s.category, owner_id: null, packed: false, quantity: null, notes: null })
  }
  if (rows.length) await saveMany('packing_items', rows, me, database)
  return rows.length
}

/** "5/8 packed" for an everyone item: people who packed, skipped, or haven't yet. */
export function tally(itemId: string, checks: PackingCheck[], memberIds: string[]) {
  const byMember = new Map(checks.filter((c) => c.item_id === itemId).map((c) => [c.member_id, c.state]))
  const packed = memberIds.filter((m) => byMember.get(m) === 'packed')
  const skipped = memberIds.filter((m) => byMember.get(m) === 'skip')
  const waiting = memberIds.filter((m) => !byMember.get(m))
  return { packed, skipped, waiting, needed: memberIds.length - skipped.length }
}
