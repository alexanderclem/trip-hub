import { Link } from 'react-router'
import { WebsiteFrame } from './WebsiteFrame'
import { TagHead } from './tag/parts'

interface Occasion {
  id: string
  title: string
  intro: string
  fields: [string, string][]
  steps: [title: string, text: string][]
  checklistTitle: string
  checklist: string[]
  story: { title: string; body: string[] }
  faq: [question: string, answer: string][]
  cta: string
}

function OccasionPage({ o }: { o: Occasion }) {
  return (
    <WebsiteFrame>
      <TagHead id={`${o.id}-title`} title={o.title} intro={o.intro} fields={o.fields}>
        <div className="website-actions"><Link to="/new" className="website-button website-button-primary">{o.cta}</Link><Link to="/how-it-works" className="website-text-link">See how it works</Link></div>
      </TagHead>
      <section className="marketing-section website-container" aria-labelledby={`${o.id}-steps`}>
        <h2 id={`${o.id}-steps`}>Planning it with Stowaway</h2>
        <ol className="marketing-walkthrough">{o.steps.map(([title, text], index) => <li key={title}><span className="marketing-step-index" aria-hidden="true">{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol>
      </section>
      <section className="marketing-section website-container marketing-split" aria-labelledby={`${o.id}-story`}>
        <div>
          <h2 id={`${o.id}-story`}>{o.story.title}</h2>
          {o.story.body.map((p) => <p key={p} className="marketing-body">{p}</p>)}
        </div>
        <div>
          <h3 className="marketing-subtitle">{o.checklistTitle}</h3>
          <ul className="marketing-plain-list">{o.checklist.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </section>
      <section className="marketing-section website-container" aria-labelledby={`${o.id}-faq`}>
        <h2 id={`${o.id}-faq`}>Questions</h2>
        <div className="website-faq">{o.faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
        <p className="marketing-body">Splitting costs is usually the hardest part. <Link to="/group-expenses" className="website-text-link">See how group expenses work</Link> or try the <Link to="/tools/trip-cost-splitter" className="website-text-link">free cost splitter</Link>.</p>
      </section>
      <section className="website-closing" aria-labelledby={`${o.id}-closing`}><div className="website-container website-closing-inner"><h2 id={`${o.id}-closing`}>Start with the link. It’s free.</h2><Link to="/new" className="website-button website-button-primary">{o.cta}</Link></div></section>
    </WebsiteFrame>
  )
}

const SPRING_BREAK: Occasion = {
  id: 'spring-break',
  title: 'Plan spring break with your friends',
  intro: 'Spring break trips fall apart in the group chat: ten opinions on where to go, nobody sure who paid for the house, and tickets buried in someone’s email. Stowaway puts the whole trip behind one link, free.',
  fields: [['Group size', 'Any'], ['Price', 'Free'], ['Friends need', 'Just the link'], ['Offline', 'Yes, once prepared']],
  cta: 'Create a spring break trip',
  steps: [
    ['Share one link with the group', 'Create the trip and send the invite link in the group chat. Friends pick their name; nobody needs an account or an app store download.'],
    ['Pool the ideas, then vote', 'Everyone saves the beaches, hikes, bars and day trips they find. Start a vote with a deadline so the group actually decides: each option gets No way, Fine, Want or Must-do.'],
    ['Build the week day by day', 'Put the winners into the plan with times and where you’re staying each night. Each stop shows the travel time from the one before, and the Plan tab shows the forecast.'],
    ['Split the house, the shuttles and the dinners', 'Whoever pays logs it from their phone. Split equally or by nights stayed, log costs in the local currency, and settle up at the end in the fewest payments.'],
    ['Get every phone ready to go', 'Before you fly, each person taps Ready for offline. Flights, the plan and the map then open with no signal, on the beach or on a boat.'],
  ],
  story: {
    title: 'Built for a real spring break',
    body: [
      'Stowaway began as the planner for our own spring break in March 2027: a group of friends going to Antigua and Lake Atitlán in Guatemala. Getting around the lake means boats and mountain roads with patchy signal, so everything had to work offline.',
      'The spring daylight-saving change in the US lands in the middle of most spring breaks, and the plan stays on local time regardless.',
    ],
  },
  checklistTitle: 'Spring break checklist',
  checklist: ['Agree on dates and a budget per person', 'Vote on the destination', 'Book flights and the place to stay', 'Collect passport and emergency details', 'Plan the airport transfers', 'Make a shared packing list', 'Prepare every phone for offline'],
  faq: [
    ['Can friends with Android phones join?', 'Yes. Stowaway runs in any modern browser on iPhone, Android or a laptop. Everyone opens the same link.'],
    ['What if someone only comes for part of the week?', 'Mark who’s going to each plan item, and split costs by shares or between just the people who were there.'],
    ['Does Stowaway book the trip?', 'No. Book flights and places to stay your usual way, then keep the confirmations and tickets with the plan.'],
  ],
}

const BACHELOR: Occasion = {
  id: 'bachelor',
  title: 'Plan a bachelor or bachelorette trip',
  intro: 'One person usually ends up organizing, chasing everyone for money and keeping the surprises secret. Stowaway gives the whole group one link for the plan, the votes and the costs, so the organizer isn’t the group’s spreadsheet.',
  fields: [['Price', 'Free'], ['Friends need', 'Just the link'], ['Costs', 'Split fairly, even unevenly'], ['Offline', 'Yes, once prepared']],
  cta: 'Create a trip for the weekend',
  steps: [
    ['Invite the group with a link', 'Create the trip and share the link with the group, not the guest of honor. Friends pick their name and they’re in.'],
    ['Vote on the activities', 'Pool the ideas (a boat day, a tasting, a show) and let everyone score them. The results show what the group wants and who still needs to vote.'],
    ['Lock the plan', 'Put the winners into a day-by-day plan with times, meeting points, confirmation codes and who’s going to what.'],
    ['Split costs fairly', 'Common practice is that the group covers the guest of honor’s share. Split a cost between everyone except them, or by shares, and settle up in the fewest payments.'],
    ['Keep tickets where everyone can find them', 'Add tickets and reservations to the plan items. Every phone downloads them, and they open offline.'],
  ],
  story: {
    title: 'Keeping it fair',
    body: [
      'Uneven costs are normal on these trips: someone skips the golf, someone arrives a day late, and the guest of honor doesn’t pay. Stowaway lets each cost be split between exactly the people it applies to, so nobody has to do the maths afterwards.',
      'Everyone can see their own balance at any time, which takes the awkwardness out of asking for money.',
    ],
  },
  checklistTitle: 'Weekend checklist',
  checklist: ['Agree on the date with the guest of honor', 'Set a budget per person', 'Vote on the destination and activities', 'Book the place to stay and the big reservations', 'Decide how the guest of honor’s share is covered', 'Share arrival times and the meeting point', 'Prepare every phone for offline'],
  faq: [
    ['Can we keep it a surprise?', 'Yes. Only people with the trip’s link can see it, so share it only with the group and not with the guest of honor.'],
    ['Can one person organize and others just view?', 'In a regular trip everyone who joins can edit. If you want control over who changes the plan, an organizer can switch the trip to hosted and give others view-only access.'],
    ['Does it work for big groups?', 'Yes. There’s no fixed limit on group size, and settle-up keeps the number of payments small.'],
  ],
}

export function SpringBreakScreen() { return <OccasionPage o={SPRING_BREAK} /> }
export function BachelorTripScreen() { return <OccasionPage o={BACHELOR} /> }
