import { useState, type FormEvent } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import { ensureSession, supabase } from '@/lib/supabase'
import { WebsiteFrame } from './WebsiteFrame'

/** For people who run group trips: retreats, student trips, clubs. Speaks to deposits and payouts. */
export function OperatorsScreen() {
  return (
    <WebsiteFrame>
      <section className="marketing-hero website-container" aria-labelledby="operators-title">
        <p className="website-eyebrow">For organizers</p>
        <h1 id="operators-title">Run the trip with your group, not around it.</h1>
        <p className="website-intro">Stowaway is where your travelers vote, see the plan and keep their tickets. Soon it’s also where they pay you: deposits and balances, straight to your own Stripe account.</p>
        <div className="website-actions">
          <Link to="/new" className="website-button website-button-primary">Start a trip <ArrowUpRight size={18} aria-hidden="true" /></Link>
          <Link to="/pricing" className="website-text-link">See pricing</Link>
        </div>
      </section>

      <section className="marketing-section website-container" aria-labelledby="why-title">
        <h2 id="why-title">Built for the way you already run trips</h2>
        <ul className="marketing-points">
          <li><h3>Your money isn’t held</h3><p>Payments go to your own Stripe account and pay out on the schedule you choose there. Stowaway never sits on deposits, so you can pay the hotel and the bus before the trip.</p></li>
          <li><h3>You see exactly what you pay</h3><p>A flat 1% on what you collect, plus Stripe’s own fee. Put in your trip price and headcount and see what you keep, before anyone pays.</p></li>
          <li><h3>Your group plans with you</h3><p>Travelers join from a link with no account, vote on activities and get the day-by-day plan, even offline. You decide who can change it.</p></li>
        </ul>
      </section>

      <section className="marketing-section website-container" aria-labelledby="early-title">
        <h2 id="early-title">Collect payments with us early</h2>
        <p className="website-intro">We’re building payment collection with a few organizers first. Leave your email and we’ll be in touch.</p>
        <EarlyAccessForm />
      </section>
    </WebsiteFrame>
  )
}

function EarlyAccessForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setState('busy')
    try {
      // A session only now, on purpose: never on page load (anonymous sign-ins are rate limited).
      await ensureSession()
      const { error: err } = await supabase.rpc('request_payments_early_access', { p_email: email.trim(), p_trip_id: null })
      if (err) throw new Error(err.message)
      setState('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send. Try again.')
      setState('idle')
    }
  }

  if (state === 'done') return <p role="status" className="marketing-status">Thanks. We’ll email you when it’s ready to try.</p>
  return (
    <form className="marketing-form" onSubmit={submit}>
      <label htmlFor="early-email" className="website-eyebrow">Email</label>
      <input id="early-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button type="submit" className="website-button website-button-primary" disabled={state === 'busy'}>{state === 'busy' ? 'Sending…' : 'Get early access'}</button>
      <p className="calc-note">Used only to tell you about payments.</p>
      {error && <p role="alert" className="marketing-status">{error}</p>}
    </form>
  )
}
