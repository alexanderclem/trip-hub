import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMyMemberId, useTripAccess } from '@/data/device'
import { can } from '@/data/access'
import { useTrip } from '@/data/hooks'
import { ensureSession, supabase } from '@/lib/supabase'
import { extractText, ocrLangs } from '@/features/scan/text'
import { Button, Disclosure, ErrorNote, Field, Input, PageHeader, Select, Textarea } from '@/ui'
import { ITEM_KINDS } from '@/data/types'
import { importResultSchema, type ImportEntry } from './model'
import { applyImport } from './data'

export function ImportScreen() {
  const { tripId } = useParams() as { tripId: string }
  const trip = useTrip(tripId), me = useMyMemberId(tripId), allowed = can(useTripAccess(tripId), 'plan')
  const [text, setText] = useState(''), [entries, setEntries] = useState<ImportEntry[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState<string | null>(null), [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const working = useRef(false)
  const update = (index: number, key: keyof ImportEntry, value: string) => setEntries((rows) => rows.map((r, i) => i === index ? { ...r, [key]: key === 'title' ? value : value || null } : r))
  async function run(label: string, action: () => Promise<void>) {
    if (working.current) return
    working.current = true; setBusy(label); setError(null); setResult(null)
    try { await action() } catch (e) { setError(e instanceof Error ? e.message : 'Could not finish the import. Your changes are still here.') }
    finally { working.current = false; setBusy(null) }
  }
  return <div className="pb-10"><PageHeader title="Import reservations & places" back={`/t/${tripId}/more`} />
    <div className="mx-auto max-w-md space-y-5 p-4">
      <p className="text-sm text-muted">Paste booking emails, travel notes, or a list of places. You can also read a screenshot, PDF, or text file. Review every entry before adding it.</p>
      {!allowed ? <p>You can view this trip. Ask an organizer to import plans.</p> : <>
        <Field label="Travel details" hint="Only this text is sent to Stowaway’s AI service when you analyze it. Links are kept as references; their pages and map lists are not opened.">
          <Textarea rows={8} maxLength={20000} value={text} disabled={!!busy} onChange={(e) => { setText(e.target.value); setEntries([]); setResult(null) }} placeholder="Hotel confirmation, flight details, or places you saved…" />
        </Field>
        <Field label="Read a file" hint="PDF, image, .txt, or .eml; up to 10 MB. Text extraction runs on this device and may need an initial download.">
          <Input type="file" accept="application/pdf,image/*,.txt,.eml,text/plain,message/rfc822" disabled={!!busy} onChange={(e) => {
            const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
            void run('Reading file…', async () => {
              if (file.size > 10 * 1024 * 1024) throw new Error('Choose a file smaller than 10 MB.')
              const raw = /\.(txt|eml)$/i.test(file.name) || file.type.startsWith('text/') || file.type === 'message/rfc822'
                ? await file.text() : (await extractText(file, file.type, ocrLangs(trip))).text
              if (!raw.trim()) throw new Error('No text found. Paste the important details instead.')
              setText(raw.slice(0, 20000)); setEntries([])
            })
          }} />
        </Field>
        <Button className="w-full" disabled={!!busy || text.trim().length < 5} onClick={() => void run('Analyzing details…', async () => {
          if (!navigator.onLine) throw new Error('Analysis needs an internet connection. Your text is still here.')
          await ensureSession(); const { data } = await supabase.auth.getSession()
          const response = await fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` }, body: JSON.stringify({ text, timezone: trip?.timezone ?? 'UTC' }), signal: AbortSignal.timeout(60000) })
          if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Import analysis is not available on this server yet.')
          const body: unknown = await response.json()
          if (!response.ok) throw new Error((body as { error?: string }).error ?? 'Analysis failed. Try again.')
          const parsed = importResultSchema.parse(body)
          setEntries(parsed.entries); setSelected(new Set(parsed.entries.map((_, i) => i)))
          if (!parsed.entries.length) setResult('No reservations or named places found. Try a more specific selection of text.')
        })}>{busy === 'Analyzing details…' ? busy : 'Analyze details'}</Button>
        {busy && <p role="status" className="text-sm text-muted">{busy}</p>}
        {entries.length > 0 && <section aria-label="Review import" className="space-y-4">
          <h2 className="font-semibold">Review {entries.length} {entries.length === 1 ? 'entry' : 'entries'}</h2>
          <p className="text-sm text-muted">Check dates, time zones, and booking codes. Entries with a start time go on the plan as tentative. Others are saved to Places. Original files are not attached; save them under Tickets if needed.</p>
          {entries.map((entry, i) => <fieldset key={i} disabled={!!busy} className="space-y-3 rounded-surface border border-line p-3">
            <legend className="px-1"><label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" className="ui-check" checked={selected.has(i)} onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(i); else n.delete(i); return n })} />Include entry {i + 1}</label></legend>
            <Field label="Name"><Input value={entry.title} maxLength={200} onChange={(e) => update(i, 'title', e.target.value)} /></Field>
            <Field label="Type"><Select value={entry.kind} onChange={(e) => update(i, 'kind', e.target.value)}>{ITEM_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</Select></Field>
            <Field label="Starts (optional)"><Input type="datetime-local" value={entry.start_local ?? ''} onChange={(e) => update(i, 'start_local', e.target.value)} /></Field>
            <Field label="Start time zone" hint={`Uses ${trip?.timezone ?? 'UTC'} when empty.`}><Input value={entry.start_tz ?? ''} onChange={(e) => update(i, 'start_tz', e.target.value)} placeholder={trip?.timezone} /></Field>
            <Field label="Address"><Input value={entry.address ?? ''} maxLength={400} onChange={(e) => update(i, 'address', e.target.value)} /></Field>
            <Disclosure summary="Booking details & notes"><div className="space-y-3">
              <Field label="Ends (optional)"><Input type="datetime-local" value={entry.end_local ?? ''} onChange={(e) => update(i, 'end_local', e.target.value)} /></Field>
              <Field label="End time zone"><Input value={entry.end_tz ?? ''} onChange={(e) => update(i, 'end_tz', e.target.value)} /></Field>
              <Field label="Confirmation code"><Input value={entry.confirmation_code ?? ''} maxLength={80} onChange={(e) => update(i, 'confirmation_code', e.target.value)} /></Field>
              <Field label="Flight number"><Input value={entry.flight ?? ''} maxLength={30} onChange={(e) => update(i, 'flight', e.target.value)} /></Field>
              <Field label="Source link"><Input type="url" value={entry.source_url ?? ''} maxLength={2000} onChange={(e) => update(i, 'source_url', e.target.value)} /></Field>
              <Field label="Notes"><Textarea value={entry.notes ?? ''} maxLength={2000} onChange={(e) => update(i, 'notes', e.target.value)} /></Field>
            </div></Disclosure>
          </fieldset>)}
          <Button variant="secondary" className="w-full" disabled={!!busy || !selected.size} onClick={() => void run('Saving reviewed entries…', async () => {
            if (!trip) throw new Error('Wait for the trip to load.')
            const saved = await applyImport(tripId, me, trip.timezone, entries.filter((_, i) => selected.has(i)))
            setResult(`${saved.added} added${saved.skipped ? `; ${saved.skipped} already imported` : ''}.`); setEntries([]); setSelected(new Set())
          })}>Add {selected.size} reviewed {selected.size === 1 ? 'entry' : 'entries'}</Button>
        </section>}
        <ErrorNote error={error} />{result && <p role="status" className="text-sm">{result}</p>}
        <Link className="ui-link" to={`/t/${tripId}/more/import`}>Import an itinerary CSV instead</Link>
      </>}
    </div></div>
}
