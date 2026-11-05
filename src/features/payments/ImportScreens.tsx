// Moving to Stowaway: bring a CSV from a spreadsheet or another booking tool. The file is read on this
// phone; the person checks which column is which and sees the first rows before anything is saved.
//   /organize/import            past travelers → the traveler list (Pro; consent never carries over)
//   /t/:tripId/more/import      a plan → plan items in the trip (free, works offline)

import { useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useDevice } from '@/data/device'
import { useTrip } from '@/data/hooks'
import { Button, Card, ErrorNote, PageHeader, SectionTitle, Select } from '@/ui'
import { LoadingState } from '@/ui/LoadingState'
import { saveItem } from '@/features/itinerary/data'
import { importContacts } from './api'
import { contactsFromCsv, guessMapping, parseCsv, planFromCsv, type Mapping } from './importCsv'
import { ProBadge, useMyOrganizer } from './pro'

const MAX_BYTES = 2 * 1024 * 1024

function useCsvFile() {
  const [rows, setRows] = useState<string[][] | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setError(null)
    if (!file) return
    if (file.size > MAX_BYTES) { setError('That file is over 2 MB. Split it, or keep only the columns you need.'); return }
    const parsed = parseCsv(await file.text())
    if (parsed.length < 2) { setError('That file has no rows under its header. Save it from your spreadsheet as CSV and try again.'); return }
    setName(file.name)
    setRows(parsed)
  }
  return { rows, name, error, pick, reset: () => setRows(null) }
}

function MappingFields<F extends string>({ header, labels, mapping, onChange }: { header: string[]; labels: Record<F, string>; mapping: Mapping<F>; onChange: (m: Mapping<F>) => void }) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {(Object.keys(labels) as F[]).map((f) => (
        <label key={f} className="block text-sm">
          <span className="font-medium">{labels[f]}</span>
          <Select className="mt-1" value={mapping[f] ?? ''} onChange={(e) => onChange({ ...mapping, [f]: e.target.value === '' ? null : Number(e.target.value) })}>
            <option value="">(none)</option>
            {header.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
          </Select>
        </label>
      ))}
    </div>
  )
}

