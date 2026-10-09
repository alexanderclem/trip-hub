import { Link, useParams } from 'react-router'
import { Backpack, ClipboardCheck, Compass, MapPin, Settings, ShieldPlus, Sparkles, Ticket, Wallet } from 'lucide-react'
import { useTrip } from '@/data/hooks'
import { PageHeader, Row, RowGroup } from '@/ui'
import { isRecapTime } from '@/features/wrapped/stats'

/** Everything that isn't a tab, grouped by when it's needed. Home, Plan, Map and Vote are tabs, so they aren't repeated here. */
export function MoreScreen() {
  const { tripId } = useParams() as { tripId: string }
  const trip = useTrip(tripId)
  const root = `/t/${tripId}`
  const icon = (Icon: typeof Ticket) => <Icon aria-hidden="true" className="size-5" />
  return (
    <div className="pb-10">
      <PageHeader title="More" />
      <div className="mx-auto max-w-md space-y-6 p-4">
        <RowGroup label="On the trip">
          <Row to={`${root}/tickets`} icon={icon(Ticket)} title="Tickets" />
          <Row to={`${root}/money`} icon={icon(Wallet)} title="Shared expenses" />
          <Row to="places" icon={icon(MapPin)} title="Places" />
          <Row to="emergency" icon={icon(ShieldPlus)} title="Emergency info" />
        </RowGroup>
        <RowGroup label="Getting ready">
          <Row to="tasks" icon={icon(ClipboardCheck)} title="Tasks" />
          <Row to="packing" icon={icon(Backpack)} title="Packing list" />
          <Row to="ideas" icon={icon(Compass)} title="Trip ideas & travel preferences" />
        </RowGroup>
        <RowGroup label="This trip">
          <Row to="settings" icon={icon(Settings)} title="Trip settings & sharing" />
          <Row to={`${root}/wrapped`} icon={icon(Sparkles)} title="Trip recap" trailing={trip && isRecapTime(trip, Date.now()) ? 'Ready' : 'Preview'} />
        </RowGroup>
        <p className="text-center"><Link to="/app" className="ui-link lg:hidden">All trips</Link></p>
      </div>
    </div>
  )
}
