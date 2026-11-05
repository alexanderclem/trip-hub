import { Link } from 'react-router'
import { WebsiteFrame } from './WebsiteFrame'
import { TagHead } from './tag/parts'

export function HowItWorksScreen() {
  return <WebsiteFrame>
    <TagHead fields={[['Start', 'Create a trip, share the link'], ['Decide', 'Save places, vote together'], ['Go', 'The plan works offline'], ['Cost', 'Free for groups']]} id="tour-title" title="How Stowaway works"><div className="website-actions"><Link to="/new" className="website-button website-button-primary">Create a trip</Link><Link to="/app#join" className="website-text-link">Join a trip</Link></div></TagHead>
    <section className="marketing-section website-container" aria-labelledby="tour-steps"><h2 id="tour-steps">Set up your trip</h2><ol className="marketing-walkthrough">{[
      ['Create a trip', 'Give the trip a name, add dates when you know them, and share its invite link. Friends pick their name to join. An account is optional for group planning.'],
      ['Save places and vote', 'Keep places in one pool and compare options with a group vote. Everyone can express a preference; you decide what belongs in the itinerary.'],
      ['Build the day-by-day plan', 'Add activities, travel, and places to stay, with times, notes, and meeting points. Link the relevant tickets so the details stay with the event.'],
      ['Keep tickets, tasks, and costs together', 'Store confirmations, assign planning tasks, and record shared expenses. Stowaway calculates balances; friends settle up separately.'],
      ['Prepare before you lose signal', 'Open trip settings while online and choose Ready for offline. Download tickets and a map pack or saved area separately, on each device you’ll take. Saved changes sync when you reconnect.'],
    ].map(([title, text], index) => <li key={title}><span className="marketing-step-index" aria-hidden="true">{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></section>
    <section className="marketing-section website-container marketing-split"><div><h2>Who can edit the trip</h2><p className="marketing-body">In a regular group trip, everyone who joins can collaborate. Operators can use hosted-trip permissions to control who edits the plan.</p><Link to="/operators" className="website-text-link">Explore the operator beta</Link></div><div><h3 className="marketing-subtitle">Accounts and access</h3><ul className="marketing-plain-list"><li>Stowaway organizes plans and confirmations; it doesn’t book flights or hotels.</li><li>Share your trip link only with people you trust.</li><li>Creating or joining a trip needs a connection.</li><li>Sign in optionally to bring your trips to another phone.</li></ul><Link to="/help" className="website-text-link">Read the practical guide</Link></div></section>
  </WebsiteFrame>
}
