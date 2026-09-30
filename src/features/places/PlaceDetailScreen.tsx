import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ExternalLink, Globe, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import { useMyMemberId } from '@/data/device'
import { useLegContext, useLinks, useMembers, usePlace, usePlaces } from '@/data/hooks'
import { save, softDelete } from '@/data/repo'
import { LINK_KINDS, type Link as TripLink, type LinkKind } from '@/data/types'
import { googleMapsUrl, tripadvisorUrl } from '@/lib/geo'
import { newId } from '@/lib/ids'
import { Button, Card, ErrorNote, Input, PageHeader, Select } from '@/ui'
import { CATEGORY_STYLE, STATUS_LABEL } from './categories'
import { TravelTimesCard } from '@/features/routing/TravelTimesCard'

export function PlaceDetailScreen() {
  const { tripId, placeId } = useParams() as { tripId: string; placeId: string }
  const navigate = useNavigate()
  const me = useMyMemberId(tripId)
  const place = usePlace(placeId)
  const links = useLinks(placeId) ?? []
  const members = useMembers(tripId) ?? []
  const allPlaces = usePlaces(tripId)
  const legCtx = useLegContext(tripId)

  if (!place) return <PageHeader title="Place" back={`/t/${tripId}/more/places`} />
  if (place.deleted_at) {
    return (
      <div>
        <PageHeader title="Deleted" back={`/t/${tripId}/more/places`} />
        <p className="p-5 text-stone-500">This place was deleted.</p>
      </div>
    )
  }

  const { Icon, color, label } = CATEGORY_STYLE[place.category]
  const at = place.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : null
  const editedBy = members.find((m) => m.id === place.updated_by)?.display_name

  return (
    <div className="min-h-full pb-8">
      <PageHeader
        title={place.name}
        back={`/t/${tripId}/more/places`}
        action={
          <Link to="edit" className="flex size-10 items-center justify-center rounded-full text-brand-700 active:bg-brand-50" aria-label="Edit">
            <Pencil className="size-5" />
          </Link>
        }
      />
      <div className="mx-auto max-w-md space-y-4 p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full text-white" style={{ background: color }}>
            <Icon className="size-6" />
          </span>
          <div>
            <div className="font-medium">{label}{place.area && ` · ${place.area}`}</div>
            <div className="text-sm text-stone-500">{STATUS_LABEL[place.status]}</div>
          </div>
        </div>

        {place.notes && <Card><p className="whitespace-pre-wrap">{place.notes}</p></Card>}

        <Card className="space-y-1">
          <h2 className="mb-2 font-semibold">Reviews &amp; directions</h2>
          <ExtLink href={googleMapsUrl(place.name, place.area, at)} label="Open in Google Maps" />
          <ExtLink href={tripadvisorUrl(place.name, place.area)} label="Search on TripAdvisor" />
          {place.website && <ExtLink href={place.website} label="Website" Icon={Globe} />}
          {place.phone && <ExtLink href={`tel:${place.phone}`} label={place.phone} Icon={Phone} />}
          {!at && <p className="pt-1 text-sm text-amber-700">No map pin yet. Edit to add a location.</p>}
        </Card>

        {at && allPlaces && legCtx && <TravelTimesCard place={place} places={allPlaces} ctx={legCtx} />}

        <Card>
          <h2 className="mb-2 font-semibold">Links</h2>
          {links.length === 0 && <p className="text-sm text-stone-500">Booking pages, menus, blog posts…</p>}
          <ul className="space-y-1">
            {links.map((l) => (
              <li key={l.id} className="flex items-center gap-2">
                <a href={l.url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-2 text-brand-700 active:bg-brand-50">
                  <ExternalLink className="size-4 shrink-0" />
                  <span className="truncate">{l.label || l.url}</span>
                  <span className="shrink-0 rounded bg-stone-100 px-1.5 text-xs text-stone-600">{l.kind}</span>
                </a>
                <button onClick={() => softDelete('links', l.id, me)} className="p-2 text-stone-400" aria-label="Remove link">
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          <AddLink tripId={tripId} placeId={placeId} me={me} />
        </Card>

        <p className="text-center text-xs text-stone-400">
          {editedBy ? `Last edited by ${editedBy}` : null}
          {place.source === 'osm' && ' · Place data © OpenStreetMap contributors'}
        </p>

        <Button
          variant="danger"
          className="flex w-full items-center justify-center gap-2"
          onClick={async () => {
            if (!confirm(`Delete "${place.name}" for everyone?`)) return
            await softDelete('places', place.id, me)
            navigate(`/t/${tripId}/more/places`, { replace: true })
          }}
        >
          <Trash2 className="size-4" /> Delete place
        </Button>
      </div>
    </div>
  )
}

function ExtLink({ href, label, Icon = ExternalLink }: { href: string; label: string; Icon?: typeof ExternalLink }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg py-2 text-brand-700 active:bg-brand-50">
      <Icon className="size-4" /> {label}
    </a>
  )
}

function AddLink({ tripId, placeId, me }: { tripId: string; placeId: string; me: string | null }) {
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<LinkKind>('info')
  const [error, setError] = useState<string | null>(null)

  async function add(e: FormEvent) {
    e.preventDefault()
    const u = url.trim()
    if (!/^https?:\/\//i.test(u)) return setError('Links must start with http:// or https://')
    const link: TripLink = { id: newId(), trip_id: tripId, place_id: placeId, item_id: null, expense_id: null, url: u, label: label.trim() || null, kind }
    await save('links', link, me)
    setUrl('')
    setLabel('')
    setError(null)
  }

  return (
    <form onSubmit={add} className="mt-3 space-y-2 border-t border-stone-100 pt-3">
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" type="url" />
      <div className="flex gap-2">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" className="min-w-0 flex-1" />
        <Select value={kind} onChange={(e) => setKind(e.target.value as LinkKind)} className="w-28">
          {LINK_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </Select>
      </div>
      <ErrorNote error={error} />
      <Button type="submit" variant="secondary" disabled={!url.trim()} className="flex w-full items-center justify-center gap-1">
        <Plus className="size-4" /> Add link
      </Button>
    </form>
  )
}
