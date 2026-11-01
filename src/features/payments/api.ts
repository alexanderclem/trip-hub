// The app's side of payments (docs/PAYMENTS.md). Everything here needs a connection: money only moves
// online. What a phone may see offline (its trips' offers, bookings, payments) arrives through sync.

import { ensureSession, supabase } from '@/lib/supabase'
import type { BookingQuestions, RoomOption, TripOffer } from '@/data/types'
import type { DisputeRow, PayoutRow, StripeAccountRow } from './notices'
import type { RefundTier } from '../../../supabase/functions/_shared/refunds'

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
  schedule?: { due_date: string; amount_minor: number }[]
  refund_tiers?: RefundTier[]
  questions?: BookingQuestions
  rooms?: (RoomOption & { left: number })[]
  /** The organizer has Pro, so a full trip takes a waitlist. */
  waitlist?: boolean
  spots_left: number
  trip: { name: string; start_date: string | null; end_date: string | null; timezone: string }
  organizer: { name: string; email: string }
  days: { date: string; items: string[] }[]
}

export const getPublicOffer = (slug: string) => rpc<PublicOffer | null>('get_public_offer', { p_slug: slug })

/** Holds a place and goes to Stripe Checkout. A guest session is made now, not on page load. */
export interface BookingExtra { answers?: Record<string, string>; room_option?: string; consent?: boolean; hold?: string; ref?: string }

export async function startBooking(input: { slug: string; name: string; email: string; policyVersion: number; extra?: BookingExtra }): Promise<void> {
  const { url } = await invoke<{ url: string }>('checkout-create', { slug: input.slug, name: input.name, email: input.email, policy_version: input.policyVersion, extra: input.extra ?? {} })
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
  offer: { slug: string; title: string; allow_bank: boolean; status: string; refund_tiers?: RefundTier[]; questions?: BookingQuestions; room_options?: RoomOption[] }
  answers?: Record<string, string>
  room_option?: string | null
  credit_minor?: number
  /** The traveler's own referral link details, when the organizer gives credits. */
  referral?: { code: string; credit_minor: number } | null
  organizer: { name: string; email: string }
  schedule?: { due_date: string; amount_minor: number }[]
  next_minor?: number
  next_date?: string | null
}

export const getBooking = (token: string) => rpc<BookingView | null>('get_booking', { p_token: token })

