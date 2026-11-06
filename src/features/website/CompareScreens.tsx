import { Link } from 'react-router'
import { WebsiteFrame } from './WebsiteFrame'
import { TagHead } from './tag/parts'

/**
 * Competitor facts come only from each product's own site or App Store listing, checked on the date
 * below. Anything we couldn't confirm is marked as not stated rather than guessed. Re-check before editing.
 */
const CHECKED = 'November 2026'
const SOURCES = [
  { name: 'Wanderlog on the App Store', href: 'https://apps.apple.com/us/app/wanderlog-travel-planner/id1476732439' },
  { name: 'Splitwise Pro', href: 'https://www.splitwise.com/pro' },
  { name: 'Tricount', href: 'https://www.tricount.com/' },
  { name: 'TripIt on the App Store', href: 'https://apps.apple.com/us/app/tripit-travel-planner/id311035142' },
]

function Sources() {
  return <p className="compare-sources">Checked {CHECKED} against each product’s own pages: {SOURCES.map((s, i) => <span key={s.href}>{i > 0 && ', '}<a href={s.href} target="_blank" rel="noopener noreferrer">{s.name}<span className="sr-only"> (opens in a new tab)</span></a></span>)}. “Not stated” means we couldn’t confirm it there. Products change; if something here is out of date, email <a href="mailto:alexanderclem12@gmail.com">alexanderclem12@gmail.com</a> and we’ll fix it.</p>
}

type Row = [name: string, plan: string, vote: string, split: string, offline: string, price: string]
const APPS: Row[] = [
  ['Stowaway', 'Yes: shared day-by-day plan', 'Yes: scored votes with deadlines', 'Yes: 4 split methods, local currency', 'Yes, after “Ready for offline” (plan, tickets, map)', 'Free for groups'],
  ['Wanderlog', 'Yes: itinerary with tripmates', 'Not stated', 'Yes: budget, expenses and bill splitting', 'Yes: plans stored offline', 'Free, with a paid Pro plan'],
  ['Splitwise', 'No', 'No', 'Yes', 'Not stated', 'Free with a daily expense limit; Pro removes it'],
  ['Tricount', 'No', 'No', 'Yes, with currency conversion', 'Yes', 'Free, no ads, no limits'],
  ['TripIt', 'Yes: from booking emails you forward', 'Not stated', 'Not stated', 'Yes: reservation details', 'Free; Pro is $48.99 a year'],
  ['Group chat + spreadsheet', 'Manual', 'Chat polls', 'Manual formulas', 'Depends on the apps', 'Free'],
]

