import { useState } from 'react'
import { CalendarDays, Check, MapPin, Receipt, Ticket, Users, Vote } from 'lucide-react'

const days = [
  { title: 'West Side wandering', stops: [
    { time: '09:00', name: 'Coffee in the West Village', note: 'An easy start, together.' },
    { time: '11:00', name: 'Walk the High Line', note: 'Meet at the Gansevoort Street entrance.' },
    { time: '19:00', name: 'Dinner in Chinatown', note: 'The group’s pick. Table for six.' },
  ] },
  { title: 'Art and a little fresh air', stops: [
    { time: '09:30', name: 'Bagels on the Upper West Side', note: 'Breakfast before the park.' },
    { time: '11:00', name: 'A stroll through Central Park', note: 'Take the scenic way across.' },
    { time: '14:00', name: 'An afternoon at the Met', note: 'Tickets saved with the plan.' },
  ] },
  { title: 'A day downtown', stops: [
    { time: '10:00', name: 'Browse the shops in SoHo', note: 'A little time to find your own thing.' },
    { time: '12:30', name: 'Lunch together in Chinatown', note: 'Order a few dishes for the table.' },
    { time: '16:00', name: 'Walk the Brooklyn Bridge', note: 'One last view to take home.' },
  ] },
]
const stages = ['Ideas', 'Vote', 'Plan', 'Essentials'] as const
type Stage = typeof stages[number]

/** A safe, local-only example. No accounts, map requests, writes or real trip data. */
export function TripPreview() {
  const [stage, setStage] = useState<Stage>('Plan')
  const [selected, setSelected] = useState(0)
  const [score, setScore] = useState<string | null>(null)
  const day = days[selected]!
  return (
    <figure className="website-preview" aria-labelledby="preview-caption">
      <div className="preview-heading">
        <div><span className="website-eyebrow">TRY A SAMPLE TRIP</span><h2>A few days in NYC</h2></div>
        <span className="preview-tag"><Users size={15} aria-hidden="true" /> 6 friends</span>
      </div>
      <div className="preview-stages" role="group" aria-label="Explore the sample trip">
        {stages.map((name) => <button type="button" key={name} aria-pressed={stage === name} aria-controls="sample-content" onClick={() => setStage(name)}>{name}</button>)}
      </div>
      <div id="sample-content" className="preview-content">
        {stage === 'Ideas' && <div className="preview-example-panel">
          <p className="preview-context">Start with the places from your group chat.</p>
          {[['Walk the High Line', 'Sight · Added by Maya'], ['Dinner in Chinatown', 'Food · Added by Alex'], ['An afternoon at the Met', 'Culture · Added by Sam']].map(([name, note]) => <div key={name} className="preview-example-row"><MapPin aria-hidden="true" size={19} /><div><h3>{name}</h3><p>{note}</p></div><span className="preview-status">Saved</span></div>)}
          <p className="preview-next"><Vote aria-hidden="true" size={17} /> Can’t agree? Put the options to a vote.</p>
        </div>}
        {stage === 'Vote' && <div className="preview-example-panel">
          <p className="website-eyebrow">GROUP VOTE / EXAMPLE</p>
          <h3 className="preview-question">Where should we eat on Friday?</h3>
          <div className="preview-vote-result"><span>Dumplings in Chinatown</span><span className="preview-status">Group favorite</span></div>
          <p className="preview-context">Everyone scores each option, from “No way” to “Must-do.” Try a score for this one:</p>
          <div className="preview-score" role="group" aria-label="Try a sample vote">
            {['No way', 'Fine', 'Want', 'Must-do'].map((label) => <button type="button" key={label} aria-pressed={score === label} onClick={() => setScore(label)}>{label}</button>)}
          </div>
          <p className="preview-feedback" role="status">{score ? `Your sample score: ${score}. Nothing is saved to a real trip.` : 'This is just practice—your group won’t see it.'}</p>
          <button type="button" className="preview-next" onClick={() => setStage('Plan')}><CalendarDays aria-hidden="true" size={17} /> See the favorite on the plan →</button>
        </div>}
        {stage === 'Plan' && <>
          <div className="preview-days" role="group" aria-label="Explore the example itinerary">
            {days.map((_, index) => <button key={index} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>Day {index + 1}</button>)}
          </div>
          <div className="preview-map" aria-hidden="true"><svg viewBox="0 0 560 180" preserveAspectRatio="xMidYMid slice">
            <rect width="560" height="180" fill="var(--color-website-map-ground)" />
            <path d="M0 0H120L65 95 90 180H0ZM470 0H560V180H405L455 100Z" fill="var(--color-website-map-park)" />
            <g stroke="var(--color-website-map-streets)" strokeWidth="11" fill="none"><path d="M-20 20L580 135M-20 95L580 210M170 -20L115 200M270 -20L215 200M370 -20L315 200M470 -20L415 200" /></g>
            <path d="M164 130C195 140 197 48 260 63S381 145 401 36" fill="none" stroke="var(--color-brand-700)" strokeWidth="3" />
            {[[164, 130], [260, 63], [401, 36]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="16" fill="var(--color-brand-700)" stroke="var(--color-website-surface)" strokeWidth="4" /><text x={x} y={y! + 5} textAnchor="middle" fill="var(--color-website-on-action)" fontSize="13">{i + 1}</text></g>)}
          </svg></div>
          <div className="preview-plan">
            <div className="preview-day"><CalendarDays size={16} aria-hidden="true" /><span>{day.title}</span></div>
            <ol>{day.stops.map((stop) => <li key={stop.time}><span className="preview-time">{stop.time}</span><div><h3>{stop.name}</h3><p>{stop.note}</p></div></li>)}</ol>
          </div>
        </>}
        {stage === 'Essentials' && <div className="preview-example-panel">
          <p className="preview-context">The details you need, without searching old messages.</p>
          <div className="preview-example-row"><Ticket aria-hidden="true" size={20} /><div><h3>The Met · Entry tickets</h3><p>Day 2, 14:00 · Six travelers</p><p className="preview-saved"><Check size={14} aria-hidden="true" /> Downloaded on this sample phone</p></div></div>
          <div className="preview-example-row"><Receipt aria-hidden="true" size={20} /><div><h3>Dinner in Chinatown</h3><p>$84 paid by Maya · Split six ways</p><strong>Your share: $14</strong></div></div>
          <p className="preview-next">In your own trip, download essentials while online before you travel.</p>
        </div>}
      </div>
      <figcaption id="preview-caption">Sample trip · Illustrative map · Nothing you try here is saved.</figcaption>
    </figure>
  )
}
