import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { MapPinned } from 'lucide-react'
import { useMyMemberId } from '@/data/device'
import { usePlace } from '@/data/hooks'
import { save } from '@/data/repo'
import { PLACE_CATEGORIES, PLACE_STATUSES, type Place } from '@/data/types'
import { parseCoordinates } from '@/lib/geo'
import { newId } from '@/lib/ids'
import { Button, ErrorNote, Field, Input, PageHeader, Select, Textarea } from '@/ui'
import { CATEGORY_STYLE, STATUS_LABEL } from './categories'

const blank = (tripId: string): Place => ({
  id: newId(),
  trip_id: tripId,
  name: '',
  category: 'food',
  tags: [],
  lat: null,
  lng: null,
  address: null,
  area: null,
  status: 'shortlist',
  notes: null,
  phone: null,
  website: null,
  opening_hours: null,
  external_ids: {},
  source: 'manual',
})

export function PlaceFormScreen() {
  const { tripId, placeId } = useParams() as { tripId: string; placeId?: string }
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const me = useMyMemberId(tripId)
  // Arriving from a long-press on the map: prefill the spot and go back to the map after.
  const fromMap = search.has('lat') && search.has('lng')
  const existing = usePlace(placeId)
  const [p, setP] = useState<Place>(() => blank(tripId))
  const [coordsText, setCoordsText] = useState(() => (fromMap ? `${search.get('lat')}, ${search.get('lng')}` : ''))
  const [error, setError] = useState<string | null>(null)

  // Fill the form once. Sync keeps refreshing `existing` in the background; re-applying it would
  // silently undo what the person is editing.
  const loaded = useRef(false)
  useEffect(() => {
    if (existing && !loaded.current) {
      loaded.current = true
      setP(existing)
      if (existing.lat != null && existing.lng != null) setCoordsText(`${existing.lat}, ${existing.lng}`)
    }
  }, [existing])

  const update = <K extends keyof Place>(k: K, v: Place[K]) => setP((cur) => ({ ...cur, [k]: v }))
  const text = (k: 'name' | 'area' | 'notes' | 'phone' | 'website' | 'address') => ({
    value: p[k] ?? '',
    onChange: (e: { target: { value: string } }) => update(k, e.target.value || (k === 'name' ? '' : null)),
  })
  const parsed = coordsText.trim() ? parseCoordinates(coordsText) : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (coordsText.trim() && !parsed) return setError("Couldn't find coordinates in that location text.")
    if (p.website && !/^https?:\/\//i.test(p.website)) return setError('Website must start with http:// or https://')
    const row: Place = {
      ...p,
      name: p.name.trim(),
      lat: parsed?.lat ?? null,
      lng: parsed?.lng ?? null,
    }
    await save('places', row, me)
    navigate(fromMap ? `/t/${tripId}/map?place=${row.id}` : `/t/${tripId}/more/places/${row.id}`, { replace: true })
  }

  return (
    <div className="min-h-full">
      <PageHeader title={placeId ? 'Edit place' : 'Add place'} back={placeId ? `/t/${tripId}/more/places/${placeId}` : fromMap ? `/t/${tripId}/map` : `/t/${tripId}/more/places`} />
      <form onSubmit={submit} className="mx-auto max-w-md space-y-4 p-5">
        <Field label="Name">
          <Input required maxLength={200} {...text('name')} placeholder="Café Sky" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={p.category} onChange={(e) => update('category', e.target.value as Place['category'])}>
              {PLACE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_STYLE[c].label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={p.status} onChange={(e) => update('status', e.target.value as Place['status'])}>
              {PLACE_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Area" hint="Town or neighbourhood, e.g. Antigua, Panajachel, San Pedro">
          <Input {...text('area')} maxLength={80} />
        </Field>
        <Field
          label="Location"
          hint={
            parsed
              ? `📍 ${parsed.lat.toFixed(5)}, ${parsed.lng.toFixed(5)}`
              : 'Paste the full Google Maps address-bar link (short maps.app.goo.gl links have no coordinates), an Apple/OSM link, or "lat, lng".'
          }
        >
          <div className="relative">
            <MapPinned className="absolute top-3 left-3 size-5 text-stone-400" />
            <Input value={coordsText} onChange={(e) => setCoordsText(e.target.value)} className="pl-10" placeholder="https://www.google.com/maps/place/… or 14.5586, -90.7295" />
          </div>
        </Field>
        <Field label="Notes">
          <Textarea {...text('notes')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <Input type="tel" {...text('phone')} />
          </Field>
          <Field label="Website">
            <Input type="url" {...text('website')} placeholder="https://" />
          </Field>
        </div>
        <ErrorNote error={error} />
        <Button type="submit" className="w-full" disabled={!p.name.trim()}>
          Save
        </Button>
      </form>
    </div>
  )
}
