import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { DateTime } from 'luxon'
import { Compass, Users } from 'lucide-react'
import { useDevice, useMyMemberId } from '@/data/device'
import { db } from '@/data/db'
import { useMembers, usePlaces, useTrip } from '@/data/hooks'
import { useItems } from '@/features/itinerary/data'
import { newId } from '@/lib/ids'
import { formatMoney, minorUnits } from '@/lib/money'
import { tripAreas } from '@/features/destinations/destinations'
import { Button, Card, ErrorNote, Field, Input, PageHeader, Select, Textarea } from '@/ui'
import { applyIdea, refinementPlan, saveProfile, undoIdea, useDrafts, useProfiles } from './data'
import { requestAI } from './client'
import { AXES, briefSchema, classify, combine, ideasSchema, matchScore, type Axis, type Draft, type Idea, type MatchMode, type Profile } from './model'
import { ProfileEditor } from './ProfileEditor'
import { RadarChart } from './RadarChart'

function activityTimeRange(time: string, durationMinutes: number) {
  const end = DateTime.fromISO(`2000-01-01T${time}`, { zone: 'utc' }).plus({ minutes: durationMinutes })
  return `${time}–${end.toFormat('HH:mm')}${end.day > 1 ? ' (+1 day)' : ''}`
}

export function DiscoveryScreen() {
  const { tripId } = useParams()
  const generationRef = useRef<AbortController | null>(null)
  const topRef = useRef<HTMLElement>(null)
  const navigate = useNavigate()
  const trip = useTrip(tripId)
  const memberId = useMyMemberId(tripId)
  const personal = useDevice((s) => s.travelProfile)
  const profiles = useProfiles(tripId)
  const members = useMembers(tripId)
  const places = usePlaces(tripId)
  const items = useItems(tripId ?? '')
  const drafts = useDrafts(tripId ?? 'personal')
  const [excluded, setExcluded] = useState<string[]>([])
  const [mode, setMode] = useState<MatchMode>('everyone')
  const [required, setRequired] = useState<Axis[]>([])
  const [prompt, setPrompt] = useState('')
  const [destination, setDestination] = useState('')
  const [days, setDays] = useState(5)
  const [budget, setBudget] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [startDate, setStartDate] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [previous, setPrevious] = useState<Idea | null>(null)
  const [replacesDraftId, setReplacesDraftId] = useState<string | undefined>()
  const [showProfile, setShowProfile] = useState(!personal)
  const mine = profiles?.find((p) => p.member_id === memberId) ?? null
  const included = tripId ? (profiles ?? []).filter((p) => !excluded.includes(p.member_id) && members?.some((m) => m.id === p.member_id)) : personal ? [personal] : []
  const group = combine(included)
  const draft = drafts?.find((d) => d.id === activeId) ?? drafts?.[0]
  const draftIsStale = draft && tripId && draft.createdAt < (profiles ?? []).reduce((latest, p) => (p.updated_at ?? '') > latest ? p.updated_at! : latest, '')
  const savedProfile = tripId ? mine : personal
  const effectiveDate = startDate || trip?.start_date || ''
  const tripDays = trip?.start_date && trip.end_date ? Math.round(DateTime.fromISO(trip.end_date).diff(DateTime.fromISO(trip.start_date), 'days').days) + 1 : null
  const effectiveDays = tripDays ? Math.min(days, tripDays) : days
  const effectiveDestination = destination || (tripId ? tripAreas(trip).map((a) => a.name).join(', ') : '')

  async function savePreferences(profile: Profile) {
    if (tripId) {
      if (!memberId) throw new Error('Choose who you are before saving preferences.')
      await saveProfile(tripId, memberId, profile)
    }
    useDevice.getState().setTravelProfile(profile)
  }

  async function generate(e: FormEvent) {
    e.preventDefault(); if (busy) return
    setError(null); setMessage('')
    if (!included.length) { setError('Save at least one traveler’s preferences before generating ideas.'); return }
    const effectiveCurrency = trip?.base_currency ?? currency.toUpperCase()
    if (!/^[A-Z]{3}$/.test(effectiveCurrency)) { setError('Enter a three-letter currency code, such as USD or EUR.'); return }
    const brief = briefSchema.safeParse({ prompt: prompt.trim(), destination: effectiveDestination.trim(), days: effectiveDays, startDate: effectiveDate || null, budgetMinor: budget ? Math.round(Number(budget) * 10 ** minorUnits(effectiveCurrency)) : null, currency: effectiveCurrency })
    if (!brief.success) { setError('Enter a trip brief, 1–14 days, a valid start date, and a nonnegative budget.'); return }
    const controller = new AbortController()
    generationRef.current = controller
    setBusy('generate')
    try {
      const protectedItems = replacesDraftId ? await refinementPlan(items ?? [], replacesDraftId) : items ?? []
      const result = ideasSchema.parse(await requestAI({ action: 'ideas', tripId: tripId ?? null, brief: brief.data,
        profiles: included.map((p) => ({ scores: p.scores, description: p.description, constraints: p.constraints })), mode, requiredAxes: required, previous,
        places: (places ?? []).filter((p) => p.status !== 'rejected').slice(0, 100).map((p) => ({ id: p.id, name: p.name.slice(0, 160), category: p.category, area: p.area?.slice(0, 160) ?? null })),
        existingPlan: protectedItems.filter((i) => i.status !== 'cancelled').slice(0, 100).map((i) => ({ title: i.title.slice(0, 160), start: i.start_local, end: i.end_local, status: i.status })),
      }, controller.signal))
      const saved: Draft = { id: newId(), scope: tripId ?? 'personal', createdAt: new Date().toISOString(), brief: brief.data, result, replacesDraftId }
      await db.ai_drafts.add(saved)
      setActiveId(saved.id); setMessage('New draft saved on this device. Review it before adding it to your plan.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not generate ideas. Your previous draft is saved.') }
    finally { generationRef.current = null; setBusy(null) }
  }

  async function apply(index: number) {
    if (!draft) return
    if (!tripId) { navigate(`/new?draft=${draft.id}&idea=${index}`); return }
    if (!trip || !memberId) return
    setBusy('apply'); setError(null); setMessage('')
    try { const count = await applyIdea(draft.id, index, trip, memberId, effectiveDate); setMessage(`Added ${count} tentative items, suggested places, and planning tasks. You can edit them in the Plan tab.`) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not add this draft.') }
    finally { setBusy(null) }
  }
  async function undo() {
    if (!draft || !memberId) return
    setBusy('undo'); setError(null)
    try { const result = await undoIdea(draft.id, memberId); setMessage(`Removed ${result.removed} generated entries. ${result.kept ? `${result.kept} edited or referenced entries were kept.` : 'Your other plans are unchanged.'}`) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not undo this draft.') }
    finally { setBusy(null) }
  }

  if (tripId && (!trip || profiles === undefined || members === undefined)) return <div><PageHeader title="Trip ideas" back={`/t/${tripId}/more`} /><p role="status" className="p-5">Loading travel preferences…</p></div>
  return <div className="min-h-full pb-28">
    <PageHeader title="Trip ideas" back={tripId ? `/t/${tripId}/more` : '/'} />
    <section ref={topRef} aria-label="Travel planning" className="mx-auto max-w-5xl scroll-mt-16 space-y-6 p-4 sm:p-6">
      <div className="max-w-2xl"><p className="flex items-center gap-2 text-sm font-medium text-brand-700"><Compass aria-hidden="true" className="size-4" />{trip?.name ?? 'A starting point for your next adventure'}</p><h2 className="travel-heading mt-2 text-3xl sm:text-4xl">A trip that feels like you.</h2><p className="mt-3 text-sm leading-relaxed text-stone-600">Start with what you enjoy. Explore a few routes, build a draft, and make it your own together.</p></div>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{savedProfile ? classify(savedProfile.scores) : 'Tell us how you like to travel'}</h2><p className="mt-1 text-sm text-stone-600">{savedProfile ? 'Your saved preferences guide new ideas.' : 'Your scores start at 50. Save a profile to start planning.'}</p></div><div className="flex flex-wrap gap-2"><Link to={`/quiz?next=${encodeURIComponent(tripId ? `/t/${tripId}/more/ideas` : '/inspire')}`} className="inline-flex min-h-11 items-center rounded-xl px-4 font-medium text-brand-700 hover:bg-brand-50">{savedProfile ? 'Retake the quiz' : 'Take the quiz'}</Link><Button variant="secondary" onClick={() => setShowProfile((s) => !s)} aria-expanded={showProfile}>{showProfile ? 'Close preferences' : 'Edit my preferences'}</Button></div></div>
        {showProfile && <div className="mt-6 border-t border-stone-200 pt-5"><ProfileEditor key={tripId ? memberId : 'personal'} initial={savedProfile ?? personal} onSave={savePreferences} /></div>}
      </Card>
      {(group || (tripId && !!profiles?.length)) && <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card><h2 className="flex items-center gap-2 font-semibold"><Users aria-hidden="true" className="size-5 text-brand-700" />{tripId ? 'The group’s travel style' : 'Your saved travel style'}</h2>
          {group ? <RadarChart scores={group.mean} comparison={tripId && mine ? mine.scores : undefined} range={tripId && included.length > 1 ? group : undefined} label={tripId ? 'Group average' : 'Saved preferences'} /> : <p className="py-5 text-sm text-stone-600">Select at least one traveler to compare preferences.</p>}
          {tripId && <><p className="mt-3 text-sm text-stone-600">{included.length} of {members?.length ?? 0} travelers included. Travelers without a saved profile are excluded.</p>
            <fieldset className="mt-3"><legend className="text-sm font-medium">Plan for these travelers</legend>{members?.map((m) => { const p = profiles?.find((r) => r.member_id === m.id); return <label key={m.id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-brand-700" disabled={!p || !!busy} checked={!!p && !excluded.includes(m.id)} onChange={(e) => setExcluded((s) => e.target.checked ? s.filter((id) => id !== m.id) : [...s, m.id])} /><span>{m.display_name}{m.id === memberId ? ' (you)' : ''}{!p ? ' · Needs a profile' : ''}</span></label> })}</fieldset>
          </>}
          {!!group?.disagreements.length && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Different tastes: {group.disagreements.map((key) => AXES.find((a) => a.key === key)!.label).join(', ')}. Suggestions should leave room for compromises or separate activities.</p>}
        </Card>
        <Card><form className="space-y-4" onSubmit={(e) => void generate(e)}>
          <h2 className="travel-heading text-2xl">{previous ? 'Refine this idea' : 'Where could this take you?'}</h2>
          {previous && <div className="rounded-xl bg-brand-50 p-3 text-sm"><p>Refining: <strong>{previous.title}</strong></p><Button variant="ghost" onClick={() => { setPrevious(null); setReplacesDraftId(undefined) }} type="button">Start a fresh idea</Button></div>}
          <Field label={previous ? 'What would you change?' : 'What are you imagining?'}><Textarea required maxLength={3000} disabled={!!busy} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={previous ? 'Less driving, keep the food market, and add a free afternoon…' : 'A warm-weather escape with great food, a little hiking, and time to relax…'} /></Field>
          <Field label="Destination" hint={tripId ? 'Use this trip’s destination to keep suggestions relevant.' : 'Leave blank to explore destinations.'}><Input value={effectiveDestination} disabled={!!busy} maxLength={160} onChange={(e) => setDestination(e.target.value)} placeholder="A country, city, or region" /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Days" hint={tripDays ? `Up to ${Math.min(14, tripDays)} days in this trip.` : 'Drafts cover up to 14 days.'}><Input type="number" min="1" max={Math.min(14, tripDays ?? 14)} required value={effectiveDays} disabled={!!busy} onChange={(e) => setDays(Number(e.target.value))} /></Field><Field label="Start date" hint={tripId ? 'Required when adding to the plan.' : 'Optional while exploring.'}><Input type="date" value={effectiveDate} disabled={!!busy} min={trip?.start_date ?? undefined} max={trip?.end_date ?? undefined} onChange={(e) => setStartDate(e.target.value)} /></Field></div>
          <div className="grid grid-cols-2 gap-3"><Field label="Budget per person" hint="Whole trip, estimated."><Input type="number" min="0" max="1000000" step="0.01" value={budget} disabled={!!busy} onChange={(e) => setBudget(e.target.value)} placeholder="Optional" /></Field><Field label="Currency"><Input value={trip?.base_currency ?? currency} disabled={!!tripId || !!busy} maxLength={3} required onChange={(e) => setCurrency(e.target.value.toUpperCase())} /></Field></div>
          <Field label="How should we balance preferences?"><Select disabled={!!busy} value={mode} onChange={(e) => setMode(e.target.value as MatchMode)}><option value="everyone">Find a fit for everyone</option><option value="average">Favor the group average</option></Select></Field>
          <fieldset><legend className="text-sm font-medium">Focus the ideas</legend><p className="mt-1 text-xs text-stone-600">Selected interests need a score of at least 65. Filters also apply to saved ideas.</p><div className="mt-2 flex flex-wrap gap-2">{AXES.map(({ key, label }) => <label key={key} className="flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 px-3 text-sm"><input type="checkbox" className="size-4 accent-brand-700" disabled={!!busy} checked={required.includes(key)} onChange={(e) => setRequired((s) => e.target.checked ? [...s, key] : s.filter((a) => a !== key))} />{label}</label>)}</div></fieldset>
          <p className="text-xs leading-relaxed text-stone-600">Generating sends included travelers’ saved preferences and this brief to our AI provider. Review suggestions and verify costs, places, and availability before booking.</p>
          <Button className="w-full" disabled={!!busy || !included.length}>{busy === 'generate' ? 'Sketching your trip ideas…' : previous ? 'Generate a revised draft' : 'Generate trip ideas'}</Button>
          {busy === 'generate' && <div className="space-y-2"><p role="status" className="text-xs text-stone-600">This can take up to 90 seconds. You can cancel and try a shorter trip brief.</p><Button type="button" variant="secondary" onClick={() => generationRef.current?.abort()}>Cancel generation</Button></div>}
        </form></Card>
      </div>}
      <ErrorNote error={error} /><p role="status" className="text-sm text-brand-900">{message}</p>
      {draft && <section className="space-y-4" aria-label="Saved trip ideas">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="travel-heading text-2xl">Your starting points</h2><p className="mt-1 text-xs text-stone-600">Saved on this device · {new Date(draft.createdAt).toLocaleDateString()} · Match is preference similarity, not a quality rating.</p></div>{drafts && drafts.length > 1 && <Field label="Saved draft"><Select value={draft.id} onChange={(e) => { setActiveId(e.target.value); setPrevious(null) }}>{drafts.map((d) => <option key={d.id} value={d.id}>{d.result.ideas[0]?.title} · {new Date(d.createdAt).toLocaleDateString()}</option>)}</Select></Field>}</div>
        {draftIsStale && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Preferences have changed since this draft. Matches use current scores; regenerate to update the itinerary and constraints.</p>}
        {draft.application && <div className="flex flex-wrap items-center gap-3 rounded-xl bg-brand-50 p-4 text-sm"><p>{draft.application.undone ? 'This draft was undone. Generate a new version to use it again.' : 'This draft has been added to a trip.'}</p><Link className="inline-flex min-h-11 items-center font-medium text-brand-700" to={`/t/${draft.application.tripId}/plan`}>Open plan →</Link>{!draft.application.undone && memberId && <Button variant="secondary" disabled={!!busy} onClick={() => void undo()}>Undo unedited additions</Button>}</div>}
        {!draft.result.ideas.some((idea) => required.every((key) => idea.scores[key] >= 65)) && <p className="rounded-xl border border-stone-200 p-5 text-sm">No saved ideas match these filters. Remove an interest or generate a new draft.</p>}
        {draft.result.ideas.map((idea, index) => ({ idea, index, match: matchScore(idea.scores, included, mode) })).filter(({ idea }) => required.every((key) => idea.scores[key] >= 65)).sort((a, b) => b.match - a.match).map(({ idea, index, match }) => <Card key={`${draft.id}-${index}`}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium text-brand-700">{idea.destination}</p><h3 className="travel-heading mt-1 text-2xl">{idea.title}</h3></div><span className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-medium text-brand-900">{included.length ? `${match}% preference match` : 'Save preferences to compare'}</span></div>
          <p className="mt-3 text-sm leading-relaxed text-stone-700">{idea.summary}</p><p className="mt-3 text-sm"><strong>Why it fits:</strong> {idea.why}</p>{idea.tradeoffs && <p className="mt-2 text-sm text-stone-600"><strong>Tradeoffs:</strong> {idea.tradeoffs}</p>}
          <p className="mt-3 text-sm font-medium">{idea.days.length} days{idea.estimatedCostMinor !== null ? ` · About ${formatMoney(idea.estimatedCostMinor, idea.currency)} per person` : ''}<span className="font-normal text-stone-500"> · Estimate, verify before booking</span></p>
          <details className="mt-4 border-t border-stone-200"><summary className="min-h-11 cursor-pointer py-3 font-medium text-brand-700">Preview daily itinerary</summary><ol className="space-y-4 pb-4">{idea.days.map((day, i) => <li key={i}><h4 className="font-semibold">Day {i + 1} · {day.title}</h4><ul className="mt-2 space-y-2">{day.activities.map((a, j) => <li key={j} className="flex gap-3 text-sm"><span className="shrink-0 tabular-nums text-stone-500">{activityTimeRange(a.time, a.durationMinutes)}</span><div><p>{a.title}</p><p className="text-xs leading-relaxed text-stone-500">{a.notes}</p></div></li>)}</ul></li>)}</ol>{!!idea.tasks.length && <p className="pb-4 text-sm text-stone-600">Planning tasks: {idea.tasks.join(' · ')}</p>}</details>
          {draft.replacesDraftId && !draft.application && <p className="mt-3 rounded-xl bg-brand-50 p-3 text-sm">This revision replaces the previous draft’s unedited additions. Booked, edited, and referenced entries stay in the plan.</p>}
          <div className="mt-3 flex flex-wrap gap-2"><Button disabled={!!busy || !!draft.application || (!!tripId && (!memberId || !effectiveDate))} onClick={() => void apply(index)}>{busy === 'apply' ? 'Adding draft…' : tripId ? draft.replacesDraftId ? 'Replace unedited draft' : 'Add draft to plan' : 'Build this trip'}</Button><Button variant="secondary" disabled={!!busy} onClick={() => { setPrevious(idea); setReplacesDraftId(draft.application && !draft.application.undone && draft.application.ideaIndex === index && draft.application.tripId === tripId ? draft.id : undefined); setShowProfile(false); setPrompt(''); topRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' }) }}>Refine this idea</Button></div>
          {tripId && !effectiveDate && <p className="mt-2 text-xs text-stone-600">Choose a start date above to add this draft to the plan.</p>}
        </Card>)}
      </section>}
    </section>
  </div>
}
