import { createClient } from 'npm:@supabase/supabase-js@2'
import { computeTrafficRoute } from './routing.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const authorization = req.headers.get('Authorization')
  if (!authorization) return json({ error: 'Not signed in' }, 401)
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
  })
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return json({ error: 'Not signed in' }, 401)
  let fromId: string, toId: string
  try {
    const body = await req.json()
    fromId = body.from_place_id
    toId = body.to_place_id
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuid.test(fromId) || !uuid.test(toId) || fromId === toId) throw new Error()
  } catch {
    return json({ error: 'Choose two different places.' }, 400)
  }
  // Use stored pins and the caller's RLS access; never accept arbitrary billable coordinates.
  const { data: places, error: placesError } = await supabase.from('places').select('id, trip_id, lat, lng')
    .in('id', [fromId, toId]).is('deleted_at', null)
  const from = places?.find(p => p.id === fromId)
  const to = places?.find(p => p.id === toId)
  if (placesError || !from || !to || from.trip_id !== to.trip_id) return json({ error: 'Places are unavailable or you do not have access.' }, 403)
  if (from.lat == null || from.lng == null || to.lat == null || to.lng == null) return json({ error: 'Both places need map pins.' }, 400)
  const key = Deno.env.get('GOOGLE_ROUTES_API_KEY')
  if (!key) return json({ error: 'Traffic estimates are not configured yet. Planning estimates are still available.' }, 503)
  try {
    return json(await computeTrafficRoute(from, to, key))
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Could not check traffic.' }, 502)
  }
})
