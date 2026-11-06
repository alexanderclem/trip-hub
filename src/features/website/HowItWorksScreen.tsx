import { Link } from 'react-router'
import { WebsiteFrame } from './WebsiteFrame'
import { TagHead } from './tag/parts'

const steps: [title: string, text: string][] = [
  ['Create a trip', 'Give the trip a name, add dates when you know them, and share its invite link. Friends open the link in any browser and pick their name to join. Nobody needs an account or an app store download for group planning.'],
  ['Save places into one pool', 'Anyone can add a restaurant, hike, beach or neighborhood with a pin on the map. Places start in the trip’s idea pool, move to the shortlist, then become planned, booked and visited. Each place keeps its notes, the group’s star ratings and links to open it in Google Maps or Tripadvisor.'],
  ['Vote on what to do', 'Start a vote and everyone scores each option: No way, Fine, Want or Must-do. Options are ranked by the group’s average score, then by fewest “No way” votes. You can see who voted what, set a deadline, and options that fewer than half the group has scored are flagged as needing votes. When you close a vote, the winner goes into the plan in one tap.'],
  ['Build the day-by-day plan', 'Add activities, travel and places to stay, with start and end times, meeting points, who’s going and confirmation codes. Overlapping items are laid out side by side and conflicts are flagged. Each item shows the travel time from the stop before it, and an “Up next” card tells you when to leave.'],
  ['Keep tickets with the plan', 'Add tickets and confirmations from the camera, your photos or a PDF and link them to the plan item they belong to. Every phone in the group downloads everyone’s tickets automatically, and a full-screen viewer shows them at the gate.'],
  ['Split costs as you go', 'Log who paid and how to split it: equally, by shares, by exact amounts or by percentage, with several payers if needed. Enter costs in the local currency at the day’s rate. Stowaway keeps everyone’s balance and suggests the fewest payments to settle up; you pay each other your usual way.'],
  ['Get every phone ready for offline', 'While online, open the trip’s settings and choose Ready for offline. It saves the plan, the group’s tickets, exchange rates and a map pack on that phone. Each person prepares their own phone. Changes made offline sync when the phone reconnects.'],
]

const extras: [title: string, text: string][] = [
  ['Tasks', 'Shared to-dos with an owner and a due date: book the shuttle, renew a passport.'],
  ['Packing list', 'Group items, shared gear and personal lists, with suggestions based on the forecast.'],
  ['Weather', 'A 16-day forecast where you’re sleeping each night, and typical weather for later dates.'],
  ['Ideas for a free day', 'Suggestions from the group’s own saved places for free mornings and meals, ranked by distance and taste.'],
  ['Emergency info', 'Local emergency numbers, the nearest hospital and embassy, and each traveler’s medical card.'],
  ['Calendar export', 'Add the plan to Apple, Google or Outlook calendars with the right time zones.'],
]

export function HowItWorksScreen() {
  return <WebsiteFrame>
    <TagHead fields={[['Start', 'Create a trip, share the link'], ['Decide', 'Save places, vote together'], ['Go', 'The plan works offline'], ['Cost', 'Free for groups']]} id="tour-title" title="How Stowaway works" intro="Stowaway is a free group trip planner that runs in the browser. One link holds the trip: the places you’re considering, the votes, the day-by-day plan, tickets and shared costs."><div className="website-actions"><Link to="/new" className="website-button website-button-primary">Create a trip</Link><Link to="/app#join" className="website-text-link">Join a trip</Link></div></TagHead>
    <section className="marketing-section website-container" aria-labelledby="tour-steps"><h2 id="tour-steps">From idea to the trip itself</h2><ol className="marketing-walkthrough">{steps.map(([title, text], index) => <li key={title}><span className="marketing-step-index" aria-hidden="true">{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></section>
    <section className="marketing-section website-container" aria-labelledby="tour-extras"><h2 id="tour-extras">Also in every trip</h2><ul className="marketing-points">{extras.map(([title, text]) => <li key={title}><h3>{title}</h3><p>{text}</p></li>)}</ul><p className="marketing-body">Splitting costs is the part most groups ask about. <Link to="/group-expenses" className="website-text-link">See how group expenses work</Link>, or try the <Link to="/tools/trip-cost-splitter" className="website-text-link">trip cost splitter</Link> without signing up.</p></section>
    <section className="marketing-section website-container marketing-split"><div><h2>Who can edit the trip</h2><p className="marketing-body">In a regular group trip, everyone who joins can collaborate. Organizers who run trips for others can switch to a hosted trip and choose who edits the plan, who only views it, and whether new travelers need approval.</p><Link to="/organizers" className="website-text-link">See the tools for organizers</Link></div><div><h3 className="marketing-subtitle">Good to know</h3><ul className="marketing-plain-list"><li>Stowaway organizes plans and confirmations; it doesn’t book flights or hotels.</li><li>Anyone with the invite link can see the trip, so share it only with your group.</li><li>Creating or joining a trip needs a connection; everything after that works offline once prepared.</li><li>Sign in, optionally, to bring your trips to another phone.</li></ul><Link to="/help" className="website-text-link">Read the practical guide</Link></div></section>
  </WebsiteFrame>
}
