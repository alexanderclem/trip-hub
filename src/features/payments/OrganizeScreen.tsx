// /organize: an organizer's trips with what each has collected, their Stripe status and payouts.
// Needs a connection and an account; the trips themselves still open offline.

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useDevice } from '@/data/device'
import { useAccount } from '@/features/account/account'
import { Card, ErrorNote, PageHeader, SectionTitle } from '@/ui'
import { LoadingState } from '@/ui/LoadingState'
import { loadOrganizerMoney, type OrganizerMoney } from './api'
import { accountNotices } from './notices'

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

interface TripRow { trip_id: string; title: string; status: string; capacity: number; booked: number; collected: number; due: number }

export function OrganizeScreen() {
  const account = useAccount()
  const navigate = useNavigate()
  const [money, setMoney] = useState<OrganizerMoney | null>(null)
  const [trips, setTrips] = useState<TripRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (account.kind !== 'signed-in') return
    void (async () => {
      try {
        const m = await loadOrganizerMoney()
        setMoney(m)
        if (!m.organizer) { setTrips([]); return }
        const [offers, bookings] = await Promise.all([
          supabase.from('trip_offers').select('trip_id, title, status, capacity').eq('organizer_id', m.organizer.id).is('deleted_at', null),
          supabase.from('bookings').select('trip_id, status, paid_minor, refunded_minor, price_minor').eq('organizer_id', m.organizer.id),
        ])
        if (offers.error) throw new Error(offers.error.message)
        type B = { trip_id: string; status: string; paid_minor: number; refunded_minor: number; price_minor: number }
        const live = ((bookings.data ?? []) as B[]).filter((b) => b.status === 'active' || b.status === 'paid')
        setTrips(((offers.data ?? []) as { trip_id: string; title: string; status: string; capacity: number }[]).map((o) => {
          const mine = live.filter((b) => b.trip_id === o.trip_id)
          return { ...o, booked: mine.length, collected: mine.reduce((a, b) => a + b.paid_minor - b.refunded_minor, 0), due: mine.reduce((a, b) => a + Math.max(0, b.price_minor - b.paid_minor), 0) }
        }))
      } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    })()
  }, [account.kind])

  if (account.kind === 'loading') return <LoadingState fullScreen title="Loading…" />
  if (account.kind !== 'signed-in') {
    return <div className="pb-10"><PageHeader title="Organize" back="/app" /><div className="mx-auto max-w-md p-4"><Card><p className="text-sm">Sign in with the account you organize trips with. <Link className="ui-link" to="/signin">Sign in</Link></p></Card></div></div>
  }
  const open = (tripId: string) => { useDevice.getState().rememberTrip(tripId); navigate(`/t/${tripId}/more/payments`) }
  return (
    <div className="pb-10">
      <PageHeader title={money?.organizer?.display_name ?? 'Organize'} back="/app" />
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <ErrorNote error={error} />
        {money && !money.organizer && <Card><p className="text-sm">You aren’t organizing a trip yet. Open a trip you created, then Trip settings → People → Organize this trip.</p></Card>}
        {money?.organizer && (
          <Card>
            <SectionTitle>Stripe</SectionTitle>
            {accountNotices(money.account, money.payouts, money.disputes).map((n) => <div key={n.title} className="mt-2"><p className="font-semibold">{n.title}</p><p className="text-sm text-muted">{n.body}</p></div>)}
            {money.account?.charges_enabled && !accountNotices(money.account, money.payouts, money.disputes).length && <p className="mt-2 text-sm">Ready to take payments.</p>}
          </Card>
        )}
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
