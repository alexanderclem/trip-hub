// The one place collecting payments is offered (docs/PLAN_THE_SWITCH.md, section 5): a quiet row on
// the Money screen, for the trip's creator, at a money moment. It is an honest "coming soon" with an
// early-access list, so the funnel can be measured before payments are built.

import { useEffect, useState, type FormEvent } from 'react'
import { HandCoins } from 'lucide-react'
import { DateTime } from 'luxon'
import { Link } from 'react-router'
import { useDevice, useTripAccess } from '@/data/device'
import { isStaff } from '@/data/access'
import { ensureSession, supabase } from '@/lib/supabase'
import { useAccount } from '@/features/account/account'
import { track } from '@/features/funnel/events'
import { Dialog } from '@/ui/Dialog'
import { Button, ErrorNote, Field, Input } from '@/ui'
import type { MomentReason } from './moment'

export function CollectPaymentsRow({ tripId, reason }: { tripId: string; reason: MomentReason }) {
  const done = useDevice((s) => s.paymentsOfferDone[tripId] === true)
  const seen = useDevice((s) => s.paymentsOfferSeen[tripId])
  const setSeen = useDevice((s) => s.setPaymentsOfferSeen)
  const [open, setOpen] = useState(false)
  const organizer = isStaff(useTripAccess(tripId))

  // Counted as shown at most once a day per trip.
  useEffect(() => {
    if (done) return
    const today = DateTime.now().toISODate()!
    if (seen === today) return
    setSeen(tripId, today)
    void track('money_moment_shown', tripId, { reason })
  }, [done, seen, setSeen, tripId, reason])

  if (done) return null
  if (organizer) {
    return (
      <Link to={`/t/${tripId}/more/payments`} onClick={() => void track('money_moment_clicked', tripId, { reason })}
        className="flex min-h-11 w-full items-center gap-3 rounded-surface border border-line bg-surface px-4 py-3 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action">
        <HandCoins aria-hidden="true" className="size-5 shrink-0 text-action" />
        <span className="min-w-0 flex-1"><span className="block font-semibold text-ink">Collect payments for this trip</span><span className="block text-sm text-muted">Deposits from everyone, straight to your Stripe account.</span></span>
      </Link>
    )
  }
  return <>
    <button
      type="button"
      className="flex min-h-11 w-full items-center gap-3 rounded-surface border border-line bg-surface px-4 py-3 text-left hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
      onClick={() => { setOpen(true); void track('money_moment_clicked', tripId, { reason }) }}
    >
      <HandCoins aria-hidden="true" className="size-5 shrink-0 text-action" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">Collect payments for this trip</span>
        <span className="block text-sm text-muted">Deposits from everyone, straight to you. Coming soon.</span>
      </span>
    </button>
    <PaymentsSheet tripId={tripId} reason={reason} open={open} onClose={() => setOpen(false)} />
  </>
}

function PaymentsSheet({ tripId, reason, open, onClose }: { tripId: string; reason: MomentReason; open: boolean; onClose: () => void }) {
  const account = useAccount()
  const organized = useTripAccess(tripId).organized
  const setDone = useDevice((s) => s.setPaymentsOfferDone)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const filled = account.kind === 'signed-in' ? account.email ?? '' : ''
  useEffect(() => { if (open && !email && filled) setEmail(filled) }, [open, filled, email])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (!navigator.onLine) throw new Error('Connect to the internet to join the early-access list.')
      await ensureSession()
      const { error: err } = await supabase.rpc('request_payments_early_access', { p_email: email.trim(), p_trip_id: tripId })
      if (err) throw new Error(err.message)
      void track('early_access_requested', tripId, { reason })
      setDone(tripId)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={sent ? 'You’re on the list' : 'Collect payments for this trip'}>
      {sent ? <>
        <p className="text-sm leading-relaxed text-ink">We’ll email you when collecting payments is ready to try. Nothing about your trip changes in the meantime.</p>
        <Button className="mt-4 w-full" onClick={onClose}>Done</Button>
      </> : <form onSubmit={submit} className="space-y-4">
        <p className="text-sm leading-relaxed text-ink">We’re building a way for organizers to collect deposits and payments from everyone on a trip. It isn’t ready yet.</p>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted">
          <li>Money goes straight to your own Stripe account. Stowaway never holds it.</li>
          <li>A flat 1% fee, plus Stripe’s card fee, shown before anyone pays.</li>
          <li>Planning, voting and splitting costs stay free.</li>
        </ul>
        <Field label="Email for early access" hint="Used only to tell you when payments are ready.">
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <ErrorNote error={error} />
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="secondary" onClick={() => { void track('money_moment_dismissed', tripId, { reason }); setDone(tripId); onClose() }}>Not now</Button>
          <Button type="submit" disabled={busy} aria-busy={busy}>{busy ? 'Sending…' : 'Get early access'}</Button>
        </div>
        {!organized && <p className="text-sm text-muted">Getting ready? <Link className="ui-link" to={`/t/${tripId}/more/settings`} onClick={onClose}>Become this trip’s organizer now</Link></p>}
      </form>}
    </Dialog>
  )
}
