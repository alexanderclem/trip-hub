// People → Invite links (free, part of the security model): viewer links for parents or sponsors,
// single-use traveler links, links that expire, and revoking any of them. Needs a connection; the
// link is shown once, because only its hash is stored.

import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button, ErrorNote, Field, Input, Select } from '@/ui'
import { createInvite, listInvites, revokeInvite, type InviteRow } from '@/features/payments/api'
import { shareLink } from './actions'

const ROLE = { traveler: 'Traveler', viewer: 'Viewer (can look, can’t change anything)' } as const

export function InviteLinks({ tripId }: { tripId: string }) {
  const [rows, setRows] = useState<InviteRow[] | null>(null)
  const [role, setRole] = useState<InviteRow['role']>('traveler')
  const [label, setLabel] = useState('')
  const [days, setDays] = useState('14')
  const [single, setSingle] = useState(true)
  const [made, setMade] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => listInvites(tripId).then(setRows)
  useEffect(() => { void refresh() }, [tripId])

  async function make() {
    setBusy(true); setError(null); setMade(null); setCopied(false)
    try {
      const token = await createInvite(tripId, role, label.trim(), Math.max(1, Math.min(365, Number(days) || 14)), single ? 1 : null)
      setMade(shareLink(token))
      setLabel('')
      await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  async function revoke(id: string) {
    setBusy(true); setError(null)
    try { await revokeInvite(id); await refresh() } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }

  const live = (rows ?? []).filter((r) => !r.revoked_at && (!r.expires_at || r.expires_at > new Date().toISOString()) && (r.max_uses === null || r.uses < r.max_uses))
  return (
    <div className="mt-4 border-t border-line pt-4">
      <h3 className="text-sm font-semibold text-ink">Invite links</h3>
      <p className="mt-1 text-sm text-muted">A link for one person or one group, with its own role. It stops working when it expires, is used up, or you revoke it.</p>
      <div className="mt-3 space-y-3">
        <Field label="They join as"><Select value={role} onChange={(e) => setRole(e.target.value as InviteRow['role'])}>{Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Who it’s for (only you see this)"><Input maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Sam’s parents" /></Field>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Works for (days)"><Input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} className="w-20" /></Field>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="size-5" checked={single} onChange={(e) => setSingle(e.target.checked)} />One person only</label>
        </div>
        <Button variant="secondary" className="w-full" disabled={busy} onClick={() => void make()}>{busy ? 'Making…' : 'Make a link'}</Button>
        {made && (
          <div className="rounded-surface bg-mist/60 p-3 text-sm">
            <p>Send this link now; it’s shown only once.</p>
            <p className="mt-1 break-all font-mono text-xs">{made}</p>
            <button type="button" className="ui-link mt-1 inline-flex min-h-11 items-center gap-1" onClick={() => void navigator.clipboard?.writeText(made).then(() => setCopied(true))}>
              {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}{copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        )}
        <ErrorNote error={error} />
      </div>
      {live.length > 0 && (
        <ul className="mt-3 divide-y divide-line text-sm">
          {live.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0 break-words">{r.label || (r.role === 'viewer' ? 'Viewer link' : 'Traveler link')} <span className="text-muted">· {r.role}{r.max_uses !== null ? ` · ${r.uses}/${r.max_uses} used` : ` · ${r.uses} joined`}{r.expires_at ? ` · until ${r.expires_at.slice(0, 10)}` : ''}</span></span>
              <Button variant="secondary" className="px-3 text-sm" disabled={busy} onClick={() => void revoke(r.id)}>Revoke</Button>
            </li>
          ))}
        </ul>
      )}
      {!navigator.onLine && <p className="mt-2 text-sm text-muted">Connect to the internet to see and make invite links.</p>}
    </div>
  )
}