/** Pays the next installment (or the balance), or everything left with `all`. */
export async function payBalance(token: string, all = false): Promise<void> {
  const { url } = await invoke<{ url: string }>('checkout-create', { token, all })
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

// ─── Phase 2a: plans, refunds, running a trip again, reports, invites ───────

export const saveOfferPlan = (tripId: string, schedule: { due_date: string; amount_minor: number }[], refundTiers: RefundTier[]) =>
  rpc<TripOffer>('save_offer_plan', { p_trip_id: tripId, p_schedule: schedule, p_refund_tiers: refundTiers })

/** Refunds (and optionally cancels) a booking on the organizer's Stripe account. */
export const refundBooking = (bookingId: string, amountMinor: number, cancel: boolean) =>
  invoke<{ refunded: number; cancelled: boolean }>('refund-create', { booking_id: bookingId, amount_minor: amountMinor, cancel })

export const getOfferPolicy = (offerId: string, version: number) =>
  rpc<{ version: number; text: string; refund_tiers: RefundTier[]; since: string } | null>('get_offer_policy', { p_offer_id: offerId, p_version: version })

/** Runs a trip again (Pro): returns the new trip, already joined by this account as its owner. */
export const cloneTrip = (sourceTripId: string, name: string, startDate: string) =>
  rpc<{ trip_id: string; member_id: string; share_token: string }>('clone_trip', { p_source: sourceTripId, p_name: name, p_start_date: startDate })

export interface ReportRow { trip_id: string; title: string; collected: number; stripe_fees: number; stowaway_fees: number; refunds: number; net: number }
export const organizerReport = (from: string, to: string) => rpc<{ trips: ReportRow[]; payouts: number }>('organizer_report', { p_from: from, p_to: to })

export interface InviteRow { id: string; role: 'traveler' | 'viewer'; label: string | null; expires_at: string | null; max_uses: number | null; uses: number; revoked_at: string | null; created_at: string }
export const createInvite = (tripId: string, role: InviteRow['role'], label: string, expiresInDays: number, maxUses: number | null) =>
  rpc<string>('create_invite', { p_trip_id: tripId, p_role: role, p_label: label, p_expires_in_days: expiresInDays, p_max_uses: maxUses })
export const revokeInvite = (id: string) => rpc<void>('revoke_invite', { p_invite_id: id })
export async function listInvites(tripId: string): Promise<InviteRow[]> {
  if (!navigator.onLine) return []
  const { data, error } = await supabase.from('trip_invites').select('id, role, label, expires_at, max_uses, uses, revoked_at, created_at').eq('trip_id', tripId).order('created_at', { ascending: false })
  if (error) return []
  return data as InviteRow[]
}

// ─── Phase 2b: questions, rooms, waitlist, traveler list ────────────────────

export const saveOfferQuestions = (tripId: string, questions: BookingQuestions) =>
  rpc<TripOffer>('save_offer_questions', { p_trip_id: tripId, p_questions: questions })
export const saveRoomOptions = (tripId: string, options: RoomOption[]) =>
  rpc<TripOffer>('save_room_options', { p_trip_id: tripId, p_options: options })
/** A traveler changes their answers from their booking link. */
export const updateBookingAnswers = (token: string, answers: Record<string, string>) =>
  rpc<Record<string, string>>('update_booking_answers', { p_token: token, p_answers: answers })

/** Joins a full trip's waitlist; returns the place in the queue (1 = next). */
export const joinWaitlist = (slug: string, name: string, email: string) => rpc<number>('join_waitlist', { p_slug: slug, p_name: name, p_email: email })
export const getHold = (slug: string, hold: string) => rpc<{ name: string; email: string; hold_until: string } | null>('get_hold', { p_slug: slug, p_hold: hold })
export const offerWaitlistPlace = (entryId: string) => rpc<void>('offer_waitlist_place', { p_entry: entryId })
export const removeWaitlistEntry = (entryId: string) => rpc<void>('remove_waitlist_entry', { p_entry: entryId })

export interface WaitlistRow { id: string; name: string; email: string; status: 'waiting' | 'offered' | 'booked' | 'expired' | 'left'; hold_until: string | null; created_at: string }
export async function listWaitlist(tripId: string): Promise<WaitlistRow[]> {
  if (!navigator.onLine) throw new Error('Connect to the internet to see the waitlist.')
  const { data, error } = await supabase.from('waitlist_entries').select('id, name, email, status, hold_until, created_at')
    .eq('trip_id', tripId).in('status', ['waiting', 'offered', 'booked']).order('created_at')
  if (error) throw new Error(error.message)
  return data as WaitlistRow[]
}

export interface ContactRow {
  id: string; email: string; name: string; trips: number; total_paid_minor: number; last_trip_on: string | null
  tags: string[]; notes: string; marketing_consent: boolean; unsubscribed_at: string | null
  referral_code?: string
  /** Referral credit earned and not yet used. */
  credit_minor?: number
}
export async function listContacts(): Promise<ContactRow[]> {
  if (!navigator.onLine) throw new Error('Connect to the internet to see your travelers.')
  const { data, error } = await supabase.from('organizer_contacts')
    .select('id, email, name, trips, total_paid_minor, last_trip_on, tags, notes, marketing_consent, unsubscribed_at, referral_code').order('name')
  if (error) throw new Error(error.message)
  // Older servers have no referral credits table; then nobody has credit.
  const credits = await supabase.from('referral_credits').select('contact_id, amount_minor').is('used_booking_id', null)
  const credit = new Map<string, number>()
  for (const c of (credits.data ?? []) as { contact_id: string; amount_minor: number }[]) credit.set(c.contact_id, (credit.get(c.contact_id) ?? 0) + Number(c.amount_minor))
  return (data as ContactRow[]).map((c) => ({ ...c, total_paid_minor: Number(c.total_paid_minor), credit_minor: credit.get(c.id) ?? 0 }))
}
export const saveContact = (id: string, tags: string[], notes: string) => rpc<ContactRow>('save_contact', { p_id: id, p_tags: tags, p_notes: notes })

// ─── Phase 2c: campaigns ────────────────────────────────────────────────────

export interface CampaignRow { id: string; subject: string; body: string; audience: { trip_ids?: string[]; tags?: string[] }; status: 'draft' | 'queued'; recipients: number; queued_at: string | null; updated_at: string }
export async function listCampaigns(): Promise<CampaignRow[]> {
  if (!navigator.onLine) throw new Error('Connect to the internet to see your campaigns.')
  const { data, error } = await supabase.from('campaigns').select('id, subject, body, audience, status, recipients, queued_at, updated_at').order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as CampaignRow[]
}
export const saveCampaign = (id: string | null, subject: string, body: string, audience: CampaignRow['audience']) =>
  rpc<CampaignRow>('save_campaign', { p_id: id, p_subject: subject, p_body: body, p_audience: audience })
export const campaignAudience = (audience: CampaignRow['audience']) =>
  rpc<{ count: number; first: { name: string; email: string }[] }>('campaign_audience', { p_audience: audience })
export const sendCampaignTest = (id: string) => rpc<void>('send_campaign_test', { p_id: id })
export const queueCampaign = (id: string) => rpc<number>('queue_campaign', { p_id: id })
export const saveOrganizerAddress = (address: string) => rpc<void>('save_organizer_address', { p_address: address })
export const unsubscribe = (token: string) => rpc<{ organizer: string }>('unsubscribe', { p_token: token })

/** The organizer's trips (for choosing a campaign's audience): id and title of each offer. */
export async function listMyOffers(organizerId: string): Promise<{ trip_id: string; title: string }[]> {
  if (!navigator.onLine) return []
  const { data } = await supabase.from('trip_offers').select('trip_id, title').eq('organizer_id', organizerId).is('deleted_at', null).order('title')
  return (data as { trip_id: string; title: string }[] | null) ?? []
}

export const saveReferralSettings = (creditMinor: number) => rpc<void>('save_referral_settings', { p_credit_minor: creditMinor })
