import { Check } from 'lucide-react'
import { Link } from 'react-router'
import { WebsiteFrame } from './WebsiteFrame'
import { FeeCalculator } from './FeeCalculator'
import { TagHead } from './tag/parts'

/** Public pricing: planning stays free; collecting money costs a flat 1% on top of Stripe's fee. */
export function PricingScreen() {
  return (
    <WebsiteFrame>
      <TagHead fields={[['Groups', 'Free'], ['Organizers', '1% + Stripe’s fee'], ['Collection', 'Coming soon · US & USD'], ['Pro tools', 'Free during beta']]} id="pricing-title" title="Plan for free. Pay 1% only when you collect money." intro="Group planning is free today. Operator payment collection is coming soon, with a proposed flat 1% fee plus Stripe’s processing fees." />

      <section className="marketing-section website-container" aria-labelledby="plans-title">
        <h2 id="plans-title">What it costs</h2>
        <div className="marketing-plans">
          <article className="marketing-plan" aria-labelledby="plan-free">
            <h3 id="plan-free">Planning</h3>
            <p className="marketing-price">Free</p>
            <ul>
              {['Create trips and invite your group by link', 'Vote on places and build the day-by-day plan', 'Track shared costs and calculate balances', 'Keep tickets and prepare saved plans for offline use'].map((t) => <li key={t}><Check size={16} aria-hidden="true" />{t}</li>)}
            </ul>
            <Link to="/new" className="website-text-link">Create a trip</Link>
          </article>
          <article className="marketing-plan" aria-labelledby="plan-collect">
            <h3 id="plan-collect">Collecting payments <span className="marketing-muted">(coming soon)</span></h3>
            <p className="marketing-price">1% <span className="marketing-muted text-base tracking-normal">+ Stripe’s fee</span></p>
            <ul>
              {['Deposits, balances, and dated payment plans', 'Payments to your connected Stripe account', 'Choose to absorb fees or show a traveler booking fee', 'Our 1% is refunded proportionally when you refund a payment'].map((t) => <li key={t}><Check size={16} aria-hidden="true" />{t}</li>)}
            </ul>
            <Link to="/operators#early-access" className="website-text-link">Request collection access</Link>
          </article>
          <article className="marketing-plan" aria-labelledby="plan-pro"><h3 id="plan-pro">Pro operator tools <span className="marketing-availability">Beta</span></h3><p className="marketing-price">Free during beta</p><ul>{['Repeat-trip templates and reports', 'Past travelers and CSV import', 'Room assignments and waitlists'].map((t) => <li key={t}><Check size={16} aria-hidden="true" />{t}</li>)}</ul><p className="calc-note">For eligible operators. Future subscription pricing is undecided; paid subscription billing is not active. Campaign email delivery remains disabled.</p><Link to="/operators" className="website-text-link">Explore the beta</Link></article>
        </div>
        <p className="calc-note">Operator tools and collection availability depend on onboarding. The initial collection launch is US operators and USD. Free group planning does not transfer money between friends.</p>
      </section>

      <section className="marketing-section website-container" aria-labelledby="calculator-title">
        <h2 id="calculator-title">See what you keep</h2>
        <p className="marketing-body">Model your trip price, traveler count, and deposit. This is an estimate using standard processing rates, not a charge or an offer to activate payments.</p>
        <FeeCalculator />
      </section>

      <section className="marketing-section website-container" aria-labelledby="pricing-faq"><h2 id="pricing-faq">Fees, without the guesswork.</h2><div className="website-faq">
        <details><summary>What stays free?</summary><p>Creating trips, inviting your group, voting, planning, tracking expenses, keeping tickets, and preparing for offline use. An expense balance is a record, not a money transfer.</p></details>
        <details><summary>When does the 1% apply?</summary><p>The current proposal applies to each payment an operator collects, including deposits and subsequent payments. It is separate from Stripe’s processing fee. Collection is coming soon.</p></details>
        <details><summary>Can travelers pay the fees?</summary><p>The collection workflow lets the operator absorb fees by default or show a traveler-paid booking fee. The calculator shows the resulting charge and proceeds. A booking fee applies across payment methods.</p></details>
        <details><summary>What happens when I refund a payment?</summary><p>Stowaway’s application fee is refunded in proportion to the refunded amount. Stripe’s processing-fee treatment depends on your Stripe agreement; don’t assume those fees are refunded. The operator’s cancellation policy governs the trip.</p></details>
        <details><summary>When will money reach my bank?</summary><p>Payments go to the operator’s connected Stripe account. Stripe manages settlement and payout timing and may apply holds or reserves. Stowaway does not guarantee immediate bank availability.</p></details>
        <details><summary>Are there subscription charges?</summary><p>There is no subscription to begin free planning. Eligible operators can use Pro free during beta. Future Pro pricing is undecided and subscription billing is not active.</p></details>
        <details><summary>How do card and bank fees differ?</summary><p>The calculator estimates standard US card and bank-payment fees, including a configurable share of international cards. Fixed per-payment processing fees may apply again to each installment. Your account’s rates and available methods can differ.</p></details>
      </div></section>

      <section className="website-closing" aria-labelledby="pricing-closing"><div className="website-container website-closing-inner"><h2 id="pricing-closing">Start with the plan. It’s free.</h2><Link to="/new" className="website-button website-button-primary">Create a trip</Link></div></section>
    </WebsiteFrame>
  )
}
