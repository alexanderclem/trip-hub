import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ensureSession, supabase } from '@/lib/supabase'
import { WebsiteFrame } from './WebsiteFrame'
import { OperatorPreview } from './OperatorPreview'
import { OperatorBookingPreview } from './OperatorBookingPreview'
import { friendlyError } from '@/ui/errors'
import { TagHead } from './tag/parts'

/** For people who run group trips: retreats, student trips, clubs. Speaks to deposits and payouts. */
export function OperatorsScreen() {
  return (
    <WebsiteFrame>
      <TagHead fields={[['Access', 'Early access'], ['Money', 'Your own Stripe account'], ['Fee', '1% + Stripe’s fee, proposed'], ['Planning', 'Free today']]} id="operators-title" title="Run the trip with your group, not around it." intro="A shared plan for your travelers. A clearer picture of the people, bookings, and balances for you. Explore the operator beta before your next departure.">
        <div className="website-actions">
          <a href="#early-access" className="website-button website-button-primary">Request early access</a>
          <Link to="/pricing" className="website-text-link">See pricing</Link>
        </div>
        <p className="calc-note">Planning is free today. Payment collection is coming soon.</p>
      </TagHead>
      <section className="marketing-section website-container" aria-labelledby="operator-preview-title"><h2 id="operator-preview-title">What you see as the organizer</h2><OperatorPreview /></section>

      <section className="marketing-section website-container" aria-labelledby="traveler-booking-title"><div className="marketing-section-intro"><h2 id="traveler-booking-title">A clear invitation. A clear commitment.</h2><p className="marketing-body">Your public page introduces the trip. The booking summary explains the price and payment plan. Here’s how those two moments connect in the collection preview.</p></div><OperatorBookingPreview /></section>

      <section className="marketing-section website-container" aria-labelledby="why-title">
        <h2 id="why-title">Built for the way you already run trips</h2>
        <ul className="marketing-points">
          <li><h3>Your own payment account</h3><p>The collection model uses your connected Stripe account. Stripe manages payout timing and may apply holds or reserves. Stowaway doesn’t hold the trip’s funds.</p></li>
          <li><h3>You see exactly what you pay</h3><p>A flat 1% on what you collect, plus Stripe’s own fee. Put in your trip price and headcount and see what you keep, before anyone pays.</p></li>
          <li><h3>Your group plans with you</h3><p>Travelers join from a link with no account, vote on activities and get the day-by-day plan, even offline. You decide who can change it.</p></li>
        </ul>
      </section>

      <section className="marketing-section website-container" aria-labelledby="operator-workflow-title"><div className="marketing-section-intro"><h2 id="operator-workflow-title">See how a trip comes together.</h2><p className="marketing-body">The following workflow previews the operator experience. Payments need early-access onboarding; the example contains no real bookings.</p></div><ol className="marketing-walkthrough">{[
        ['Give your trip a clear front door', 'Prepare a public trip page with dates, the itinerary, price, inclusions, and cancellation policy. Travelers can understand what they’re joining before they book.'],
        ['Collect deposits and track the balance', 'Preview deposits, dated payments, and booking status in one workflow. The collection fee is proposed at 1% plus Stripe’s processing fees. Payment collection is not generally available yet.'],
        ['Know who is coming', 'Use traveler lists, booking questions, and hosted-trip permissions. Room assignments and waitlists are part of the operator beta; access depends on onboarding and configuration.'],
        ['Give travelers the plan they’ll use', 'Keep the day-by-day itinerary, meeting points, tickets, and group votes with the trip. Travelers can prepare saved plans and downloaded tickets for offline use.'],
        ['Get ready to run it again', 'Preview trip reuse, past-traveler tools, and reports with Pro, free during beta for eligible operators. Campaign email delivery is not enabled yet.'],
      ].map(([title, text], index) => <li key={title}><span className="marketing-step-index" aria-hidden="true">{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></section>
      <section className="marketing-section website-container marketing-split"><div><h2>For small groups with a lot of moving parts.</h2><p className="marketing-body">Retreats, club departures, and student trips are the kinds of trips we’re exploring with early operators. Start with your next real trip and tell us where the organizing gets difficult.</p></div><div><h3 className="marketing-subtitle">How to get started</h3><ol className="marketing-plain-list"><li>Create a free trip and sign in with an account.</li><li>Open Trip settings → People → Organize this trip.</li><li>Request access before planning to collect payments. The initial collection launch is for US operators charging in USD.</li><li>Complete operator review and payment onboarding before publishing a paid trip.</li></ol><Link to="/new" className="website-text-link">Start with a free trip</Link></div></section>
      <section className="marketing-section website-container" aria-labelledby="operator-questions"><h2 id="operator-questions">Before your first departure</h2><div className="website-faq">
        <details><summary>Can I collect payments today?</summary><p>Collection is coming soon and needs early-access onboarding, operator review, and a connected payment account. Request access below; don’t rely on collection being active for an upcoming trip until onboarding is confirmed.</p></details>
        <details><summary>Can I use a trip I already created?</summary><p>Yes. Sign in with the trip creator’s account and use Organize this trip in Trip settings → People. Claiming a trip keeps its plan and members together.</p></details>
        <details><summary>Do travelers need accounts?</summary><p>They can join by link and choose who they are. Hosted trips let you decide who can edit and whether new travelers need approval. An organizer needs an account.</p></details>
        <details><summary>What about cancellations and payouts?</summary><p>You are responsible for delivering the trip and setting its refund policy. Payments use your Stripe account; Stripe controls payout timing and any reserves. <Link to="/pricing">Read the fee and refund details.</Link></p></details>
      </div></section>
      <section id="early-access" className="marketing-section website-container" aria-labelledby="early-title">
        <h2 id="early-title">Collect payments with us early</h2>
        <p className="website-intro">Payment collection will open through a small early-access program. Leave your email to hear when it’s ready to try.</p>
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
    if (state === 'busy') return
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
      {error && <p role="alert" className="marketing-status">{friendlyError(error)}</p>}
    </form>
  )
}
