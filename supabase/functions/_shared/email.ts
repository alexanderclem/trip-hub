// Transactional email (docs/PAYMENTS.md, "Email"): plain-text messages rendered from the outbox's
// template and data, sent through the Gmail API from a dedicated Stowaway account. Edge Functions
// can't use SMTP ports 25/587, so this is HTTPS only. Every link points at joinstowaway.app.

export interface Rendered { subject: string; text: string; fromName: string }

const usd = (cents: unknown) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(cents ?? 0) / 100)
const day = (iso: unknown) => (typeof iso === 'string' && iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '')
const s = (v: unknown) => (typeof v === 'string' ? v : '')

const footer = 'Sent by Stowaway (joinstowaway.app). Reply to this email to reach your organizer.'

/** The message for one outbox row. Unknown templates throw, so the row is retried and noticed. */
export function renderEmail(template: string, d: Record<string, unknown>): Rendered {
  switch (template) {
    case 'payment_received': {
      const owed = Number(d.price_minor ?? 0) - Number(d.paid_minor ?? 0)
      return {
        fromName: `Stowaway for ${s(d.organizer)}`,
        subject: `${s(d.trip_name)}: ${usd(d.amount_minor)} received`,
        text: [
          `Hi ${s(d.traveler_name)},`,
          '',
          `${s(d.organizer)} received your ${d.kind === 'balance' ? 'payment' : d.kind === 'deposit' ? 'deposit' : 'payment'} of ${usd(d.amount_minor)} for ${s(d.trip_name)}.`,
          owed > 0 ? `Still to pay: ${usd(owed)}${d.balance_due_date ? `, by ${day(d.balance_due_date)}` : ''}.` : 'You’ve paid in full.',
          '',
          `Open the trip (plan, votes, tickets): ${s(d.trip_url)}`,
          `Your booking, receipts and balance: ${s(d.manage_url)}`,
          '',
          'Keep the booking link to yourself: anyone with it can see and pay your balance.',
          '',
          footer,
        ].join('\n'),
      }
    }
    case 'balance_reminder': {
      const days = Number(d.days)
      const when = days > 1 ? `due in ${days} days, on ${day(d.balance_due_date)}` : days === 1 ? `due tomorrow, ${day(d.balance_due_date)}` : `was due on ${day(d.balance_due_date)}`
      return {
        fromName: `Stowaway for ${s(d.organizer)}`,
        subject: `${s(d.trip_name)}: balance ${days >= 1 ? 'due soon' : 'overdue'}`,
        text: [`Hi ${s(d.traveler_name)},`, '', `Your balance of ${usd(d.due_minor)} for ${s(d.trip_name)} ${when}.`, '', `Pay it here: ${s(d.manage_url)}`, '', footer].join('\n'),
      }
    }
    case 'organizer_payment':
      return {
        fromName: 'Stowaway',
        subject: `${s(d.traveler_name)} paid ${usd(d.amount_minor)} for ${s(d.trip_name)}`,
        text: [`${s(d.traveler_name)} paid ${usd(d.amount_minor)} (${s(d.kind)}). They’ve now paid ${usd(d.paid_minor)} of ${usd(d.price_minor)}.`, '',
          'The money is in your Stripe balance and pays out on your Stripe schedule. Bookings: https://joinstowaway.app/organize'].join('\n'),
      }
    case 'payout_failed':
      return {
        fromName: 'Stowaway',
        subject: `Your ${usd(d.amount_minor)} payout didn’t reach your bank`,
        text: [`Your ${usd(d.amount_minor)} payout${d.arrival_date ? ` due ${day(d.arrival_date)}` : ''} didn’t reach your bank: ${s(d.reason) || 'Stripe gave no reason'}.`, '',
          'Stripe returned it to your balance. Update your bank details in your Stripe Dashboard (https://dashboard.stripe.com), and Stripe retries on your next payout date.'].join('\n'),
      }
    case 'dispute_opened':
      return {
        fromName: 'Stowaway',
        subject: `A ${usd(d.amount_minor)} payment was disputed`,
        text: [`${s(d.traveler_name)} disputed a ${usd(d.amount_minor)} payment with their card issuer${d.reason ? ` (reason given: ${s(d.reason)})` : ''}.`,
          'Stripe has taken the amount and its dispute fee from your balance until it’s decided.', '',
          `Respond in your Stripe Dashboard${d.due_by ? ` by ${day(d.due_by)}` : ''}; after that you can’t: https://dashboard.stripe.com/disputes`].join('\n'),
      }
    default:
      throw new Error(`Unknown email template ${template}`)
  }
}

// ─── Gmail ──────────────────────────────────────────────────────────────────

const clean = (v: string) => v.replace(/[\r\n]+/g, ' ').trim()
const b64 = (text: string) => {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}
const b64url = (text: string) => b64(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
/** RFC 2047 for headers that aren't plain ASCII. */
const header = (v: string) => (/^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`)

export interface Message { fromName: string; fromAddress: string; to: string; replyTo?: string | null; subject: string; text: string }

/** An RFC 2822 message, base64url-encoded as Gmail's `raw` field. Header values can't inject lines. */
export function rawMessage(m: Message): string {
  const lines = [
    `From: ${header(clean(m.fromName))} <${clean(m.fromAddress)}>`,
    `To: ${clean(m.to)}`,
    ...(m.replyTo ? [`Reply-To: ${clean(m.replyTo)}`] : []),
    `Subject: ${header(clean(m.subject))}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(m.text).replace(/.{76}/g, '$&\r\n'),
  ]
  return b64url(lines.join('\r\n'))
}

export interface GmailConfig { clientId: string; clientSecret: string; refreshToken: string; fetch?: typeof fetch }

export async function gmailAccessToken(c: GmailConfig): Promise<string> {
  const res = await (c.fetch ?? fetch)('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, refresh_token: c.refreshToken, grant_type: 'refresh_token' }),
  })
  const json = await res.json() as { access_token?: string; error?: string; error_description?: string }
  if (!res.ok || !json.access_token) throw new Error(`Gmail sign-in failed: ${json.error_description ?? json.error ?? res.status}`)
  return json.access_token
}

export async function gmailSend(accessToken: string, raw: string, doFetch: typeof fetch = fetch): Promise<void> {
  const res = await doFetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  })
  if (!res.ok) throw new Error(`Gmail refused the message: ${res.status} ${(await res.text()).slice(0, 300)}`)
}

/** Personal Gmail allows about 500 recipients a day; stop well short and let the rest wait. */
export const DAILY_SEND_LIMIT = 400
