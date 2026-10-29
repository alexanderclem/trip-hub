import { TravelerLink } from '@/features/trips/TravelerLink'
import { useConfirm } from '@/ui/ConfirmProvider'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { DateTime } from 'luxon'
import { CalendarPlus, Check, Copy, FileText, MapPin, Pencil, Plus, Receipt, Trash2, Users } from 'lucide-react'
import { useAttachments } from '@/features/tickets/files'
import { useMyMemberId } from '@/data/device'
import { useLegContext, useMembers, usePlaces, useTrip } from '@/data/hooks'
import type { Place } from '@/data/types'
import { formatMoney } from '@/lib/money'
import { formatInZone } from '@/lib/time'
import { Button, Card, LinkButton, PageHeader, SectionTitle, Status } from '@/ui'
import { PlaceCategoryIcon } from '@/features/places/PlaceSummary'
import { travelOptions } from '@/features/routing/legs'
import { TravelOptionsList } from '@/features/routing/TravelOptionsList'
import { planIcs, shareCalendar } from './calendar'
import { CommentThread } from '@/features/comments/CommentThread'
import { deleteItem, useDisplayZone, useItem, useItems } from './data'
import { KIND_STYLE, STATUS_TEXT } from './kinds'
import { onDay } from './layout'

const city = (zone: string) => zone.split('/').pop()!.replace(/_/g, ' ')

