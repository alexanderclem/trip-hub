// POST { trip_id } → computes drive/walk legs between the trip's shortlisted+ places and
// upserts them into route_legs. Runs as the calling user (their JWT), so row-level security
// decides what it can read and write; no service key is used.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { v5 as uuidv5 } from 'npm:uuid@11'
import { computeLegs } from './routing.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const MAX_PLACES = 120

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const authorization = req.headers.get('Authorization')
  if (!authorization) return json({ error: 'Not signed in' }, 401)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } },
  )
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) return json({ error: 'Not signed in' }, 401)

  let tripId: string
  try {
    tripId = (await req.json()).trip_id
    if (!/^[0-9a-f-]{36}$/i.test(tripId)) throw new Error()
  } catch {
    return json({ error: 'Body must be { "trip_id": "<uuid>" }' }, 400)
  }

  // RLS returns nothing unless this user has joined the trip.
  const { data: places, error: placesErr } = await supabase
    .from('places')
    .select('id, lat, lng')
    .eq('trip_id', tripId)
    .is('deleted_at', null)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .in('status', ['shortlist', 'planned', 'booked', 'visited'])
    .order('updated_at', { ascending: false })
    .limit(MAX_PLACES)
  if (placesErr) return json({ error: placesErr.message }, 400)
  if (!places || places.length < 2) return json({ legs: 0, providers: [], warnings: ['Fewer than two places with pins'] })

  const pts = places.map((p) => ({ id: p.id as string, lat: p.lat as number, lng: p.lng as number }))
  const byId = new Map(pts.map((p) => [p.id, p]))
  const result = await computeLegs(pts, { orsKey: Deno.env.get('ORS_API_KEY') || undefined })

  const now = new Date().toISOString()
  const rows = result.legs.map((l) => {
    const a = byId.get(l.from)!
    const b = byId.get(l.to)!
    return {
      id: uuidv5(`leg|${l.from}|${l.to}|${l.mode}`, tripId),
      trip_id: tripId,
      from_place_id: l.from,
      to_place_id: l.to,
      mode: l.mode,
      distance_m: l.distance_m,
      duration_s: l.duration_s,
      source: l.source,
      from_lat: a.lat,
      from_lng: a.lng,
      to_lat: b.lat,
      to_lng: b.lng,
      computed_at: now,
    }
  })
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('route_legs').upsert(rows.slice(i, i + 500), { onConflict: 'id' })
    if (error) return json({ error: error.message, legs: i }, 400)
  }
  return json({ legs: rows.length, places: pts.length, providers: result.providers, warnings: result.warnings })
})
