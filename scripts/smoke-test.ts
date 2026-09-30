// End-to-end check against the real Supabase project with two simulated devices.
// Run: npm run smoke   (creates a trip named "SMOKE TEST …"; see printed cleanup SQL)

import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL = 'https://croqjdvzbpcscdcshnet.supabase.co'
const KEY = 'sb_publishable_FpJvcMvfUFtCO49tcx0tGA_fZUqNroP'

const device = () =>
  createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failures++
}

async function signIn(c: SupabaseClient) {
  const { data, error } = await c.auth.signInAnonymously()
  if (error || !data.user) throw new Error(`sign-in failed: ${error?.message}`)
  return data.user.id
}

async function main() {
  const A = device()
  const B = device()
  const C = device()
  await signIn(A)
  await signIn(B)
  await signIn(C)

  const tripId = randomUUID()
  const aliceId = randomUUID()
  const { data: token, error: createErr } = await A.rpc('create_trip', {
    p_trip_id: tripId, p_name: `SMOKE TEST ${new Date().toISOString()}`, p_timezone: 'America/Guatemala',
    p_start_date: '2027-03-13', p_end_date: '2027-03-21', p_base_currency: 'USD', p_local_currency: 'GTQ',
    p_member_id: aliceId, p_member_name: 'Alice', p_member_color: '#0d9488',
  })
  check('A creates a trip', !createErr && typeof token === 'string', createErr?.message)

  const { data: before } = await B.from('trips').select('id').eq('id', tripId)
  check('B cannot see the trip before joining', before?.length === 0)

  const { data: joined, error: joinErr } = await B.rpc('join_trip', { p_token: token })
  check('B joins with the link', joined === tripId, joinErr?.message)

  const bobId = randomUUID()
  const { error: newErr } = await B.rpc('create_member_and_claim', {
    p_trip_id: tripId, p_member_id: bobId, p_name: 'Bob', p_color: '#2563eb',
  })
  check('B adds themselves as a member', !newErr, newErr?.message)
  const { data: members } = await A.from('members').select('display_name').eq('trip_id', tripId)
  check('A sees both members', members?.length === 2, members?.map((m) => m.display_name).join(', '))

  // Realtime: B listens, A writes. The channel must carry B's JWT so RLS lets events through.
  await B.realtime.setAuth()
  let poked = false
  const channel = B.channel(`trip:${tripId}`).on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'places', filter: `trip_id=eq.${tripId}` },
    () => { poked = true },
  )
  await new Promise<void>((resolve) => channel.subscribe((s) => s === 'SUBSCRIBED' && resolve()))

  const placeId = randomUUID()
  const { error: upErr } = await A.from('places').upsert(
    { id: placeId, trip_id: tripId, name: 'Café Sky', category: 'food', lat: 14.5566, lng: -90.7338, created_by: aliceId, updated_by: aliceId },
    { onConflict: 'id' },
  )
  check('A adds a place (upsert through RLS)', !upErr, upErr?.message)

  for (let i = 0; i < 40 && !poked; i++) await new Promise((r) => setTimeout(r, 250))
  check('B gets a realtime poke within 10s', poked)
  await B.removeChannel(channel)

  const { data: bPlaces } = await B.from('places').select('name, updated_at').eq('trip_id', tripId)
  check('B pulls the place', bPlaces?.[0]?.name === 'Café Sky')

  const { error: editErr } = await B.from('places').upsert(
    { id: placeId, trip_id: tripId, name: 'Café Sky (rooftop)', category: 'food', updated_by: bobId },
    { onConflict: 'id' },
  )
  const { data: aPlace } = await A.from('places').select('name, updated_by').eq('id', placeId).single()
  check('B edits it and A sees the edit', !editErr && aPlace?.name === 'Café Sky (rooftop)', editErr?.message)

  const { error: delErr } = await A.from('places').update({ deleted_at: new Date().toISOString() }).eq('id', placeId)
  await B.from('places').update({ deleted_at: null }).eq('id', placeId)
  const { data: dead } = await A.from('places').select('deleted_at').eq('id', placeId).single()
  check('soft delete sticks even if another device tries to undo it', !delErr && !!dead?.deleted_at)

  // Travel times: three shortlisted places (two in Antigua, one across the lake region).
  const hotel = randomUUID()
  const dock = randomUUID()
  const cafe2 = randomUUID()
  const { error: legPlacesErr } = await A.from('places').upsert([
    { id: cafe2, trip_id: tripId, name: '12 Onzas', category: 'food', status: 'shortlist', lat: 14.557255, lng: -90.73164, area: 'Antigua' },
    { id: hotel, trip_id: tripId, name: 'Hotel test', category: 'lodging', status: 'booked', lat: 14.5581, lng: -90.7352, area: 'Antigua' },
    { id: dock, trip_id: tripId, name: 'Muelle Tzanjuyu', category: 'transport', status: 'shortlist', lat: 14.7404, lng: -91.159, area: 'Panajachel' },
  ], { onConflict: 'id' })
  check('A adds three shortlisted places for travel times', !legPlacesErr, legPlacesErr?.message)
  const { data: legRes, error: legErr } = await B.functions.invoke('route-legs', { body: { trip_id: tripId } })
  check('route-legs function computes legs', !legErr && legRes?.legs >= 6, legErr?.message ?? JSON.stringify(legRes))
  console.log('      providers:', legRes?.providers, 'warnings:', legRes?.warnings)
  const { data: legs } = await A.from('route_legs').select('from_place_id, to_place_id, mode, duration_s, distance_m, source').eq('trip_id', tripId)
  const drive = legs?.find((l) => l.from_place_id === hotel && l.to_place_id === dock && l.mode === 'drive')
  const walk = legs?.find((l) => l.from_place_id === hotel && l.to_place_id === cafe2 && l.mode === 'walk')
  check('Antigua → Panajachel drive leg is plausible (60–240 min raw)', !!drive && drive.duration_s > 3600 && drive.duration_s < 14400, drive ? `${Math.round(drive.duration_s / 60)} min, ${Math.round(drive.distance_m / 1000)} km via ${drive.source}` : 'missing')
  check('hotel → café walk leg exists and is short', !!walk && walk.duration_s < 1200, walk ? `${Math.round(walk.duration_s / 60)} min walk` : 'missing')
  check('no walking leg across the region', !legs?.some((l) => l.mode === 'walk' && (l.to_place_id === dock || l.from_place_id === dock)))
  const { error: outsiderErr, data: outsider } = await C.functions.invoke('route-legs', { body: { trip_id: tripId } })
  check('a device that has not joined gets no legs computed', !!outsiderErr || outsider?.legs === 0, JSON.stringify(outsider ?? outsiderErr?.message))

  const { data: newToken } = await A.rpc('rotate_share_token', { p_trip_id: tripId })
  const { error: oldLinkErr } = await C.rpc('join_trip', { p_token: token })
  check('after replacing the link, the old link is refused', !!oldLinkErr, oldLinkErr?.message)
  const { data: bStill } = await B.from('trips').select('id').eq('id', tripId)
  check('...but B (already joined) keeps access', bStill?.length === 1)
  const { data: cJoin } = await C.rpc('join_trip', { p_token: newToken })
  check('...and the new link works', cJoin === tripId)

  console.log(`\n${failures ? `${failures} FAILED` : 'All checks passed'}. Trip id: ${tripId}`)
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
