// The app's side of payments (docs/PAYMENTS.md). Everything here needs a connection: money only moves
// online. What a phone may see offline (its trips' offers, bookings, payments) arrives through sync.

import { ensureSession, supabase } from '@/lib/supabase'
import type { TripOffer } from '@/data/types'
import type { DisputeRow, PayoutRow, StripeAccountRow } from './notices'

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  if (!navigator.onLine) throw new Error('Connect to the internet to continue.')
  await ensureSession()
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) {
    // Edge Functions answer errors as { error } with a message written for people.
    const context = (error as { context?: Response }).context
    const message = context ? ((await context.json().catch(() => null)) as { error?: string } | null)?.error : null
    throw new Error(message ?? 'Something went wrong. Try again.')
  }
  return data as T
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!navigator.onLine) throw new Error('Connect to the internet to continue.')
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

// ─── Organizer ──────────────────────────────────────────────────────────────

/** Opens Stripe's onboarding for the organizer's own account; Stripe sends them back to `returnPath`. */
export async function connectStripe(returnPath: string): Promise<void> {
  const { url } = await invoke<{ url: string }>('stripe-connect', { action: 'start', return_path: returnPath })
  location.assign(url)
}

export const refreshStripe = () => invoke<{ status: string }>('stripe-connect', { action: 'refresh' })

export interface OfferInput {
  title: string
  summary: string
  priceMinor: number
  depositMinor: number
  balanceDueDate: string | null
  capacity: number
  cancellationPolicy: string
  feeMode: 'absorb' | 'pass'
  allowBank: boolean
}

export const saveOffer = (tripId: string, o: OfferInput) => rpc<TripOffer>('save_offer', {
  p_trip_id: tripId, p_title: o.title, p_summary: o.summary, p_price_minor: o.priceMinor, p_deposit_minor: o.depositMinor,
  p_balance_due_date: o.balanceDueDate, p_capacity: o.capacity, p_cancellation_policy: o.cancellationPolicy, p_fee_mode: o.feeMode, p_allow_bank: o.allowBank,
})

export const setOfferStatus = (tripId: string, status: TripOffer['status']) => rpc<TripOffer>('set_offer_status', { p_trip_id: tripId, p_status: status })

export interface OrganizerMoney {
  organizer: { id: string; display_name: string; support_email: string; slug: string; reviewed_at: string | null } | null
  account: StripeAccountRow | null
  payouts: PayoutRow[]
  disputes: DisputeRow[]
}

/** The signed-in organizer's profile, Stripe account, payouts and open disputes (RLS: their own). */
export async function loadOrganizerMoney(): Promise<OrganizerMoney> {
  if (!navigator.onLine) throw new Error('Connect to the internet to see payouts.')
  const [o, a, p, d] = await Promise.all([
    supabase.from('organizers').select('id, display_name, support_email, slug, reviewed_at').maybeSingle(),
    supabase.from('stripe_accounts').select('*').maybeSingle(),
    supabase.from('payouts').select('stripe_payout_id, amount_minor, arrival_date, status, failure_code, failure_message').order('arrival_date', { ascending: false }).limit(20),
    supabase.from('disputes').select('stripe_dispute_id, amount_minor, status, evidence_due_by').order('created_at', { ascending: false }).limit(20),
  ])
  const missing = (e: { code?: string } | null) => !!e && (e.code === 'PGRST205' || e.code === '42P01')
  for (const r of [o, a, p, d]) if (r.error && !missing(r.error)) throw new Error(r.error.message)
  return {
    organizer: (o.data as OrganizerMoney['organizer']) ?? null,
    account: (a.data as StripeAccountRow | null) ?? null,
    payouts: (p.data as PayoutRow[] | null) ?? [],
    disputes: (d.data as DisputeRow[] | null) ?? [],
  }
}

// ─── Travelers (no account needed) ──────────────────────────────────────────

export interface PublicOffer {
  slug: string
  title: string
  summary: string
  price_minor: number
  deposit_minor: number
  balance_due_date: string | null
  fee_mode: 'absorb' | 'pass'
  allow_bank: boolean
  cancellation_policy: string
  policy_version: number
  spots_left: number
  trip: { name: string; start_date: string | null; end_date: string | null; timezone: string }
  organizer: { name: string; email: string }
  days: { date: string; items: string[] }[]
}

export const getPublicOffer = (slug: string) => rpc<PublicOffer | null>('get_public_offer', { p_slug: slug })

/** Holds a place and goes to Stripe Checkout. A guest session is made now, not on page load. */
export async function startBooking(input: { slug: string; name: string; email: string; policyVersion: number }): Promise<void> {
  const { url } = await invoke<{ url: string }>('checkout-create', { slug: input.slug, name: input.name, email: input.email, policy_version: input.policyVersion })
  location.assign(url)
}

export interface BookingView {
  id: string
  status: 'pending' | 'active' | 'paid' | 'cancelled' | 'refunded' | 'expired'
  trip_id: string
  traveler_name: string
  price_minor: number
  deposit_minor: number
  paid_minor: number
  refunded_minor: number
  balance_due_date: string | null
  fee_mode: 'absorb' | 'pass'
  processing: boolean
  offer: { slug: string; title: string; allow_bank: boolean; status: string }
  organizer: { name: string; email: string }
}

export const getBooking = (token: string) => rpc<BookingView | null>('get_booking', { p_token: token })

export async function payBalance(token: string): Promise<void> {
  const { url } = await invoke<{ url: string }>('checkout-create', { token })
  location.assign(url)
}

const LINKS_KEY = 'stowaway-booking-links'

/** This phone keeps its bookings' private links, so the trip can offer "Pay balance". */
export function rememberBookingLink(bookingId: string, token: string) {
  try {
    const all = JSON.parse(localStorage.getItem(LINKS_KEY) ?? '{}') as Record<string, string>
    all[bookingId] = token
    localStorage.setItem(LINKS_KEY, JSON.stringify(all))
  } catch { /* private mode: the emailed link still works */ }
}

export function bookingLink(bookingId: string): string | null {
  try { return (JSON.parse(localStorage.getItem(LINKS_KEY) ?? '{}') as Record<string, string>)[bookingId] ?? null } catch { return null }
}

/** The token from a booking page's URL fragment (#t=…), which never reaches a server. */
export const tokenFromHash = (hash: string) => new URLSearchParams(hash.replace(/^#/, '')).get('t')
