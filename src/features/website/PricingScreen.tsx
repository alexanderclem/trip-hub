import { ArrowUpRight, Check } from 'lucide-react'
import { Link } from 'react-router'
import { WebsiteFrame } from './WebsiteFrame'
import { FeeCalculator } from './FeeCalculator'

/** Public pricing: planning stays free; collecting money costs a flat 1% on top of Stripe's fee. */
export function PricingScreen() {
  return (
    <WebsiteFrame>
      <section className="marketing-hero website-container" aria-labelledby="pricing-title">
        <p className="website-eyebrow">Pricing</p>
        <h1 id="pricing-title">Plan for free. Pay 1% only when you collect money.</h1>
        <p className="website-intro">No subscription to start, no hidden booking fee. Money goes straight to your own Stripe account, and Stowaway never holds it.</p>
      </section>

      <section className="marketing-section website-container" aria-labelledby="plans-title">
        <h2 id="plans-title">What it costs</h2>
        <div className="marketing-plans">
          <article className="marketing-plan" aria-labelledby="plan-free">
            <h3 id="plan-free">Planning</h3>
            <p className="marketing-price">Free</p>
            <ul>
              {['Create trips and invite your group by link', 'Vote on places and build the day-by-day plan', 'Split shared costs and settle up', 'Keep tickets, and use it all offline'].map((t) => <li key={t}><Check size={16} aria-hidden="true" />{t}</li>)}
            </ul>
          </article>
          <article className="marketing-plan" aria-labelledby="plan-collect">
            <h3 id="plan-collect">Collecting payments <span className="marketing-muted">(coming soon)</span></h3>
            <p className="marketing-price">1% <span className="marketing-muted" style={{ fontSize: '1rem', letterSpacing: 0 }}>+ Stripe’s fee</span></p>
            <ul>
              {['Deposits and balances from every traveler', 'Paid straight to your own Stripe account, on your payout schedule', 'You choose who pays the fees: you, or travelers as a booking fee', 'Refund a traveler and we refund our 1% on it'].map((t) => <li key={t}><Check size={16} aria-hidden="true" />{t}</li>)}
            </ul>
          </article>
        </div>
        <p className="calc-note">Tools for organizers who run trips often, like templates, reminders and a traveler list, will come later as a paid plan. Planning stays free.</p>
      </section>

      <section className="marketing-section website-container" aria-labelledby="calculator-title">
        <h2 id="calculator-title">See what you keep</h2>
        <FeeCalculator />
      </section>

      <section className="website-closing" aria-labelledby="pricing-closing"><div className="website-container website-closing-inner"><h2 id="pricing-closing">Start with the plan. It’s free.</h2><Link to="/new" className="website-button website-button-primary">Create a trip <ArrowUpRight size={18} aria-hidden="true" /></Link></div></section>
    </WebsiteFrame>
  )
}
