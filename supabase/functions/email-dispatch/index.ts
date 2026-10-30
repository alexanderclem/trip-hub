// Called by pg_cron (x-cron-token) when emails are waiting. Sends through the Gmail API from the
// dedicated Stowaway account, at most DAILY_SEND_LIMIT a day; the rest wait for tomorrow.
import { admin, env, fromCron, json, rpcOf } from '../_deno/server.ts'
import { DAILY_SEND_LIMIT, gmailAccessToken, gmailSend, rawMessage, renderEmail } from '../_shared/email.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const db = admin()
  if (!(await fromCron(req, db))) return json({ error: 'Forbidden' }, 403)
  const rpc = rpcOf(db)
  const sentToday = await rpc('pay_email_sent_today', {}) as number
  const room = DAILY_SEND_LIMIT - sentToday
  if (room <= 0) {
    console.warn('[email-dispatch] daily limit reached; the rest wait for tomorrow')
    return json({ sent: 0, limited: true })
  }
  const rows = await rpc('pay_email_claim', { p_limit: Math.min(room, 20) }) as { id: number; to_email: string; reply_to: string | null; template: string; data: Record<string, unknown> }[]
  if (!rows?.length) return json({ sent: 0 })
  const token = await gmailAccessToken({ clientId: env('GMAIL_CLIENT_ID'), clientSecret: env('GMAIL_CLIENT_SECRET'), refreshToken: env('GMAIL_REFRESH_TOKEN') })
  let sent = 0
  for (const row of rows) {
    try {
      const m = renderEmail(row.template, row.data)
      await gmailSend(token, rawMessage({ fromName: m.fromName, fromAddress: env('GMAIL_SENDER'), to: row.to_email, replyTo: row.reply_to, subject: m.subject, text: m.text }))
      await rpc('pay_email_done', { p_id: row.id, p_error: null })
      sent++
    } catch (e) {
      await rpc('pay_email_done', { p_id: row.id, p_error: e instanceof Error ? e.message.slice(0, 500) : 'failed' })
    }
  }
  return json({ sent })
})