function CompareTable({ rows, caption }: { rows: Row[]; caption: string }) {
  return (
    <div className="compare-wrap" role="region" aria-label={caption} tabIndex={0}>
      <table className="compare-table">
        <caption className="sr-only">{caption}</caption>
        <thead><tr><th scope="col">App</th><th scope="col">Day-by-day plan</th><th scope="col">Group voting</th><th scope="col">Splitting costs</th><th scope="col">Offline</th><th scope="col">Price</th></tr></thead>
        <tbody>{rows.map(([name, ...cells]) => <tr key={name}><th scope="row">{name}</th>{cells.map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

export function CompareAppsScreen() {
  return (
    <WebsiteFrame>
      <TagHead id="compare-title" title="Group trip planner apps, compared" intro="Planning a trip with friends usually means stitching apps together: one for the itinerary, one for costs, the group chat for decisions. Here’s what the common choices do, including where Stowaway isn’t the best fit." fields={[['Checked', CHECKED], ['Written by', 'The Stowaway team'], ['Apps', '5 + the group chat']]} />

      <section className="marketing-section website-container" aria-labelledby="compare-table-title">
        <h2 id="compare-table-title">At a glance</h2>
        <CompareTable rows={APPS} caption="Group trip apps compared" />
        <Sources />
      </section>

      <section className="marketing-section website-container" aria-labelledby="compare-verdicts">
        <h2 id="compare-verdicts">Which one fits your trip</h2>
        <ul className="compare-verdicts">
          <li><h3>Stowaway: the whole group decides and plans together</h3><p>Best when you want one link for everything: ideas, votes, the plan, tickets and costs, with nothing for friends to download and an offline mode for places with bad signal. It’s newer and smaller than the others, it runs in the browser rather than from an app store, and it doesn’t read booking emails or book anything for you.</p></li>
          <li><h3>Wanderlog: rich itineraries and maps</h3><p>A mature itinerary planner with maps, tripmates, expense splitting and offline plans, plus a paid Pro plan for extras such as exporting to Google Maps. A strong choice if one or two people do most of the planning. Its App Store listing doesn’t mention group voting.</p></li>
          <li><h3>Splitwise and Tricount: costs only</h3><p>Dedicated bill splitters. Splitwise is widely used and also handles everyday bills between roommates; its free version limits how many expenses you can add each day, and currency conversion is part of Pro. Tricount says it’s free with no ads and no limits, works offline, and converts currencies. Neither plans the trip.</p></li>
          <li><h3>TripIt: your own bookings in one itinerary</h3><p>Built around the confirmations you already have: forward a booking email and it’s added to one itinerary you can open offline. Great for a frequent traveler; it isn’t a tool for a group to choose what to do together.</p></li>
          <li><h3>Group chat and a spreadsheet: free and familiar</h3><p>Everyone already has them, and for a weekend that may be enough. Decisions get lost in scrollback, and someone ends up maintaining the spreadsheet formulas.</p></li>
        </ul>
      </section>

      <section className="marketing-section website-container marketing-split" aria-labelledby="compare-choose">
        <div>
          <h2 id="compare-choose">Questions to ask before you pick</h2>
          <ul className="marketing-plain-list">
            <li>Will everyone actually install another app, or should it open from a link?</li>
            <li>Do decisions need the whole group, or does one person plan?</li>
            <li>Will you have signal where you’re going?</li>
            <li>Is anyone paying in a different currency?</li>
            <li>What does it cost once the free version runs out?</li>
          </ul>
        </div>
        <div>
          <h3 className="marketing-subtitle">Try Stowaway with your next trip</h3>
          <p className="marketing-body">It’s free for groups, and you can see the whole thing on the homepage’s example trip first.</p>
          <div className="website-actions"><Link to="/new" className="website-button website-button-primary">Create a trip</Link><Link to="/how-it-works" className="website-text-link">See how it works</Link></div>
        </div>
      </section>
    </WebsiteFrame>
  )
}

const SPLIT: Row[] = [
  ['Stowaway', 'Yes: shared day-by-day plan', 'Yes', 'Equal, shares, exact or percent; several payers; local currency at the day’s rate', 'Yes: add costs with no signal', 'Free, no daily limit'],
  ['Splitwise', 'No', 'No', 'Yes; currency conversion is a Pro feature', 'Not stated', 'Free with a daily expense limit; Pro removes it'],
  ['Tricount', 'No', 'No', 'Yes, with currency conversion', 'Yes', 'Free, no ads, no limits'],
]

export function SplitwiseAlternativeScreen() {
  return (
    <WebsiteFrame>
      <TagHead id="splitwise-title" title="A Splitwise alternative for group trips" intro="Splitwise is a good bill splitter. On a trip, though, the costs are only part of it: the group also has to decide what to do, keep a plan and find the tickets. Stowaway keeps the costs with the trip." fields={[['Checked', CHECKED], ['Best for', 'Trips, not household bills'], ['Price', 'Free, no daily limit']]}>
        <div className="website-actions"><Link to="/tools/trip-cost-splitter" className="website-button website-button-primary">Try the cost splitter</Link><Link to="/group-expenses" className="website-text-link">How group expenses work</Link></div>
      </TagHead>

      <section className="marketing-section website-container" aria-labelledby="split-table-title">
        <h2 id="split-table-title">Splitwise, Tricount and Stowaway</h2>
        <CompareTable rows={SPLIT} caption="Splitting costs on a trip compared" />
        <Sources />
      </section>

      <section className="marketing-section website-container" aria-labelledby="split-diff">
        <h2 id="split-diff">What’s different on a trip</h2>
        <ul className="marketing-points">
          <li><h3>No daily limit</h3><p>A busy travel day can mean a dozen small costs: taxis, tickets, snacks. Splitwise lists unlimited daily expenses as a Pro feature. In Stowaway every cost is free to add.</p></li>
          <li><h3>Local currency, free</h3><p>Pay in pesos, euros or quetzales and log it that way. Stowaway fills in the day’s rate, keeps it with the cost, and keeps balances in your home currency. Splitwise lists currency conversion as part of Pro.</p></li>
          <li><h3>The plan in the same place</h3><p>The dinner, the vote that picked it, the reservation and the bill sit together. “Log what it cost” turns a plan item into an expense in one tap.</p></li>
        </ul>
      </section>

      <section className="marketing-section website-container marketing-split" aria-labelledby="split-stay">
        <div>
          <h2 id="split-stay">When to stay with Splitwise</h2>
          <p className="marketing-body">If you split rent and groceries with roommates all year, Splitwise is built for that kind of ongoing tab, and your history is already there. Stowaway is organized around trips: each trip has its own group, plan and balances.</p>
          <p className="marketing-body">If you want a free bill splitter and don’t need a plan, Tricount is worth a look too.</p>
        </div>
        <div>
          <h3 className="marketing-subtitle">Moving a trip over</h3>
          <ol className="marketing-plain-list">
            <li>Create the trip in Stowaway and share the link with the group.</li>
            <li>Settle up what’s already in Splitwise, or add the open costs to the new trip.</li>
            <li>From then on, each person logs what they pay from their own phone.</li>
          </ol>
          <Link to="/new" className="website-text-link">Create a trip</Link>
        </div>
      </section>
    </WebsiteFrame>
  )
}
