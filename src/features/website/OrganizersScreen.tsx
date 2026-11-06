import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ensureSession, supabase } from '@/lib/supabase'
import { WebsiteFrame } from './WebsiteFrame'
import { OrganizerPreview } from './OrganizerPreview'
import { OrganizerBookingPreview } from './OrganizerBookingPreview'
import { friendlyError } from '@/ui/errors'
import { TagHead } from './tag/parts'

/** For people who run group trips: retreats, student trips, clubs. Speaks to deposits and payouts. */
export function OrganizersScreen() {
  return (
    <WebsiteFrame>
      <TagHead fields={[['Planning tools', 'Free, available now'], ['Collecting payments', 'Early access · US & USD'], ['Money', 'Goes to your own Stripe account'], ['Fee', '1% + Stripe’s fee']]} id="organizers-title" title="Tools for trip organizers" intro="Run a group trip from one place: a public trip page, the traveler list, bookings, and the shared plan your travelers use on the road.">
        <div className="website-actions">
          <a href="#early-access" className="website-button website-button-primary">Request early access</a>
          <Link to="/pricing" className="website-text-link">See pricing</Link>
        </div>
        <p className="calc-note">Status, November 2026: the planning and organizer tools below work today. Collecting payments opens through early access, starting with US organizers charging in USD.</p>
      </TagHead>
      <section className="marketing-section website-container" aria-labelledby="organizer-preview-title"><h2 id="organizer-preview-title">What you see as the organizer</h2><OrganizerPreview /></section>

      <section className="marketing-section website-container" aria-labelledby="traveler-booking-title"><div className="marketing-section-intro"><h2 id="traveler-booking-title">What your travelers see</h2><p className="marketing-body">Your public page introduces the trip. The booking summary explains the price and the payment plan before anyone commits.</p></div><OrganizerBookingPreview /></section>

      <section className="marketing-section website-container" aria-labelledby="why-title">
        <h2 id="why-title">Organizer features</h2>
        <ul className="marketing-points">
          <li><h3>Your own payment account</h3><p>Payments go to your connected Stripe account. Stripe manages payout timing and may apply holds or reserves. Stowaway never holds the trip’s money.</p></li>
          <li><h3>You see exactly what you pay</h3><p>A flat 1% on what you collect, plus Stripe’s own fee. Put in your trip price and headcount and see what you keep before anyone pays.</p></li>
          <li><h3>Your group plans with you</h3><p>Travelers join from a link with no account, vote on activities and get the day-by-day plan, even offline. Hosted trips let you decide who can change it.</p></li>
          <li><h3>Rooms, waitlists and repeat trips</h3><p>Assign rooms on a rooming board, keep a waitlist when the trip fills, import past travelers from a CSV, and run a successful trip again from a template.</p></li>
        </ul>
      </section>

      <section className="marketing-section website-container" aria-labelledby="organizer-workflow-title"><div className="marketing-section-intro"><h2 id="organizer-workflow-title">How a trip runs</h2><p className="marketing-body">From the first announcement to the trip after this one. The examples on this page are illustrative, not real bookings.</p></div><ol className="marketing-walkthrough">{[
        ['Publish a trip page', 'Prepare a public page with dates, the itinerary, price, inclusions, and cancellation policy, so travelers understand what they’re joining before they book.'],
        ['Collect deposits and track the balance', 'Set a deposit and dated payments, and follow each traveler’s booking status in one list. This step needs payment onboarding through early access.'],
        ['Know who is coming', 'Use traveler lists, booking questions (dietary needs, emergency contacts), hosted-trip permissions, room assignments and a waitlist.'],
        ['Give travelers the plan they’ll use', 'Keep the day-by-day itinerary, meeting points, tickets, and group votes with the trip. Travelers can save the plan and their tickets for offline use.'],
        ['Run it again', 'Reuse a trip as a template, keep a list of past travelers, and see reports with Pro, free during the beta for eligible organizers.'],
      ].map(([title, text], index) => <li key={title}><span className="marketing-step-index" aria-hidden="true">{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></section>
      <section className="marketing-section website-container marketing-split"><div><h2>For small groups with a lot of moving parts.</h2><p className="marketing-body">Retreats, club departures, and student trips are the kinds of trips we’re building this for. Start with your next real trip and tell us where organizing gets difficult: <a className="website-text-link" href="mailto:alexanderclem12@gmail.com">email Alexander</a>, who builds Stowaway.</p></div><div><h3 className="marketing-subtitle">How to get started</h3><ol className="marketing-plain-list"><li>Create a free trip and sign in with an account.</li><li>Open Trip settings → People → Organize this trip.</li><li>Request access before planning to collect payments.</li><li>Complete organizer review and payment onboarding before publishing a paid trip.</li></ol><Link to="/new" className="website-text-link">Start with a free trip</Link></div></section>
      <section className="marketing-section website-container" aria-labelledby="organizer-questions"><h2 id="organizer-questions">Before your first departure</h2><div className="website-faq">
        <details><summary>Can I collect payments today?</summary><p>Only through early access: it needs organizer review and a connected Stripe account. Request access below, and don’t rely on collection for an upcoming trip until your onboarding is confirmed.</p></details>
        <details><summary>Can I use a trip I already created?</summary><p>Yes. Sign in with the trip creator’s account and use Organize this trip in Trip settings → People. Claiming a trip keeps its plan and members together.</p></details>
        <details><summary>Do travelers need accounts?</summary><p>No. They join by link and choose who they are. Hosted trips let you decide who can edit and whether new travelers need approval. An organizer needs an account.</p></details>
        <details><summary>What about cancellations and payouts?</summary><p>You are responsible for delivering the trip and setting its refund policy. Payments use your Stripe account; Stripe controls payout timing and any reserves. <Link to="/pricing">Read the fee and refund details.</Link></p></details>
      </div></section>
      <section id="early-access" className="marketing-section website-container" aria-labelledby="early-title">
        <h2 id="early-title">Collect payments with us early</h2>
        <p className="website-intro">Payment collection opens through a small early-access program. Leave your email to hear when it’s ready for you.</p>
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
