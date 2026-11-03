// /organize: an organizer's trips with what each has collected, their Stripe status and payouts.
// Needs a connection and an account; the trips themselves still open offline.

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useDevice } from '@/data/device'
import { useAccount } from '@/features/account/account'
import { rememberSignInReturn } from '@/features/account/returnTo'
import { Button, Card, ErrorNote, Input, PageHeader, SectionTitle, Textarea } from '@/ui'
import { LoadingState } from '@/ui/LoadingState'
import { loadOrganizerMoney, loadOrganizerTrips, type OrganizerMoney, type OrganizerTrip } from './api'
import { accountNotices } from './notices'
import { ReportsCard } from './ReportsCard'
import { ProBadge, useMyOrganizer } from './pro'
import { saveOrganizerAddress, saveReferralSettings } from './api'

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

export function OrganizeScreen() {
  const account = useAccount()
  if (account.kind === 'loading') return <LoadingState fullScreen title="Loading…" />
  if (account.kind !== 'signed-in') {
    return <div className="pb-10"><PageHeader title="Organize" back="/app" /><div className="mx-auto max-w-md p-4"><Card><p className="text-sm">Sign in with the account you organize trips with. <Link className="ui-link inline-flex min-h-11 items-center" to="/signin" onClick={() => rememberSignInReturn('/organize')}>Sign in</Link></p></Card></div></div>
  }
  return <OrganizerDashboard key={account.email} />
}

type DashboardState =
  | { kind: 'loading' }
  | { kind: 'ready'; money: OrganizerMoney; trips: OrganizerTrip[] }
  | { kind: 'error'; message: string }

