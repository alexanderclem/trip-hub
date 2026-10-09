import { CalendarDays, Receipt, Ticket, Users } from 'lucide-react'

const options = [
  { label: 'Dumplings in Chinatown', share: 92, note: 'Must-do' },
  { label: 'Pizza in the West Village', share: 68, note: 'Want' },
  { label: 'Rooftop near the High Line', share: 41, note: 'Fine' },
]

/** Local, illustrative data, one small example per step: an invite, a vote, and the details. */
export function StepExamples() {
  return (
    <div className="website-examples" role="group" aria-labelledby="examples-caption">
      <div className="example-card">
        <span className="website-eyebrow">You’re invited</span>
        <p className="example-title">A few days in NYC</p>
        <p className="example-meta"><CalendarDays size={15} aria-hidden="true" /> Jun 4 – 7 <Users size={15} aria-hidden="true" /> 6 going</p>
      </div>
      <div className="example-card">
        <span className="website-eyebrow">Group vote</span>
        <p className="example-title">Where should we eat on Friday?</p>
        <ul className="example-votes">
          {options.map(({ label, share, note }) => (
            <li key={label}>
              <span>{label}</span><span className="example-note">{note}</span>
              <span className="example-bar" aria-hidden="true"><span style={{ width: `${share}%` }} /></span>
            </li>
          ))}
        </ul>
      </div>
      <div className="example-card example-details">
        <p><Ticket size={17} aria-hidden="true" /><span><strong>High Line walking tour</strong>Saturday, 11:00 · ticket saved</span></p>
        <p><Receipt size={17} aria-hidden="true" /><span><strong>Dinner in Chinatown</strong>$84 split six ways · your share $14</span></p>
      </div>
      <p id="examples-caption" className="example-caption">Examples from the same trip.</p>
    </div>
  )
}
