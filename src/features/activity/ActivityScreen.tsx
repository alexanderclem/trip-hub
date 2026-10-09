import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { useMyMemberId } from '@/data/device'
import { useMembers } from '@/data/hooks'
import { PageHeader } from '@/ui'
import { ActivityList } from './ActivityList'
import { useActivity, useMarkActivitySeen } from './data'
import { GROUPS, groupOf, type ActivityGroup } from './feed'
import { ListSkeleton } from '@/ui/collection'

const LABEL: Record<ActivityGroup, string> = { votes: 'Votes', plan: 'Plan', places: 'Places', money: 'Money', tasks: 'Tasks', tickets: 'Tickets', comments: 'Comments' }
const CHIP = 'min-h-11 shrink-0 rounded-xl border px-3 text-sm font-medium'
const chip = (on: boolean) => `${CHIP} ${on ? 'border-brand-700 bg-brand-700 text-white' : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-100'}`

export function ActivityScreen() {
  const { tripId } = useParams() as { tripId: string }
  const me = useMyMemberId(tripId)
  const members = useMembers(tripId) ?? []
  const events = useActivity(tripId, 200)
  const since = useMarkActivitySeen(tripId, events !== undefined)
  const [filter, setFilter] = useState<ActivityGroup | null>(null)
  // Only the kinds of news this trip has, so there is never a chip that leads to nothing.
  const groups = useMemo(() => GROUPS.filter((g) => events?.some((e) => groupOf(e.kind) === g)), [events])
  const active = filter && groups.includes(filter) ? filter : null
  const shown = useMemo(() => (active ? events?.filter((e) => groupOf(e.kind) === active) : events), [events, active])
  return (
    <div className="min-h-full pb-8">
      <PageHeader title="What’s new" back={`/t/${tripId}/overview`} />
      <div className="mx-auto max-w-2xl p-4">
        {groups.length > 1 && (
          <div role="group" aria-label="Show" className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-2">
            <button aria-pressed={!active} onClick={() => setFilter(null)} className={chip(!active)}>All</button>
            {groups.map((g) => <button key={g} aria-pressed={active === g} onClick={() => setFilter(g)} className={chip(active === g)}>{LABEL[g]}</button>)}
          </div>
        )}
        {shown === undefined ? <ListSkeleton label="Loading…" rows={5} />
          : shown.length === 0 ? <p className="text-sm text-stone-600">Nothing yet. What the group adds will show up here.</p>
          : <ActivityList tripId={tripId} events={shown} members={members} me={me} since={since} />}
      </div>
    </div>
  )
}