export function ItemDetailScreen() {
  const confirm = useConfirm()
  const { tripId, itemId } = useParams() as { tripId: string; itemId: string }
  const navigate = useNavigate()
  const me = useMyMemberId(tripId)
  const trip = useTrip(tripId)
  const item = useItem(itemId)
  const items = useItems(tripId) ?? []
  const places = usePlaces(tripId) ?? []
  const members = useMembers(tripId) ?? []
  const legCtx = useLegContext(tripId)
  const { zone, tripZone } = useDisplayZone(trip)
  const [copied, setCopied] = useState(false)
  const tickets = (useAttachments(tripId) ?? []).filter((t) => t.att.item_id === itemId)

  if (!item || item.deleted_at) {
    return (
      <div>
        <PageHeader title="Plan" back={`/t/${tripId}/plan`} />
        {item?.deleted_at && <p className="p-5 text-muted">This was removed from the plan.</p>}
      </div>
    )
  }

  const k = KIND_STYLE[item.kind]
  const placeOf = (id: string | null) => (id ? places.find((p) => p.id === id) : undefined)
  const place = placeOf(item.place_id)
  const to = placeOf(item.to_place_id)
  const day = item.all_day ? item.start_local.slice(0, 10) : DateTime.fromISO(item.start_at).setZone(zone).toISODate()!

  // Local time at each end, in that end's own zone ("07:10 Guatemala → 12:05 Chicago").
  const startLocal = DateTime.fromISO(item.start_at).setZone(item.start_tz)
  const endLocal = item.end_at ? DateTime.fromISO(item.end_at).setZone(item.end_tz ?? item.start_tz) : null
  const crossesZones = !!item.end_tz && item.end_tz !== item.start_tz
  const notDisplayZone = item.start_tz !== zone || (item.end_tz ?? item.start_tz) !== zone

  // Travel from the previous stop that day.
  const prev = items
    .filter((i) => i.id !== item.id && !i.all_day && i.kind !== 'lodging' && i.status !== 'cancelled' && onDay(i, day, zone) && i.start_at < item.start_at && (i.to_place_id ?? i.place_id))
    .at(-1)
  const prevPlace = prev && placeOf(prev.to_place_id ?? prev.place_id)
  const options = prevPlace && place && legCtx && prevPlace.id !== place.id ? travelOptions(prevPlace, place, legCtx) : []
  const going = item.attendee_ids ? members.filter((m) => item.attendee_ids!.includes(m.id)) : null

  return (
    <div className="min-h-full pb-10">
      <PageHeader
        title={item.title}
        back={`/t/${tripId}/plan?day=${day}`}
        action={<Link to="edit" aria-label="Edit" className="ui-icon-button text-action"><Pencil aria-hidden="true" className="size-5" /></Link>}
      />
      <div className="mx-auto max-w-md space-y-4 p-4">
        <div className="flex items-start gap-3">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-control ${k.bg} ${k.text}`}><k.Icon aria-hidden="true" className="size-5" /></span>
          <div className="min-w-0">
            <p className="ui-eyebrow">{k.label}</p>
            <p className="mt-0.5"><Status tone={item.status === 'confirmed' ? undefined : item.status === 'cancelled' ? 'danger' : 'quiet'}>{STATUS_TEXT[item.status]}</Status></p>
          </div>
        </div>

        <Card framed>
          <p className="ui-eyebrow">{DateTime.fromISO(day).toFormat('cccc, d LLLL yyyy')}</p>
          {item.all_day ? (
            <p className="mt-1 text-muted">All day{item.end_local && item.end_local.slice(0, 10) !== item.start_local.slice(0, 10) ? ` until ${DateTime.fromISO(item.end_local.slice(0, 10)).toFormat('cccc d LLLL')}` : ''}</p>
          ) : (
            <>
              <p className="ui-display mt-1 text-[2.25rem] tabular-nums">
                {startLocal.toFormat('HH:mm')}
                {endLocal && <> → {endLocal.toFormat(endLocal.toISODate() !== startLocal.toISODate() ? 'ccc HH:mm' : 'HH:mm')}</>}
              </p>
              <p className="text-sm text-muted">
                {crossesZones ? `${city(item.start_tz)} time → ${city(item.end_tz!)} time` : `${city(item.start_tz)} time`}
              </p>
              {notDisplayZone && (
                <p className="mt-2 text-sm text-muted">
                  {zone === tripZone ? `${city(zone)} time` : 'Your phone'}: {formatInZone(item.start_at, zone)}{item.end_at && `–${formatInZone(item.end_at, zone)}`}
                </p>
              )}
            </>
          )}
        </Card>

        {item.confirmation_code && (
          <Card>
            <p className="ui-label">Confirmation</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="font-mono text-3xl font-semibold tracking-wider break-all select-all">{item.confirmation_code}</p>
              <button
                onClick={async () => { await navigator.clipboard.writeText(item.confirmation_code!); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                aria-label="Copy confirmation code"
                className="ui-icon-button shrink-0 border border-line"
              >
                {copied ? <Check aria-hidden="true" className="size-5 text-action" /> : <Copy aria-hidden="true" className="size-5" />}
              </button>
            </div>
          </Card>
        )}

        {(place || to) && (
          <Card className="space-y-2">
            {[place, to].filter((p): p is Place => !!p).map((p, i) => (
              <Link key={p.id} to={`/t/${tripId}/more/places/${p.id}`} className="flex items-center gap-3 rounded-control p-1 hover:bg-brand-50">
                <PlaceCategoryIcon category={p.category} />
                <div className="min-w-0 flex-1">
                  {to && <p className="text-xs text-muted">{i === 0 ? 'From' : 'To'}</p>}
                  <p className="truncate font-medium">{p.name}</p>
                  {p.area && <p className="text-xs text-muted">{p.area}</p>}
                </div>
                <MapPin aria-hidden="true" className="size-4 text-muted" />
              </Link>
            ))}
          </Card>
        )}

        {prev && prevPlace && options.length > 0 && (
          <Card>
            <h3 className="text-sm font-semibold">Getting here from {prev.title}</h3>
            <p className="mb-2 text-xs text-muted">Previous stop, ends {prev.end_at ? formatInZone(prev.end_at, zone) : formatInZone(prev.start_at, zone)}</p>
            <TravelOptionsList options={options} />
          </Card>
        )}

        <Card>
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium"><Users aria-hidden="true" className="size-4 text-muted" />{!going && <span>Everyone</span>}{(going ?? members).map((m) => <TravelerLink key={m.id} member={m} />)}{going?.length === 0 && <span>Nobody yet</span>}</div>
          {item.est_cost_minor != null && item.est_cost_currency && <p className="mt-2 text-sm text-muted">Estimated cost: {formatMoney(item.est_cost_minor, item.est_cost_currency)}</p>}
          {item.notes && <p className="mt-2 text-sm whitespace-pre-wrap text-ink">{item.notes}</p>}
        </Card>

        <Card>
          <SectionTitle className="mb-1">Tickets</SectionTitle>
          {tickets.length > 0 && (
            <ul className="mb-2 space-y-1">
              {tickets.map(({ att, onPhone }) => (
                <li key={att.id}>
                  <Link to={`/t/${tripId}/tickets/${att.id}`} className="flex min-h-11 items-center gap-2 rounded-control px-1 text-sm hover:bg-brand-50">
                    <FileText aria-hidden="true" className="size-4 text-action" />
                    <span className="min-w-0 flex-1 truncate font-medium">{att.title}</span>
                    <span className="text-xs text-muted">{onPhone ? 'on this phone' : 'not downloaded'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link to={`/t/${tripId}/tickets/new?item=${item.id}`} className="ui-link">
            <Plus aria-hidden="true" className="size-4" /> Add a ticket or confirmation
          </Link>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <LinkButton variant="secondary" to={`/t/${tripId}/money/new?item=${item.id}`}>
            <Receipt aria-hidden="true" className="size-4" /> Log what it cost
          </LinkButton>
          <Button variant="secondary" onClick={() => void shareCalendar(item.title, planIcs([item], places, members, item.title, location.origin))}>
            <CalendarPlus aria-hidden="true" className="size-4" /> Add to calendar
          </Button>
        </div>

        <CommentThread tripId={tripId} type="item" subjectId={item.id} me={me} />

        <Button
          variant="danger"
          className="mx-auto flex"
          onClick={async () => {
            if (!await confirm(`Remove "${item.title}" from the plan for everyone?`)) return
            await deleteItem(item.id, me)
            navigate(`/t/${tripId}/plan?day=${day}`, { replace: true })
          }}
        >
          <Trash2 aria-hidden="true" className="size-4" /> Remove from plan
        </Button>
      </div>
    </div>
  )
}