function FilePicker({ id, label, onPick }: { id: string; label: string; onPick: (e: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label htmlFor={id} className="ui-button ui-button-secondary w-full cursor-pointer focus-within:outline-2 focus-within:outline-action">
      {label}
      <input id={id} type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={onPick} />
    </label>
  )
}

// ─── Past travelers ─────────────────────────────────────────────────────────

const CONTACT_LABELS = { name: 'Full name', first: 'First name', last: 'Last name', email: 'Email', tags: 'Tags (optional)' }

export function ImportTravelersScreen() {
  const me = useMyOrganizer()
  const file = useCsvFile()
  const [mapping, setMapping] = useState<Mapping<keyof typeof CONTACT_LABELS> | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ added: number; updated: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const m = mapping ?? (file.rows ? guessMapping(file.rows[0]!, ['name', 'first', 'last', 'email', 'tags'] as const) : null)
  const result = file.rows && m ? contactsFromCsv(file.rows, m) : null

  async function run() {
    if (!result) return
    setBusy(true); setError(null)
    try { setDone(await importContacts(result.ok)) } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }

  return (
    <div className="pb-16">
      <PageHeader title="Import past travelers" back="/organize" />
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <div className="-ml-2"><ProBadge beta={me?.beta ?? true} /></div>
        <p className="text-sm text-muted">From a spreadsheet or another booking tool, saved as CSV. Everyone joins your traveler list. Nobody is signed up for emails: only travelers can agree to that, when they book.</p>
        {done ? (
          <Card>
            <p role="status">Added {done.added} {done.added === 1 ? 'traveler' : 'travelers'}{done.updated ? `, and updated tags for ${done.updated} you already had` : ''}.</p>
            <Link className="ui-link mt-2 inline-flex min-h-11 items-center" to="/organize/travelers">See your travelers</Link>
          </Card>
        ) : !file.rows ? (
          <><FilePicker id="travelers-csv" label="Choose a CSV file" onPick={file.pick} /><ErrorNote error={file.error} /></>
        ) : m && result && (
          <Card>
            <SectionTitle>{file.name}</SectionTitle>
            <p className="mt-1 text-sm text-muted">Check which column is which.</p>
            <MappingFields header={file.rows[0]!} labels={CONTACT_LABELS} mapping={m} onChange={setMapping} />
            <p role="status" className="mt-3 text-sm">{result.ok.length} ready to import{result.skipped.length ? `; ${result.skipped.length} skipped (no valid email or a repeat): ${result.skipped.length === 1 ? 'row' : 'rows'} ${result.skipped.slice(0, 8).join(', ')}${result.skipped.length > 8 ? '…' : ''}` : ''}.</p>
            {result.ok.length > 0 && <ul className="mt-2 divide-y divide-line text-sm">{result.ok.slice(0, 10).map((c) => <li key={c.email} className="py-1.5 break-words">{c.name} <span className="text-muted">{c.email}{c.tags.length ? ` · ${c.tags.join(', ')}` : ''}</span></li>)}</ul>}
            <ErrorNote error={error} />
            <Button className="mt-3 w-full" disabled={busy || result.ok.length === 0 || result.ok.length > 2000} onClick={() => void run()}>{busy ? 'Importing…' : `Import ${result.ok.length}`}</Button>
            <button type="button" className="ui-link mt-1 inline-flex min-h-11 items-center" onClick={() => { file.reset(); setMapping(null) }}>Choose another file</button>
          </Card>
        )}
      </div>
    </div>
  )
}

// ─── A plan ─────────────────────────────────────────────────────────────────

const PLAN_LABELS = { date: 'Date', start: 'Start time', end: 'End time (optional)', title: 'What', notes: 'Notes (optional)' }

export function ImportPlanScreen() {
  const { tripId } = useParams() as { tripId: string }
  const trip = useTrip(tripId)
  const me = useDevice((s) => s.trips[tripId]?.memberId ?? null)
  const navigate = useNavigate()
  const file = useCsvFile()
  const [mapping, setMapping] = useState<Mapping<keyof typeof PLAN_LABELS> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!trip) return <LoadingState fullScreen title="Loading the trip…" />
  const m = mapping ?? (file.rows ? guessMapping(file.rows[0]!, ['date', 'start', 'end', 'title', 'notes'] as const) : null)
  const result = file.rows && m ? planFromCsv(file.rows, m, tripId, trip.timezone) : null

  async function run() {
    if (!result) return
    setBusy(true); setError(null)
    try {
      for (const item of result.ok) await saveItem(item, me)
      navigate(`/t/${tripId}/plan`)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false) }
  }

  return (
    <div className="pb-16">
      <PageHeader title="Import a plan" back={`/t/${tripId}/more/settings`} />
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <p className="text-sm text-muted">From a spreadsheet saved as CSV, one row per activity: a date, a start time (leave it empty for all day), and what it is. Times are in the trip’s time zone ({trip.timezone.replace(/_/g, ' ')}). Everything comes in as tentative, so you can confirm it.</p>
        {!file.rows ? (
          <><FilePicker id="plan-csv" label="Choose a CSV file" onPick={file.pick} /><ErrorNote error={file.error} /></>
        ) : m && result && (
          <Card>
            <SectionTitle>{file.name}</SectionTitle>
            <p className="mt-1 text-sm text-muted">Check which column is which.</p>
            <MappingFields header={file.rows[0]!} labels={PLAN_LABELS} mapping={m} onChange={setMapping} />
            <p role="status" className="mt-3 text-sm">{result.ok.length} ready to add{result.skipped.length ? `; ${result.skipped.length} skipped (a date, time or name we couldn’t read): ${result.skipped.length === 1 ? 'row' : 'rows'} ${result.skipped.slice(0, 8).join(', ')}${result.skipped.length > 8 ? '…' : ''}` : ''}.</p>
            {result.ok.length > 0 && <ul className="mt-2 divide-y divide-line text-sm">{result.ok.slice(0, 10).map((i) => <li key={i.id} className="py-1.5 break-words"><span className="tabular-nums text-muted">{i.start_local.slice(0, 10)} {i.all_day ? 'all day' : i.start_local.slice(11)}{i.end_local ? `–${i.end_local.slice(11)}` : ''}</span> {i.title}</li>)}</ul>}
            <ErrorNote error={error} />
            <Button className="mt-3 w-full" disabled={busy || result.ok.length === 0 || result.ok.length > 500} onClick={() => void run()}>{busy ? 'Adding…' : `Add ${result.ok.length} to the plan`}</Button>
            <button type="button" className="ui-link mt-1 inline-flex min-h-11 items-center" onClick={() => { file.reset(); setMapping(null) }}>Choose another file</button>
          </Card>
        )}
      </div>
    </div>
  )
}
