import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BedDouble, Building2, Car, HeartPulse, Hospital, MapPin, Pencil, Phone, ShieldPlus, X } from 'lucide-react'
import { useMyMemberId } from '@/data/device'
import { useMembers, usePlaces, useTrip } from '@/data/hooks'
import type { Member, MemberSafety } from '@/data/types'
import { useItems } from '@/features/itinerary/data'
import { googleMapsUrl } from '@/lib/geo'
import { Card, PageHeader } from '@/ui'
import { stayFor, tripEmergency, useSafety, type Contact } from './data'

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

function CallButton({ label, phone }: { label: string; phone: string }) {
  return (
    <a href={tel(phone)} className="flex min-h-14 items-center gap-3 rounded-2xl bg-red-700 px-4 py-2 text-white hover:bg-red-800">
      <Phone aria-hidden="true" className="size-5 shrink-0" />
      <span className="min-w-0 flex-1"><span className="block font-semibold">{label}</span><span className="block text-sm tabular-nums text-red-100">{phone}</span></span>
    </a>
  )
}

function ContactCard({ icon: Icon, title, c }: { icon: typeof Hospital; title: string; c: Contact }) {
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-sm font-medium text-stone-600"><Icon aria-hidden="true" className="size-4" />{title}</h2>
      <p className="mt-1 font-semibold">{c.name}</p>
      {c.address && <p className="text-sm text-stone-600">{c.address}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {c.phone && <a href={tel(c.phone)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 px-3 text-sm font-medium text-brand-700"><Phone aria-hidden="true" className="size-4" />{c.phone}</a>}
        <a href={googleMapsUrl([c.name, c.address].filter(Boolean).join(', '), null)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 px-3 text-sm font-medium text-brand-700">
          <MapPin aria-hidden="true" className="size-4" />Map<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
    </Card>
  )
}

const LINES: [keyof MemberSafety, string][] = [
  ['allergies', 'Allergies'], ['medical', 'Medical'], ['blood_type', 'Blood type'], ['notes', 'Notes'],
]

function PersonCard({ member, safety, mine }: { member: Member; safety?: MemberSafety; mine: boolean }) {
  const s = safety
  const empty = !s || ![s.emergency_name, s.emergency_phone, s.allergies, s.medical, s.blood_type, s.insurance_provider, s.notes].some(Boolean)
  return (
    <li className="rounded-2xl border border-stone-200 bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{member.display_name}{mine ? ' (you)' : ''}</h3>
        {mine && <Link to="edit" className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-medium text-brand-700 hover:bg-brand-50"><Pencil aria-hidden="true" className="size-4" />{empty ? 'Fill in' : 'Edit'}</Link>}
      </div>
      {empty ? (
        <p className="mt-1 text-sm text-stone-600">{mine ? 'Add who to call and anything a doctor should know.' : 'Hasn’t filled in their card yet.'}</p>
      ) : (
        <dl className="mt-2 space-y-1 text-sm">
          {s!.emergency_name && (
            <div><dt className="inline font-medium text-stone-700">Call: </dt><dd className="inline">{s!.emergency_name}{s!.emergency_relation ? ` (${s!.emergency_relation})` : ''}{s!.emergency_phone && <> · <a href={tel(s!.emergency_phone)} className="font-medium text-brand-700 underline">{s!.emergency_phone}</a></>}</dd></div>
          )}
          {LINES.map(([k, label]) => s![k] ? <div key={k}><dt className="inline font-medium text-stone-700">{label}: </dt><dd className="inline whitespace-pre-line">{String(s![k])}</dd></div> : null)}
          {s!.insurance_provider && (
            <div><dt className="inline font-medium text-stone-700">Insurance: </dt><dd className="inline">{s!.insurance_provider}{s!.insurance_policy ? ` · policy ${s!.insurance_policy}` : ''}{s!.insurance_phone && <> · <a href={tel(s!.insurance_phone)} className="font-medium text-brand-700 underline">{s!.insurance_phone}</a></>}</dd></div>
          )}
        </dl>
      )}
    </li>
  )
}

export function EmergencyScreen() {
  const { tripId } = useParams() as { tripId: string }
  const trip = useTrip(tripId)
  const me = useMyMemberId(tripId)
  const members = useMembers(tripId) ?? []
  const safety = useSafety(tripId) ?? []
  const info = tripEmergency(trip)
  const ordered = [...members].sort((a, b) => Number(b.id === me) - Number(a.id === me) || a.display_name.localeCompare(b.display_name))

  return (
    <div className="min-h-full pb-24">
      <PageHeader title="Emergency" back={`/t/${tripId}/more`} />
      <div className="mx-auto max-w-md space-y-4 p-4">
        <section aria-labelledby="call-help" className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 id="call-help" className="font-semibold">Call for help</h2>
            <Link to="numbers" className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-medium text-brand-700 hover:bg-brand-50"><Pencil aria-hidden="true" className="size-4" />Edit</Link>
          </div>
          {info.numbers.length ? info.numbers.map((n) => <CallButton key={`${n.label}${n.phone}`} {...n} />) : (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">No local emergency numbers yet. <Link to="numbers" className="font-medium underline">Add police, ambulance and tourist assistance</Link> while you have signal to look them up.</p>
          )}
        </section>

        <div className="grid grid-cols-2 gap-2">
          <Link to="driver" className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border border-stone-200 bg-surface p-3 text-center font-medium hover:bg-stone-50"><Car aria-hidden="true" className="size-6 text-brand-700" />Show the driver</Link>
          <Link to="me" className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border border-stone-200 bg-surface p-3 text-center font-medium hover:bg-stone-50"><HeartPulse aria-hidden="true" className="size-6 text-red-700" />My medical card</Link>
        </div>

        {info.hospital && <ContactCard icon={Hospital} title="Hospital" c={info.hospital} />}
        {info.embassy && <ContactCard icon={Building2} title="Embassy" c={info.embassy} />}

        <section aria-labelledby="people">
          <h2 id="people" className="flex items-center gap-2 font-semibold"><ShieldPlus aria-hidden="true" className="size-5 text-brand-700" />Everyone’s emergency card</h2>
          <p className="mb-2 mt-1 text-xs text-stone-600">Visible to everyone on this trip, and saved on every phone so it works without signal. Only you can change your own card.</p>
          <ul className="space-y-2">{ordered.map((m) => <PersonCard key={m.id} member={m} mine={m.id === me} safety={safety.find((s) => s.member_id === m.id)} />)}</ul>
        </section>
      </div>
    </div>
  )
}

/** Full screen, big type: where we're staying, to show a taxi or tuk-tuk driver. */
export function DriverScreen() {
  const { tripId } = useParams() as { tripId: string }
  const navigate = useNavigate()
  const trip = useTrip(tripId)
  const items = useItems(tripId)
  const places = usePlaces(tripId) ?? []
  const [now] = useState(() => Date.now())
  const stay = trip && items ? stayFor(items, places, trip.timezone, now) : null
  const name = stay?.place?.name ?? stay?.item.title
  const at = stay?.place?.lat != null && stay.place.lng != null ? { lat: stay.place.lat, lng: stay.place.lng } : null
  return (
    <div role="dialog" aria-modal="true" aria-label="Show the driver" className="fixed inset-0 z-50 flex flex-col bg-white p-6 pt-safe">
      <button onClick={() => navigate(-1)} aria-label="Close" className="ml-auto flex size-11 items-center justify-center rounded-full bg-stone-100"><X aria-hidden="true" className="size-6" /></button>
      {!items ? null : !stay ? (
        <p className="m-auto text-center text-lg text-stone-600">No stay in the plan yet. Add your lodging on the Plan tab.</p>
      ) : (
        <div className="m-auto w-full max-w-lg text-center">
          <BedDouble aria-hidden="true" className="mx-auto size-10 text-brand-700" />
          <p className="ui-label mt-2">{stay.tonight ? 'Staying tonight' : 'Next stay'}</p>
          <p className="mt-3 break-words text-4xl font-bold leading-tight">{name}</p>
          {stay.place?.address && <p className="mt-4 break-words text-2xl leading-snug text-stone-800">{stay.place.address}</p>}
          {stay.place?.area && <p className="mt-2 text-xl text-stone-600">{stay.place.area}</p>}
          {!stay.place?.address && at && <p className="mt-4 text-lg tabular-nums text-stone-600">{at.lat.toFixed(5)}, {at.lng.toFixed(5)}</p>}
          <a href={googleMapsUrl(name ?? '', stay.place?.area ?? null, at)} target="_blank" rel="noreferrer" className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 px-4 font-medium text-brand-700">
            <MapPin aria-hidden="true" className="size-5" />Open in maps<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      )}
    </div>
  )
}

/** Full screen, my own card, for a doctor or first responder. */
export function MedicalScreen() {
  const { tripId } = useParams() as { tripId: string }
  const navigate = useNavigate()
  const me = useMyMemberId(tripId)
  const members = useMembers(tripId) ?? []
  const s = useSafety(tripId)?.find((r) => r.member_id === me)
  const name = members.find((m) => m.id === me)?.display_name
  const rows: [string, string | null | undefined][] = [
    ['Allergies', s?.allergies], ['Medical conditions and medication', s?.medical], ['Blood type', s?.blood_type],
    ['Emergency contact', s?.emergency_name ? `${s.emergency_name}${s.emergency_relation ? ` (${s.emergency_relation})` : ''}${s.emergency_phone ? ` · ${s.emergency_phone}` : ''}` : null],
    ['Travel insurance', s?.insurance_provider ? `${s.insurance_provider}${s.insurance_policy ? ` · policy ${s.insurance_policy}` : ''}${s.insurance_phone ? ` · ${s.insurance_phone}` : ''}` : null],
    ['Notes', s?.notes],
  ]
  return (
    <div role="dialog" aria-modal="true" aria-label="My medical card" className="fixed inset-0 z-50 overflow-y-auto bg-white p-6 pt-safe">
      <button onClick={() => navigate(-1)} aria-label="Close" className="ml-auto flex size-11 items-center justify-center rounded-full bg-stone-100"><X aria-hidden="true" className="size-6" /></button>
      <div className="mx-auto max-w-lg">
        <p className="flex items-center gap-2 text-sm font-semibold text-red-700"><HeartPulse aria-hidden="true" className="size-5" />Medical information</p>
        <p className="mt-1 text-3xl font-bold">{name ?? 'Choose who you are first'}</p>
        <dl className="mt-6 space-y-5">
          {rows.map(([label, v]) => (
            <div key={label}><dt className="text-sm font-medium text-stone-600">{label}</dt><dd className="whitespace-pre-line break-words text-2xl">{v || '—'}</dd></div>
          ))}
        </dl>
        {s?.emergency_phone && <a href={tel(s.emergency_phone)} className="mt-8 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-red-700 font-semibold text-white"><Phone aria-hidden="true" className="size-5" />Call {s.emergency_name ?? 'emergency contact'}</a>}
      </div>
    </div>
  )
}