function OrganizerDashboard() {
  const navigate = useNavigate()
  const [state, setState] = useState<DashboardState>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    void (async () => {
      try {
        const money = await loadOrganizerMoney()
        const trips = money.organizer ? await loadOrganizerTrips(money.organizer.id) : []
        if (!cancelled) setState({ kind: 'ready', money, trips })
      } catch (e) {
        if (!cancelled) setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
      }
    })()
    return () => { cancelled = true }
  }, [attempt])

  const money = state.kind === 'ready' ? state.money : null
  const trips = state.kind === 'ready' ? state.trips : null
  const notices = money ? accountNotices(money.account, money.payouts, money.disputes) : []
  const open = (tripId: string) => { useDevice.getState().rememberTrip(tripId); navigate(`/t/${tripId}/more/payments`) }
  return (
    <div className="pb-10">
      <PageHeader title={money?.organizer?.display_name ?? 'Organize'} back="/app" />
      <div className="mx-auto max-w-lg space-y-4 p-4">
        {state.kind === 'loading' && <LoadingState title="Loading your operator dashboard…" />}
        {state.kind === 'error' && <Card><ErrorNote error={state.message} /><Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>Try again</Button></Card>}
        {money && !money.organizer && <Card><p className="text-sm">You aren’t organizing a trip yet. Open a trip you created, then Trip settings → People → Organize this trip.</p></Card>}
        {money?.organizer && (
          <Card>
            <SectionTitle>Stripe</SectionTitle>
            {notices.map((n) => <div key={n.title} className="mt-2"><p className="font-semibold">{n.title}</p><p className="text-sm text-muted">{n.body}</p></div>)}
            {money.account?.charges_enabled && !notices.length && <p className="mt-2 text-sm">Ready to take payments.</p>}
          </Card>
        )}
        {money?.organizer && trips?.length === 0 && <Card><SectionTitle>Your trips</SectionTitle><p className="mt-2 text-sm text-muted">No trip prices set yet. Open a trip you organize and choose Payments to set its price.</p><Link to="/app" className="ui-link inline-flex min-h-11 items-center">Open your trips</Link></Card>}
        {trips && trips.length > 0 && (
          <Card>
            <SectionTitle>Your trips</SectionTitle>
            <ul className="mt-2 divide-y divide-line">
              {trips.map((t) => (
                <li key={t.trip_id}>
                  <button type="button" className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 py-2 text-left" onClick={() => open(t.trip_id)}>
                    <span className="min-w-0 break-words font-semibold text-action">{t.title} <span className="font-normal text-muted">({t.status})</span></span>
                    <span className="text-sm tabular-nums">{t.booked}/{t.capacity} · {usd(t.collected)} in · {usd(t.due)} due</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {money?.organizer && (
          <Card>
            <Link to="/organize/travelers" className="flex min-h-11 items-center justify-between gap-2 font-semibold text-action"><span>Past travelers<ProBadge /></span><span aria-hidden="true">›</span></Link>
            <p className="text-sm text-muted">Everyone who has booked with you, with tags, notes and who’s happy to hear about new trips.</p>
            <Link to="/organize/import" className="ui-link inline-flex min-h-11 items-center text-sm">Import past travelers from a spreadsheet</Link>
            <Link to="/organize/campaigns" className="mt-2 flex min-h-11 items-center justify-between gap-2 border-t border-line pt-2 font-semibold text-action"><span>Campaigns<ProBadge /></span><span aria-hidden="true">›</span></Link>
            <p className="text-sm text-muted">Email past travelers who asked to hear about your next trips.</p>
          </Card>
        )}
        {money?.organizer && <AddressCard />}
        {money?.organizer && <ReferralCard />}
        {money?.organizer && <ReportsCard />}
        {money && money.payouts.length > 0 && (
          <Card>
            <SectionTitle>Payouts</SectionTitle>
            <ul className="mt-2 divide-y divide-line text-sm">
              {money.payouts.map((p) => <li key={p.stripe_payout_id} className="flex justify-between py-2"><span>{p.arrival_date} · {p.status}</span><span className="tabular-nums">{usd(p.amount_minor)}</span></li>)}
            </ul>
          </Card>
        )}
      </div>
    </div>
  )
}

/** The postal address that ends every marketing email (CAN-SPAM). Asked for once, before a campaign. */
function AddressCard() {
  const me = useMyOrganizer()
  const [address, setAddress] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const value = address ?? me?.postal_address ?? ''
  async function save() {
    setBusy(true); setError(null); setMsg(null)
    try { await saveOrganizerAddress(value); setMsg('Saved.') } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  return (
    <Card>
      <SectionTitle>Postal address</SectionTitle>
      <p className="mt-1 text-sm text-muted">Shown at the end of campaign emails, as US law requires. A PO box is fine. Not shown anywhere else.</p>
      <label htmlFor="postal" className="sr-only">Postal address</label>
      <Textarea id="postal" rows={3} maxLength={300} className="mt-2" value={value} onChange={(e) => setAddress(e.target.value)} placeholder="12 Main St, Austin, TX 78701" />
      <ErrorNote error={error} />
      {msg && <p role="status" className="text-sm text-success-ink">{msg}</p>}
      <button type="button" className="ui-link mt-1 inline-flex min-h-11 items-center" disabled={busy || value.trim().length < 10} onClick={() => void save()}>{busy ? 'Saving…' : 'Save address'}</button>
    </Card>
  )
}

/** Referral credits (Pro): what a past traveler earns, as money off their next trip, for each friend who books. */
function ReferralCard() {
  const me = useMyOrganizer()
  const [amount, setAmount] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (me && !me.pro) return null
  const value = amount ?? String((me?.referral_credit_minor ?? 0) / 100)
  async function save() {
    setBusy(true); setError(null); setMsg(null)
    const cents = Math.round((Number.parseFloat(value) || 0) * 100)
    try { await saveReferralSettings(cents); setMsg(cents ? `Travelers now earn ${usd(cents)} for each friend who books.` : 'Referral credits are off.') } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  return (
    <Card>
      <SectionTitle>Referral credit<ProBadge beta={me?.beta ?? true} /></SectionTitle>
      <p className="mt-1 text-sm text-muted">Each past traveler gets their own link. When a friend books with it, the traveler gets this much off their next trip with you. It’s a discount, never cash. 0 turns it off.</p>
      <label htmlFor="ref-credit" className="mt-2 block text-sm font-[550]">Credit per friend ($)</label>
      <div className="mt-1 flex items-center gap-2">
        <Input id="ref-credit" inputMode="decimal" className="w-28" value={value} onChange={(e) => setAmount(e.target.value)} />
        <button type="button" className="ui-link inline-flex min-h-11 items-center" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      <ErrorNote error={error} />
      {msg && <p role="status" className="text-sm text-success-ink">{msg}</p>}
    </Card>
  )
}
