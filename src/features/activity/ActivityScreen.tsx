import { useParams } from 'react-router'
import { useMyMemberId } from '@/data/device'
import { useMembers } from '@/data/hooks'
import { PageHeader } from '@/ui'
import { ActivityList } from './ActivityList'
import { useActivity, useMarkActivitySeen } from './data'

export function ActivityScreen() {
  const { tripId } = useParams() as { tripId: string }
  const me = useMyMemberId(tripId)
  const members = useMembers(tripId) ?? []
  const events = useActivity(tripId, 200)
  const since = useMarkActivitySeen(tripId, events !== undefined)
  return (
    <div className="min-h-full pb-8">
      <PageHeader title="What’s new" back={`/t/${tripId}/overview`} />
      <div className="mx-auto max-w-2xl p-4">
        {events === undefined ? <p role="status" className="text-sm text-stone-600">Loading…</p>
          : events.length === 0 ? <p className="text-sm text-stone-600">Nothing yet. What the group adds will show up here.</p>
          : <ActivityList tripId={tripId} events={events} members={members} me={me} since={since} />}
      </div>
    </div>
  )
}
