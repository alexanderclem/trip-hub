// The fee calculator (docs/PLAN_THE_SWITCH.md, section 4): what each traveler is charged, what
// Stripe and Stowaway take, and what the organizer keeps, from src/lib/fees.ts.

import { useId, useState } from 'react'
import { quote, STRIPE_US, type FeeMode, type PayMethod } from '@/lib/fees'

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
const dollars = (text: string) => Math.max(0, Math.round((Number.parseFloat(text) || 0) * 100))

export function FeeCalculator() {
  const id = useId()
  const [price, setPrice] = useState('1500')
  const [travelers, setTravelers] = useState('20')
  const [deposit, setDeposit] = useState('300')
  const [method, setMethod] = useState<PayMethod>('card')
  const [international, setInternational] = useState('0')
  const [feeMode, setFeeMode] = useState<FeeMode>('absorb')

  const q = quote({
    price: dollars(price),
    travelers: Math.max(0, Math.floor(Number(travelers) || 0)),
    deposit: dollars(deposit),
    method,
    internationalShare: Number(international) / 100,
    feeMode,
  })
  const people = Math.max(0, Math.floor(Number(travelers) || 0))
  const summary = feeMode === 'absorb'
    ? `You keep ${usd(q.total.kept)} of ${usd(q.total.charged)}.`
    : `You keep ${usd(q.total.kept)}; each traveler pays ${usd(q.perTraveler.charged)} including a booking fee.`

  return (
    <div className="calc">
      <form className="calc-fields" onSubmit={(e) => e.preventDefault()} aria-label="Your trip">
        <label>Trip price per person ($)<input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
        <label>Travelers<input inputMode="numeric" value={travelers} onChange={(e) => setTravelers(e.target.value)} /></label>
        <label>Deposit per person ($)<input inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} aria-describedby={`${id}-deposit`} /></label>
        <span id={`${id}-deposit`} hidden>0 means one payment for the whole price.</span>
        <fieldset>
          <legend>How travelers pay</legend>
          <div className="calc-choice">
            <label><input type="radio" name={`${id}-method`} checked={method === 'card'} onChange={() => setMethod('card')} />Card</label>
            <label><input type="radio" name={`${id}-method`} checked={method === 'ach'} onChange={() => setMethod('ach')} />Bank</label>
          </div>
        </fieldset>
        {method === 'card' && (
          <label>Cards from outside the US
            <select value={international} onChange={(e) => setInternational(e.target.value)}>
              <option value="0">None</option><option value="10">10%</option><option value="25">25%</option><option value="50">50%</option><option value="100">All</option>
            </select>
          </label>
        )}
        <fieldset>
          <legend>Who pays the fees</legend>
          <div className="calc-choice">
            <label><input type="radio" name={`${id}-fees`} checked={feeMode === 'absorb'} onChange={() => setFeeMode('absorb')} />I do</label>
            <label><input type="radio" name={`${id}-fees`} checked={feeMode === 'pass'} onChange={() => setFeeMode('pass')} />Travelers</label>
          </div>
        </fieldset>
      </form>

      <section className="calc-result" aria-labelledby={`${id}-result`}>
        <h3 id={`${id}-result`} className="marketing-muted">For {people} {people === 1 ? 'traveler' : 'travelers'}, you keep</h3>
        <p className="calc-keep">{usd(q.total.kept)}</p>
        <p className="sr-only" aria-live="polite">{summary}</p>
        <div className="calc-table-wrap">
          <table className="calc-table">
            <caption className="sr-only">Each traveler’s payments and fees</caption>
            <thead>
              <tr><td /> {q.charges.map((c) => <th key={c.label} scope="col">{c.label}</th>)}<th scope="col">All {people}</th></tr>
            </thead>
            <tbody>
              <tr><th scope="row">Charged</th>{q.charges.map((c) => <td key={c.label}>{usd(c.charged)}</td>)}<td>{usd(q.total.charged)}</td></tr>
              {feeMode === 'pass' && <tr><th scope="row">Booking fee</th>{q.charges.map((c) => <td key={c.label}>{usd(c.bookingFee)}</td>)}<td>{usd(q.charges.reduce((a, c) => a + c.bookingFee, 0) * people)}</td></tr>}
              <tr><th scope="row">Stripe</th>{q.charges.map((c) => <td key={c.label}>{usd(c.stripeFee)}</td>)}<td>{usd(q.total.stripeFee)}</td></tr>
              <tr><th scope="row">Stowaway</th>{q.charges.map((c) => <td key={c.label}>{usd(c.stowawayFee)}</td>)}<td>{usd(q.total.stowawayFee)}</td></tr>
              <tr><th scope="row">You keep</th>{q.charges.map((c) => <td key={c.label}>{usd(c.kept)}</td>)}<td>{usd(q.total.kept)}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="calc-note">
          Stripe’s fees use its standard US rates as of {STRIPE_US.asOf}: cards 2.9% + 30¢ (1.5% more for cards from outside the US), bank payments 0.8% up to $5.
          Your own Stripe account’s rates may differ; <a className="underline underline-offset-2" href={STRIPE_US.source} target="_blank" rel="noopener noreferrer">check Stripe’s pricing<span className="sr-only"> (opens in a new tab)</span></a>.
          A booking fee applies to every payment method, never as a card surcharge.
        </p>
      </section>
    </div>
  )
}
