import { useState } from 'react'
import { Collapsible } from '@astryxdesign/core/Collapsible'
import { Button } from '@/ui'

const scores = ['No way', 'Fine', 'Want', 'Must-do'] as const

/** A disposable local example: no trip, booking, network call or persistence. */
export function PlanningExample() {
  const [score, setScore] = useState<number | null>(null)
  const [planned, setPlanned] = useState(false)
  return <div className="planning-example">
    <Collapsible trigger="Try planning with the Paris example" defaultIsOpen={false}>
      <section aria-label="Interactive Paris example" className="space-y-4 pt-2">
        <p className="text-sm text-muted">A fictional group is choosing an afternoon in Paris. Try a preference, then choose whether to add the group’s pick to the plan.</p>
        <h3 className="ui-section-title">Le Marais</h3>
        <div role="group" aria-label="Your preference for Le Marais" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {scores.map((label, value) => <Button key={label} type="button" variant="secondary" className="aria-pressed:bg-ink aria-pressed:text-on-action" aria-pressed={score === value} disabled={planned} onClick={() => setScore(value)}>{label}</Button>)}
        </div>
        <Button type="button" variant="ghost" disabled={score === null || planned} onClick={() => setScore(null)}>Clear preference</Button>
        <p className="text-sm text-muted">Le Marais: {16 + (score ?? 0)} points · Montmartre: 16 points. A vote is a preference, not a booking.</p>
        <div className="border-y border-line py-3" role="status" aria-live="polite">
          {planned ? <p><strong>15:00 · Le Marais</strong><span className="block text-sm text-muted">Added to the example itinerary · Tentative · Nothing booked</span></p>
            : <p>{score === null ? 'Your preference is not set.' : score > 0 ? 'Le Marais leads. You decide whether to add it to the plan.' : 'The options are tied. Try a different preference or clear it.'}<span className="block text-sm text-muted">15:00 · Afternoon is still open</span></p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={score === null || score === 0 || planned} onClick={() => setPlanned(true)}>Add to plan</Button>
          <Button type="button" variant="ghost" onClick={() => { setScore(null); setPlanned(false) }}>Reset example</Button>
        </div>
        <p className="text-sm text-muted">This example stays on this page. It does not create a trip or make a booking.</p>
      </section>
    </Collapsible>
  </div>
}
