// /organize/campaigns (Pro): plain-text emails to past travelers who ticked "email me about future
// trips". Built now; queued mail goes out once Stowaway has a sender on its own domain (Gmail can't
// send bulk mail). Every email carries the organizer's postal address and a one-tap unsubscribe link.

import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Button, Card, ErrorNote, Field, Input, PageHeader, SectionTitle, Status, Textarea } from '@/ui'
import { LoadingState } from '@/ui/LoadingState'
import { campaignAudience, listCampaigns, listContacts, listMyOffers, queueCampaign, saveCampaign, sendCampaignTest, type CampaignRow } from './api'
import { ProBadge, useMyOrganizer } from './pro'

export function CampaignsScreen() {
  const me = useMyOrganizer()
  const [rows, setRows] = useState<CampaignRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<CampaignRow | 'new' | null>(null)
  const load = () => listCampaigns().then(setRows, (e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  useEffect(() => { void load() }, [])

  if (!rows && !error) return <LoadingState fullScreen title="Loading campaigns…" />
  return (
    <div className="pb-16">
      <PageHeader title="Campaigns" back="/organize" />
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <div className="-ml-2"><ProBadge beta={me?.beta ?? true} /></div>
        {!me?.campaign_sending && (
          <p role="note" className="rounded-surface bg-mist/60 p-3 text-sm">Sending turns on once Stowaway sets up its campaign sender. You can write and queue campaigns now; queued emails go out then, to everyone who still wants them.</p>
        )}
        {me && !me.postal_address && <p className="text-sm">Add your postal address on <Link className="ui-link" to="/organize">Organize</Link> before queueing. The law requires it in every marketing email.</p>}
        <ErrorNote error={error} />
        {editing ? <Composer campaign={editing === 'new' ? null : editing} organizerId={me?.id ?? null} onDone={() => { setEditing(null); void load() }} /> : (
          <>
            <Button className="w-full" onClick={() => setEditing('new')}>Write a campaign</Button>
            {rows && rows.length > 0 && (
              <Card>
                <SectionTitle>Your campaigns</SectionTitle>
                <ul className="mt-2 divide-y divide-line">
                  {rows.map((c) => (
                    <li key={c.id}>
                      <button type="button" className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 py-2 text-left" onClick={() => setEditing(c)}>
                        <span className="min-w-0 break-words font-semibold text-action">{c.subject || 'Untitled'}</span>
                        {c.status === 'queued' ? <Status tone="success">{me?.campaign_sending ? `Sent to ${c.recipients}` : `Queued for ${c.recipients}`}</Status> : <Status tone="quiet">Draft</Status>}
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Composer({ campaign, organizerId, onDone }: { campaign: CampaignRow | null; organizerId: string | null; onDone: () => void }) {
  const [id, setId] = useState(campaign?.id ?? null)
  const [subject, setSubject] = useState(campaign?.subject ?? '')
  const [body, setBody] = useState(campaign?.body ?? '')
  const [trips, setTrips] = useState<string[]>(campaign?.audience.trip_ids ?? [])
  const [tags, setTags] = useState<string[]>(campaign?.audience.tags ?? [])
  const [offers, setOffers] = useState<{ trip_id: string; title: string }[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [audience, setAudience] = useState<{ count: number; first: { name: string; email: string }[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const locked = campaign?.status === 'queued'

  useEffect(() => {
    if (organizerId) void listMyOffers(organizerId).then(setOffers)
    listContacts().then((c) => setAllTags([...new Set(c.flatMap((x) => x.tags))].sort()), () => undefined)
  }, [organizerId])
  useEffect(() => {
    campaignAudience({ trip_ids: trips, tags }).then(setAudience, () => setAudience(null))
  }, [trips.join(), tags.join()])

  async function run(fn: () => Promise<string | void>) {
    setBusy(true); setError(null); setMsg(null)
    try { const m = await fn(); if (m) setMsg(m) } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  async function saved(): Promise<string> {
    const c = await saveCampaign(id, subject, body, { trip_ids: trips, tags })
    setId(c.id)
    return c.id
  }
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  return (
    <Card>
      <SectionTitle>{locked ? 'Queued campaign' : id ? 'Edit campaign' : 'New campaign'}</SectionTitle>
      <div className="mt-3 space-y-3">
        <Field label="Subject"><Input maxLength={150} value={subject} disabled={locked} onChange={(e) => setSubject(e.target.value)} placeholder="Lake Atitlán again in March?" /></Field>
        <Field label="Message" hint="Plain text. Your name, postal address and an unsubscribe link are added at the end."><Textarea rows={8} maxLength={10000} value={body} disabled={locked} onChange={(e) => setBody(e.target.value)} /></Field>
        {offers.length > 0 && (
          <fieldset>
            <legend className="text-sm font-[550] text-ink">People who went on (any, if none ticked)</legend>
            {offers.map((o) => <label key={o.trip_id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5" disabled={locked} checked={trips.includes(o.trip_id)} onChange={() => setTrips(toggle(trips, o.trip_id))} />{o.title}</label>)}
          </fieldset>
        )}
        {allTags.length > 0 && (
          <fieldset>
            <legend className="text-sm font-[550] text-ink">Tagged (any, if none ticked)</legend>
            <div className="flex flex-wrap gap-x-4">{allTags.map((t) => <label key={t} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="size-5" disabled={locked} checked={tags.includes(t)} onChange={() => setTags(toggle(tags, t))} />{t}</label>)}</div>
          </fieldset>
        )}
        <p role="status" className="text-sm">{audience ? `${audience.count} ${audience.count === 1 ? 'person' : 'people'} who agreed to hear from you` : 'Counting who it reaches…'}</p>
        {audience && audience.first.length > 0 && <p className="text-xs text-muted">{audience.first.slice(0, 8).map((p) => p.name).join(', ')}{audience.count > 8 ? ' and more' : ''}</p>}
        <ErrorNote error={error} />
        {msg && <p role="status" className="text-sm text-success-ink">{msg}</p>}
        {!locked && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => void run(async () => { await saved(); return 'Saved as a draft.' })}>Save draft</Button>
            <Button variant="secondary" disabled={busy || !subject.trim() || !body.trim()} onClick={() => void run(async () => { await sendCampaignTest(await saved()); return 'A test copy is on its way to your support email.' })}>Send me a test</Button>
          </div>
        )}
        {!locked && <Button className="w-full" disabled={busy || !subject.trim() || !body.trim() || !audience?.count} onClick={() => void run(async () => {
          const n = await queueCampaign(await saved())
          onDone()
          return `Queued for ${n}.`
        })}>Queue for {audience?.count ?? 0}</Button>}
        <button type="button" className="ui-link inline-flex min-h-11 items-center" onClick={onDone}>Back to campaigns</button>
      </div>
    </Card>
  )
}
