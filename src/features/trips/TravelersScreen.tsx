import { useParams } from 'react-router'
import { useMembers, useTrip } from '@/data/hooks'
import { useMyMemberId } from '@/data/device'
import { PageHeader } from '@/ui'
import { ListSkeleton } from '@/ui/collection'
import { PeopleCard } from './PeopleCard'

/** The Home roster uses the same role checks and local member data as Settings. */
export function TravelersScreen() {
  const { tripId } = useParams() as { tripId: string }
  const trip = useTrip(tripId)
  const members = useMembers(tripId)
  const me = useMyMemberId(tripId)
  return <div className="pb-10">
    <PageHeader title="Travelers" back={`/t/${tripId}/overview`} />
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      {!trip || !members ? <ListSkeleton label="Loading travelers…" /> : <PeopleCard trip={trip} members={members} me={me} />}
    </div>
  </div>
}
