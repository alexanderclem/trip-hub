import { Link } from 'react-router'
import { OperatorPreview } from './OperatorPreview'

export function OperatorIntroduction() {
  return <section className="marketing-section website-container marketing-split" aria-labelledby="operator-intro-title">
    <div><p className="website-eyebrow">For people who run group trips</p><h2 id="operator-intro-title">Run the trip.<br />Keep the group in the loop.</h2><p className="marketing-body">A retreat, a club weekend, or your next group departure. Bring the shared plan and the work of organizing it into one place.</p><p className="marketing-body">Preview bookings, traveler lists, and payment tracking alongside the itinerary your travelers actually use.</p><div className="website-actions"><Link to="/operators" className="website-button website-button-primary">Explore operator tools</Link></div><p className="calc-note">Operator tools are in beta. Payment collection is coming soon.</p></div>
    <OperatorPreview />
  </section>
}

export function PricingIntroduction() {
  return <section className="marketing-section website-container marketing-price-intro" aria-labelledby="price-intro-title"><div><p className="website-eyebrow">Simple to start</p><h2 id="price-intro-title">The plan is free.<br />The price is clear.</h2><p className="marketing-body">Creating trips, inviting friends, voting, tickets, shared expenses, and offline planning stay free.</p><Link to="/pricing" className="website-text-link">See pricing and calculate fees</Link></div><div className="marketing-price-callout"><h3>Collecting payments <span className="marketing-availability">Coming soon</span></h3><p className="marketing-price">1% <span>+ Stripe’s fee</span></p><p className="marketing-body">The proposed collection fee applies when an operator receives a payment. See the breakdown before you collect.</p></div></section>
}
