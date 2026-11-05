import { CalendarDays, Users } from 'lucide-react'

/** Synthetic example only: never imply these are real customers, bookings, or revenue. */
export function OperatorPreview() {
  return <figure className="operator-preview" aria-labelledby="operator-example-caption">
    <figcaption id="operator-example-caption" className="operator-preview-caption">Operator preview · Illustrative data</figcaption>
    <div className="operator-preview-heading"><h3>A long weekend by the lake</h3><p><CalendarDays size={15} aria-hidden="true" /> June 11–14, 2027 <span>·</span><Users size={15} aria-hidden="true" /> 12 travelers</p></div>
    <dl className="operator-example-totals"><div><dt>Collected</dt><dd>$4,300</dd></div><div><dt>Still due</dt><dd>$7,700</dd></div><div><dt>Places filled</dt><dd>12 / 16</dd></div></dl>
    <div className="operator-example-list"><div className="operator-example-labels"><span>Traveler</span><span>Booking status</span></div>{[
      ['Maya R.', 'Deposit paid', '$300'], ['Alex J.', 'Paid in full', '$1,000'], ['Sam K.', 'Deposit paid', '$300'],
    ].map(([name, state, amount]) => <div className="operator-example-row" key={name}><span className="operator-example-avatar" aria-hidden="true">{name!.slice(0, 1)}</span><span className="operator-example-name">{name}<small>{state}</small></span><span>{amount}</span></div>)}</div>
    <p className="operator-preview-foot">The plan, the people, and what needs your attention. Payment collection is coming soon.</p>
  </figure>
}
