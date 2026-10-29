import { useEffect, type ReactNode } from 'react'
import { DateTime } from 'luxon'
import { useLiveQuery } from 'dexie-react-hooks'
import { m } from 'motion/react'
import { db } from '@/data/db'
import { classify, dayLabel, matchScore, type Profile, type Scores } from '@/features/discovery/model'
import { RadarChart } from '@/features/discovery/RadarChart'
import { formatMoney } from '@/lib/money'
import { motionTiming } from '@/ui/motion'
import { describeProposal, type Proposal } from './proposal'
import type { Chip } from './script'

/** One line of the conversation. Stowie's sit left on the surface colour, the person's right in brand. */
export function Bubble({ from, children }: { from: 'stowie' | 'me'; children: ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={motionTiming.enter}
      className={`w-fit max-w-[88%] rounded-surface px-4 py-2.5 text-[0.95rem] leading-relaxed ${from === 'me' ? 'ml-auto rounded-br-control bg-action text-white' : 'rounded-bl-control border border-line bg-surface text-ink'}`}
    >
      <span className="sr-only">{from === 'me' ? 'You: ' : 'Stowie: '}</span>{children}
    </m.div>
  )
}

/** Reply chips in one sideways-scrolling row, so they never push the conversation off a phone screen. */
export function ChipRow({ chips, disabled, onPick }: { chips: Chip[]; disabled?: boolean; onPick(chip: Chip): void }) {
  if (!chips.length) return null
  return (
    <div role="group" aria-label="Suggested replies" className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none]">
      {chips.map((chip) => (
        <button key={chip.id} type="button" disabled={disabled} onClick={() => onPick(chip)} className="min-h-11 shrink-0 whitespace-nowrap rounded-full border border-action bg-surface px-4 text-sm font-medium text-ink hover:bg-brand-50 active:bg-mist disabled:opacity-45">
          {chip.label}
        </button>
      ))}
    </div>
  )
}

export function ProfileCard({ scores }: { scores: Scores }) {
  return (
    <div className="max-w-md rounded-surface border border-line bg-surface p-4">
      <p className="text-center font-medium text-ink">{classify(scores)}</p>
      <RadarChart scores={scores} label="Suggested travel style" />
    </div>
  )
}

/** What Stowie offers to add. The Yes and No are Stowie's chips; this shows what they apply to. */
export function ProposalCard({ proposal, state }: { proposal: Proposal; state: 'pending' | 'done' | 'dismissed' }) {
  const { heading, title, details } = describeProposal(proposal)
  return (
    <div className={`max-w-md rounded-surface border border-line bg-surface p-4 ${state === 'dismissed' ? 'opacity-60' : ''}`}>
      <p className="text-sm font-medium text-action">{heading}{state === 'done' ? ' · Added' : state === 'dismissed' ? ' · Not added' : ''}</p>
      <p className="mt-1 font-semibold text-ink">{title}</p>
      <ul className="mt-1 text-sm text-muted">{details.map((line) => <li key={line}>{line}</li>)}</ul>
    </div>
  )
}

function activityTimeRange(time: string, durationMinutes: number) {
  const end = DateTime.fromISO(`2000-01-01T${time}`, { zone: 'utc' }).plus({ minutes: durationMinutes })
  return `${time}–${end.toFormat('HH:mm')}${end.day > 1 ? ' (+1 day)' : ''}`
}

/** A saved draft, shown inside the conversation. The buttons that act on it are Stowie's chips. */
export function DraftCard({ draftId, profiles, onLoad }: { draftId: string; profiles: Profile[]; onLoad?(): void }) {
  const draft = useLiveQuery(async () => (await db.ai_drafts.get(draftId)) ?? null, [draftId])
  const idea = draft?.result.ideas[0]
  // The card arrives a moment after its message, so the chat can't place it until now.
  const loaded = !!idea
  useEffect(() => { if (loaded) onLoad?.() }, [loaded, onLoad])
  if (draft === undefined) return null
  if (!idea) return <p className="max-w-md rounded-surface border border-line bg-surface p-4 text-sm text-muted">This draft is no longer on this phone.</p>
  return (
    <article className="max-w-xl rounded-surface border border-line bg-surface p-4">
      <p className="text-sm font-medium text-action">{idea.destination}</p>
      <h3 className="travel-heading mt-1 text-2xl text-ink">{idea.title}</h3>
      {!!profiles.length && <p className="mt-2 w-fit rounded-surface bg-brand-50 px-3 py-1.5 text-sm font-medium text-ink">{matchScore(idea.scores, profiles)}% preference match</p>}
      <p className="mt-3 text-sm leading-relaxed text-ink">{idea.summary}</p>
      <p className="mt-3 text-sm"><strong>Why it fits:</strong> {idea.why}</p>
      {idea.tradeoffs && <p className="mt-2 text-sm text-muted"><strong>Tradeoffs:</strong> {idea.tradeoffs}</p>}
      <p className="mt-3 text-sm font-medium">{idea.days.length} {idea.days.length === 1 ? 'day' : 'days'}{idea.estimatedCostMinor !== null ? ` · About ${formatMoney(idea.estimatedCostMinor, idea.currency)} per person` : ''}<span className="font-normal text-muted"> · Estimate, verify before booking</span></p>
      <details className="mt-3 border-t border-line">
        <summary className="min-h-11 cursor-pointer py-3 font-medium text-action">Preview daily itinerary</summary>
        <ol className="space-y-4 pb-2">
          {idea.days.map((day, i) => (
            <li key={i}>
              <h4 className="font-semibold">{dayLabel(i, day.title)}</h4>
              <ul className="mt-2 space-y-2">
                {day.activities.map((a, j) => (
                  <li key={j} className="flex gap-3 text-sm">
                    <span className="shrink-0 tabular-nums text-muted">{activityTimeRange(a.time, a.durationMinutes)}</span>
                    <div><p>{a.title}</p>{a.notes && <p className="text-xs leading-relaxed text-muted">{a.notes}</p>}</div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        {!!idea.tasks.length && <p className="pb-2 text-sm text-muted">Planning tasks: {idea.tasks.join(' · ')}</p>}
      </details>
      {draft.replacesDraftId && !draft.application && <p className="mt-2 rounded-surface bg-brand-50 p-3 text-sm">Adding this revision replaces the earlier draft’s unedited additions. Booked, edited and referenced entries stay in the plan.</p>}
      {draft.application && <p className="mt-2 rounded-surface bg-brand-50 p-3 text-sm">{draft.application.undone ? 'This draft was added and then undone.' : 'This draft is in the plan.'}</p>}
    </article>
  )
}
