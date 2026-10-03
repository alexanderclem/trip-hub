// Daily (pg_cron, 03:00 UTC): deletes Storage files of tickets removed more than 7 days ago.
// Deleting storage.objects rows in SQL would leave the files behind, so this uses the Storage
// API. Auth: the x-cron-token header must match the Vault secret; runs with the service role.
import { createClient } from 'npm:@supabase/supabase-js@2'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data: ok } = await admin.rpc('push_check_token', { p_token: req.headers.get('x-cron-token') ?? '' })
  if (!ok) return json({ error: 'Forbidden' }, 403)

  let removed = 0
  for (let round = 0; round < 10; round++) {
    const { data: paths, error } = await admin.rpc('tickets_to_remove')
    if (error) return json({ error: error.message, removed }, 500)
    const list = (paths ?? []) as string[]
    if (!list.length) break
    // remove() succeeds for files that are already gone, so a retry after a crash is harmless.
    const { error: rmErr } = await admin.storage.from('attachments').remove(list)
    if (rmErr) return json({ error: rmErr.message, removed }, 500)
    const { error: markErr } = await admin.rpc('mark_files_removed', { p_paths: list })
    if (markErr) return json({ error: markErr.message, removed }, 500)
    removed += list.length
  }
  console.log(JSON.stringify({ removed }))
  return json({ removed })
})
