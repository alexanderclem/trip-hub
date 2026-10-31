import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { useTrip } from '@/data/hooks'
import { useMyMemberId } from '@/data/device'
import { save } from '@/data/repo'
import { db } from '@/data/db'
import { stableId } from '@/lib/ids'
import { Button, Card, Field, Input, Select, PageHeader } from '@/ui'
import { createPoll, addOption } from '@/features/polls/data'
import { useTravel } from './client'
import { LookupStatus } from './LookupStatus'
import { countries } from './countries'
import { countrySchema, holidaySchema, eventSchema, type TravelEvent } from './model'

const holidaysSchema = z.array(holidaySchema)
const eventsSchema = z.array(eventSchema)

export function TravelScreen() {
  const { tripId } = useParams() as { tripId: string }
  const trip = useTrip(tripId)
  const me = useMyMemberId(tripId)
  const navigate = useNavigate()
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [selection, setSelection] = useState<{ country: string; city: string; start: string; end: string } | null>(null)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [chosen, setChosen] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const initialized = useRef(false)
  useEffect(() => {
    if (!trip || initialized.current) return
    initialized.current = true
    const c = typeof trip.settings.destination_country === 'string' ? trip.settings.destination_country : ''
    const cityName = typeof trip.settings.destination_city === 'string' ? trip.settings.destination_city : ''
    setCountry(c); setCity(cityName)
    if (c && cityName && trip.start_date && trip.end_date) setSelection({ country: c, city: cityName, start: trip.start_date, end: trip.end_date })
  }, [trip])
  const countryInfo = useTravel(selection ? { action: 'country', tripId, country: selection.country } : null, countrySchema, 30 * 86400000)
  const firstYear = selection ? Number(selection.start.slice(0, 4)) : 2026
  const lastYear = selection ? Number(selection.end.slice(0, 4)) : firstYear
  const holidays = useTravel(selection ? { action: 'holidays', tripId, country: selection.country, year: firstYear } : null, holidaysSchema)
  const nextHolidays = useTravel(selection && lastYear !== firstYear ? { action: 'holidays', tripId, country: selection.country, year: lastYear } : null, holidaysSchema)
  const events = useTravel(selection ? { action: 'events', tripId, ...selection } : null, eventsSchema, 3600000)
  async function voteOnEvents() {
    setBusy(true); setMessage('')
    try {
      const selected = events.data?.filter((e) => chosen.includes(e.id)) ?? []
      if (selected.length < 2) throw new Error('Choose at least two events to compare.')
      const id = await db.transaction('rw', [db.polls, db.poll_options, db.places, db._outbox], async () => {
        const id = await createPoll(tripId, `What should we do in ${selection!.city}?`, 'Events found on Ticketmaster. Check dates and availability before booking.', me)
        const poll = await db.polls.get(id)
        if (!poll) throw new Error('Could not open the vote.')
        for (const e of selected) {
          const placeId = await importEvent(e)
          await addOption(poll, { label: e.name, placeId, url: e.url, description: `${e.date} ${e.time ?? 'Time TBA'} · ${e.venue}` }, me)
        }
        return id
      })
      navigate(`/t/${tripId}/more/vote/${id}`)
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save the vote.') } finally { setBusy(false) }
  }
  async function importEvent(e: TravelEvent) {
    const id = stableId(tripId, 'ticketmaster', e.id)
    const existing = await db.places.get(id)
    if (existing?.deleted_at) throw new Error('This event was removed from your places. Add it manually to restore it.')
    if (!existing) await save('places', { id, trip_id: tripId, name: e.name, category: 'activity', tags: ['event'], lat: null, lng: null, address: e.venue || null, area: selection!.city, status: 'shortlist', notes: `${e.date} ${e.time ?? 'Time TBA'}${e.zone ? ` (${e.zone})` : ''}`, phone: null, website: e.url, opening_hours: null, external_ids: { ticketmaster: e.id, event_date: e.date, event_time: e.time ?? '', event_zone: e.zone ?? '' }, source: 'import' }, me)
    return id
  }
  async function saveEvent(e: TravelEvent) {
    setBusy(true); setMessage('')
    try {
      const id = await importEvent(e)
      const params = new URLSearchParams({ place: id, day: e.date, ...(e.time ? { time: e.time } : {}), ...(e.zone ? { zone: e.zone } : {}) })
      navigate(`/t/${tripId}/plan/new?${params}`)
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save event.') } finally { setBusy(false) }
  }
  async function useCurrency(currency: string) {
    setBusy(true); setMessage('')
    try {
      const current = await db.trips.get(tripId)
      if (!current) throw new Error('Trip unavailable')
      await save('trips', { ...current, local_currency: currency }, me)
      setMessage(`Trip local currency set to ${currency}.`)
    } catch { setMessage('Could not update the trip currency. Try again.') } finally { setBusy(false) }
  }
  return <div className="pb-10"><PageHeader title="Explore your destination" back={`/t/${tripId}/more`} />
    <div className="mx-auto max-w-2xl space-y-5 p-4">
      <p className="text-muted">Find events for your group, check local holidays, and keep destination essentials on your phone.</p>
      <Card><form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault(); const a = start || trip?.start_date || ''; const b = end || trip?.end_date || a
        if (!a || !b || a > b || Number(b.slice(0, 4)) - Number(a.slice(0, 4)) > 1) { setMessage('Choose a date range spanning at most two calendar years.'); return }
        setMessage(''); setChosen([])
        const c = country.trim().toUpperCase()
        try {
          const current = await db.trips.get(tripId)
          if (!current) throw new Error('Trip unavailable')
          await save('trips', { ...current, settings: { ...current.settings, destination_country: c, destination_city: city.trim() } }, me)
          setSelection({ country: c, city: city.trim(), start: a, end: b })
        } catch { setMessage('Could not save the destination. Try again.') }
      }}>
        <Field label="Country"><Select required value={country} onChange={(e) => setCountry(e.target.value)}><option value="">Choose a country</option>{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</Select></Field>
        <Field label="City"><Input required maxLength={100} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Antigua" /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="From"><Input required type="date" value={start || trip?.start_date || ''} onChange={(e) => setStart(e.target.value)} /></Field><Field label="Until"><Input required type="date" min={start || trip?.start_date || undefined} value={end || trip?.end_date || start || trip?.start_date || ''} onChange={(e) => setEnd(e.target.value)} /></Field></div>
        <Button type="submit">Explore destination</Button>
      </form></Card>
      {message && <p role="alert" className="text-sm text-danger-ink">{message}</p>}
      {selection && <>
        <Card><h2 className="font-semibold">Destination essentials</h2><LookupStatus {...countryInfo} />{countryInfo.data && <dl className="mt-3 space-y-2"><div><dt className="ui-label">Country</dt><dd>{countryInfo.data.name}</dd></div><div><dt className="ui-label">Currencies</dt><dd>{countryInfo.data.currencies.join(', ') || 'Not supplied'}</dd></div><div><dt className="ui-label">Languages</dt><dd>{countryInfo.data.languages.join(', ') || 'Not supplied'}</dd></div><div><dt className="ui-label">Calling codes</dt><dd>{countryInfo.data.callingCodes.join(', ') || 'Not supplied'}</dd></div></dl>}{countryInfo.data?.currencies.filter((c) => c !== trip?.local_currency).map((c) => <Button key={c} variant="secondary" disabled={busy} className="mt-3" onClick={() => void useCurrency(c)}>Use {c} as trip local currency</Button>)}<p className="mt-3 text-xs text-muted">Source: REST Countries</p><Button variant="ghost" onClick={countryInfo.refresh} disabled={countryInfo.loading}>Refresh essentials</Button></Card>
        <Card><h2 className="font-semibold">Public holidays during your trip</h2><LookupStatus {...holidays} />{lastYear !== firstYear && <LookupStatus {...nextHolidays} />}
          {holidays.data && <ul className="mt-3 space-y-2">{[...holidays.data, ...(nextHolidays.data ?? [])].filter((h) => h.date >= selection.start && h.date <= selection.end).map((h) => <li key={`${h.date}:${h.name}`}><b>{h.date}</b> · {h.name}{h.regional && <span className="text-muted"> · Regional ({h.regions.join(', ')})</span>} <Link className="ui-link" to={`/t/${tripId}/plan?day=${h.date}`}>View day</Link></li>)}</ul>}
          {holidays.data && ![...holidays.data, ...(nextHolidays.data ?? [])].some((h) => h.date >= selection.start && h.date <= selection.end) && <p className="mt-2 text-sm">No public holidays returned for these dates{nextHolidays.error ? ' in the loaded year' : ''}.</p>}
          <p className="mt-3 text-xs text-muted">Source: Nager.Holidays. Regional holidays may not apply to your stop. Check business opening hours.</p><Button variant="ghost" disabled={holidays.loading || nextHolidays.loading} onClick={() => { holidays.refresh(); nextHolidays.refresh() }}>Refresh holidays</Button></Card>
        <section className="space-y-3" aria-labelledby="events-heading"><h2 id="events-heading" className="font-semibold">Happening while you’re there</h2><LookupStatus {...events} />
          {events.data?.length === 0 && <p>No events found. Try a nearby city; Ticketmaster coverage varies by destination.</p>}
          {events.data?.map((event) => <Card key={event.id}><label className="flex items-start gap-3"><input type="checkbox" className="mt-1 size-5 shrink-0" checked={chosen.includes(event.id)} onChange={(e) => setChosen((v) => e.target.checked ? [...v, event.id] : v.filter((id) => id !== event.id))} /><span className="min-w-0"><span className="block font-semibold break-words">{event.name}</span><span className="text-sm text-muted">{event.date} · {event.time ?? 'Time to be announced'}{event.zone ? ` · ${event.zone}` : ''}<br />{event.venue}</span></span></label><div className="mt-3 flex flex-wrap items-center gap-3"><Button variant="secondary" disabled={busy} onClick={() => void saveEvent(event)}>Add to plan</Button><a className="ui-link" href={event.url} target="_blank" rel="noopener noreferrer">Details & tickets<span className="sr-only"> (opens in a new tab)</span></a></div></Card>)}
          {!!events.data?.length && <Button disabled={busy || chosen.length < 2} onClick={() => void voteOnEvents()}>Start a vote ({chosen.length} selected)</Button>}
          <p className="text-xs text-muted">Source: Ticketmaster. Events are suggestions; adding one to your plan does not book tickets.</p><Button variant="ghost" disabled={events.loading} onClick={events.refresh}>Refresh events</Button>
        </section>
      </>}
    </div></div>
}
