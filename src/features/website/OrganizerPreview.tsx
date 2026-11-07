import { CalendarDays, Users } from 'lucide-react'
import { avatarPalette } from '@/ui/avatarPalette'
import { travelerInitials } from '@/features/trips/traveler'

// Three of the app's member colors (MEMBER_COLORS in features/trips/actions.ts), so the rows look like the
// real traveler list. Importing that module would pull the sync engine into the website chunk.
const ROWS = [
  { name: 'Maya R.', color: '#0d9488', status: 'Deposit paid', paid: false, amount: '$300' },
  { name: 'Alex J.', color: '#2563eb', status: 'Paid in full', paid: true, amount: '$1,000' },
  { name: 'Sam K.', color: '#db2777', status: 'Deposit paid', paid: false, amount: '$300' },
]

/**
 * The organizer's trip dashboard as a product shot. Synthetic example only: never imply these are real
 * customers, bookings or revenue. One number leads (what's collected); the rest is the traveler list.
 * Titles are divs, not headings: a picture of an app stays out of the page outline.
 */
export function OrganizerPreview() {
  return <figure className="operator-preview" aria-labelledby="operator-example-caption">
    <div className="operator-preview-frame">
      <div className="operator-preview-heading">
        <div className="operator-preview-title">Four days in Paris</div>
        <p><CalendarDays size={16} aria-hidden="true" /> June 11–14, 2027 <span aria-hidden="true">·</span> <Users size={16} aria-hidden="true" /> 12 of 16 places filled</p>
      </div>
      <div className="operator-collected">
        <p className="operator-collected-label">Collected</p>
        <p className="operator-collected-amount">$4,300 <span>of $12,000</span></p>
        <div className="operator-meter" aria-hidden="true"><span style={{ width: '36%' }} /></div>
      </div>
      <ul className="operator-example-list" aria-label="Travelers (example)">
        {ROWS.map((row) => {
          const palette = avatarPalette(row.color)
          return <li className="operator-example-row" key={row.name}>
            <span className="operator-example-avatar" aria-hidden="true" style={{ background: palette.background, color: palette.lightText ? '#fff' : '#000' }}>{travelerInitials(row.name)}</span>
            <span className="operator-example-name">{row.name}</span>
            <span className={`operator-example-status ${row.paid ? 'is-paid' : ''}`}>{row.status}</span>
            <span className="operator-example-amount">{row.amount}</span>
          </li>
        })}
      </ul>
    </div>
    <figcaption id="operator-example-caption" className="operator-preview-caption">Your view of a trip: what’s collected, and each traveler’s booking. Illustrative data.</figcaption>
  </figure>
}
