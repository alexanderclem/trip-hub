// What each queued event says on the lock screen. Pure, so it is unit-tested with Vitest; the
// Edge Function (index.ts) only fetches, sends and records failures.

export type EventKind = 'vote' | 'vote_nudge' | 'expense' | 'task' | 'task_due' | 'leave'

export interface Subscription {
  endpoint: string
  p256dh: string
  auth: string
}

export interface QueuedEvent {
  id: number
  trip_id: string
  trip_name: string
  kind: EventKind
  data: Record<string, unknown>
  subscriptions: Subscription[]
}

export interface Notice {
  title: string
  body: string
  /** In-app path opened when the notification is tapped. */
  url: string
  /** Same tag replaces an older notification instead of stacking. */
  tag: string
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'UGX', 'XAF', 'XOF', 'PYG'])

export function formatMoney(minor: number, currency: string): string {
  const digits = ZERO_DECIMAL.has(currency) ? 0 : 2
  const amount = minor / 10 ** digits
  try {
    // "Q 85.00" → "Q85.00", matching how the app shows money.
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: digits, maximumFractionDigits: digits })
      .format(amount).replace(/^([^\d\s-]+)\s+/u, '$1')
  } catch {
    return `${amount.toFixed(digits)} ${currency}`
  }
}

export function compose(e: QueuedEvent): Notice {
  const d = e.data
  const base = `/t/${e.trip_id}`
  const trip = e.trip_name
  switch (e.kind) {
    case 'vote':
      return { title: `New vote in ${trip}`, body: `${str(d.by) || 'Someone'} asks: ${str(d.title)}. Tap to vote.`, url: `${base}/more/vote/${str(d.poll_id)}`, tag: `vote:${str(d.poll_id)}` }
    case 'vote_nudge':
      return { title: 'Your vote is missing', body: `${str(d.title)} is still open in ${trip}.`, url: `${base}/more/vote/${str(d.poll_id)}`, tag: `vote:${str(d.poll_id)}` }
    case 'expense': {
      const share = Number(d.share_minor)
      const currency = str(d.currency)
      return {
        title: `${str(d.by) || 'Someone'} logged ${str(d.description)}`,
        body: Number.isFinite(share) && share > 0 ? `Your share: ${formatMoney(share, currency)} of ${formatMoney(Number(d.amount_minor), currency)}` : `${formatMoney(Number(d.amount_minor), currency)} in ${trip}`,
        url: `${base}/money/${str(d.expense_id)}`,
        tag: `expense:${str(d.expense_id)}`,
      }
    }
    case 'task':
      return { title: `${str(d.by) || 'Someone'} gave you a task`, body: str(d.title) + (str(d.due_date) ? ` · due ${str(d.due_date)}` : ''), url: `${base}/more/tasks/${str(d.task_id)}`, tag: `task:${str(d.task_id)}` }
    case 'task_due':
      return { title: 'Due today', body: str(d.title), url: `${base}/more/tasks/${str(d.task_id)}`, tag: `task:${str(d.task_id)}` }
    case 'leave': {
      const leave = str(d.leave)
      return {
        title: leave ? `Leave by ${leave} for ${str(d.title)}` : `${str(d.title)} starts at ${str(d.start)}`,
        body: leave ? [str(d.note), `Starts ${str(d.start)}`].filter(Boolean).join(' · ') : 'Time to get going.',
        url: `${base}/plan/${str(d.item_id)}`,
        tag: `leave:${str(d.item_id)}`,
      }
    }
  }
}

/** One send per (event, subscription), with the payload the service worker reads. */
export function plan(events: QueuedEvent[]): { sub: Subscription; payload: string; eventId: number }[] {
  return events.flatMap((e) => {
    const notice = compose(e)
    return e.subscriptions.map((sub) => ({ sub, payload: JSON.stringify(notice), eventId: e.id }))
  })
}
