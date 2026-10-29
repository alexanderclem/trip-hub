import { CalendarDays, Receipt, Ticket, Users } from 'lucide-react'

const options = [
  { label: 'Dumplings in Chinatown', share: 92, note: 'Must-do' },
  { label: 'Pizza in the West Village', share: 68, note: 'Want' },
  { label: 'Rooftop near the High Line', share: 41, note: 'Fine' },
]

/** Illustrative product artifacts; no real invites, votes, or transactions. */
export function StepExamples() {
  return (
    <div className="website-example-group" role="group" aria-labelledby="examples-caption">
      <ol className="website-steps">
        <li>
          <div className="website-step-heading"><span className="website-step-number" aria-hidden="true">01</span><h3>Invite your people</h3></div>
          <p>Create a trip and send the invite link. Choose a destination now or decide together.</p>
          <div className="example-card example-invite">
            <span className="website-eyebrow">You’re invited</span>
            <p className="example-title">A few days in NYC</p>
            <p className="example-meta"><CalendarDays size={15} aria-hidden="true" /> Jun 4–7 <Users size={15} aria-hidden="true" /> 6 travelers</p>
            <span className="example-invite-note">One link. Everyone’s in the loop.</span>
          </div>
        </li>
        <li>
          <div className="website-step-heading"><span className="website-step-number" aria-hidden="true">02</span><h3>Pick the group’s favorites</h3></div>
          <p>Save places and start a vote. Add the ideas everyone likes to the itinerary.</p>
          <div className="example-card">
            <span className="website-eyebrow">Group vote</span>
            <p className="example-title">Friday dinner?</p>
            <ul className="example-votes">
              {options.map(({ label, share, note }) => (
                <li key={label}><span>{label}</span><span className="example-note">{note}</span><span className="example-bar" aria-hidden="true"><span style={{ width: `${share}%` }} /></span></li>
              ))}
            </ul>
          </div>
        </li>
        <li>
          <div className="website-step-heading"><span className="website-step-number" aria-hidden="true">03</span><h3>Keep the details together</h3></div>
          <p>Save tickets, log shared expenses, and see who owes what as the trip unfolds.</p>
          <div className="example-card example-details">
            <p><Ticket size={19} aria-hidden="true" /><span><strong>High Line walking tour</strong>Saturday, 11:00 · ticket saved</span></p>
            <p><Receipt size={19} aria-hidden="true" /><span><strong>Dinner in Chinatown</strong>$84 split six ways · your share $14</span></p>
          </div>
        </li>
      </ol>
      <p id="examples-caption" className="example-caption">Illustrative examples from one group trip.</p>
    </div>
  )
}
