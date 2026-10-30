// Settings → People: who is on the trip, and for organizers (or the creator of a trip without one)
// removing people, roles, letting people in, and who can edit. The server enforces all of it
// (supabase/migrations/20261030000001_access_roles.sql); this only offers what it would allow.

import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useTripAccess } from '@/data/device'
import { can, isStaff } from '@/data/access'
import type { Member, Trip, TripRole } from '@/data/types'
import { supabase } from '@/lib/supabase'
import { syncNow } from '@/data/sync/controller'
import { useAccount } from '@/features/account/account'
import { useConfirm } from '@/ui/ConfirmProvider'
import { Button, Card, ErrorNote, Field, Input, Segmented, Select } from '@/ui'
import { rememberSignInReturn } from '@/features/account/returnTo'
import { TravelerLink } from './TravelerLink'
import { becomeOrganizer, removeFromTrip, setAccessMode, setMemberRole, undoRemove } from './actions'

const ROLE_LABEL: Record<TripRole, string> = {
  owner: 'Organizer', admin: 'Organizer', member: '', traveler: 'Traveler', viewer: 'Can view', pending: 'Waiting to join',
}

/** Each person's role, read from the server (organizers only; it needs a connection). */
function useRoles(tripId: string, enabled: boolean, version: number): Record<string, TripRole> {
  const [roles, setRoles] = useState<Record<string, TripRole>>({})
  useEffect(() => {
    if (!enabled || !navigator.onLine) return
    let cancelled = false
    void supabase.from('trip_devices').select('member_id, role').eq('trip_id', tripId).then(({ data }) => {
      if (cancelled || !data) return
      const out: Record<string, TripRole> = {}
      for (const d of data as { member_id: string | null; role: TripRole }[]) if (d.member_id) out[d.member_id] = d.role
      setRoles(out)
    })
    return () => { cancelled = true }
  }, [tripId, enabled, version])
  return roles
}

export function PeopleCard({ trip, members, me }: { trip: Trip; members: Member[]; me: string | null }) {
  const tripId = trip.id
  const confirm = useConfirm()
  const access = useTripAccess(tripId)
  const account = useAccount()
  const staff = isStaff(access)
  const hosted = access.mode === 'hosted'
  const [version, setVersion] = useState(0)
  const roles = useRoles(tripId, staff, version)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const removed = new Set(access.removedMembers)
  const owner = access.role === 'owner'
  const creator = me !== null && trip.created_by === me

  async function run(fn: () => Promise<string | void>) {
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      if (!navigator.onLine) throw new Error('Connect to the internet to change who is on the trip.')
      const m = await fn()
      if (m) setMsg(m)
      await syncNow(tripId)
      setVersion((v) => v + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (m: Member) => {
    const ok = await confirm(`Remove ${m.display_name} from this trip? Their phone loses the trip the next time it syncs, and the invite link is replaced so they can’t join again with it. Share the new link with anyone who still needs it.`)
    if (ok) void run(async () => { await removeFromTrip(tripId, m.id); return `${m.display_name} was removed. The invite link was replaced.` })
  }

  const people = members.filter((m) => !m.deleted_at && !removed.has(m.id))
  const waiting = staff ? people.filter((m) => roles[m.id] === 'pending') : []
  const others = people.filter((m) => !waiting.includes(m))

  return (
    <Card>
      <h2 className="mb-3 ui-section-title">People ({others.length})</h2>

      {waiting.length > 0 && (
        <div className="mb-4 rounded-surface bg-mist/60 p-3">
          <h3 className="text-sm font-semibold text-ink">Waiting to join ({waiting.length})</h3>
          <ul className="mt-2 space-y-2">
            {waiting.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-words">{m.display_name}</span>
                <span className="flex gap-2">
                  <Button className="px-3 text-sm" disabled={busy} onClick={() => void run(async () => { await setMemberRole(tripId, m.id, 'traveler'); return `${m.display_name} can now open the trip.` })}>Let in</Button>
                  <Button variant="secondary" className="px-3 text-sm" disabled={busy} onClick={() => void remove(m)}>Remove</Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="space-y-2">
        {others.map((m) => {
          const role = roles[m.id]
          const isMe = m.id === me
          const label = role ? ROLE_LABEL[role] : ''
          const canChangeRole = staff && hosted && !isMe && role !== 'owner'
          const removable = access.canRemove && !isMe && role !== 'owner'
          return (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <TravelerLink member={m} you={isMe} />
                {label && !canChangeRole && <span className="text-xs text-muted">{label}</span>}
              </span>
              {(canChangeRole || removable) && (
                <span className="flex items-center gap-2">
                  {canChangeRole && (
                    <Select
                      aria-label={`${m.display_name}’s role`}
                      className="w-36"
                      value={role === 'admin' ? 'admin' : role === 'viewer' ? 'viewer' : 'traveler'}
                      disabled={busy}
                      onChange={(e) => void run(async () => { await setMemberRole(tripId, m.id, e.target.value as 'admin' | 'traveler' | 'viewer') })}
                    >
                      <option value="traveler">Traveler</option>
                      <option value="viewer">Can view</option>
                      {(owner || role === 'admin') && <option value="admin">Organizer</option>}
                    </Select>
                  )}
                  {removable && (
                    <button type="button" className="ui-link min-h-11 px-1 text-sm" disabled={busy} onClick={() => void remove(m)}>
                      Remove<span className="sr-only"> {m.display_name}</span>
                    </button>
                  )}
                </span>
              )}
            </li>
          )
        })}
      </ul>

      {access.canRemove && access.removedMembers.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-ink">Removed</h3>
          <ul className="mt-1 space-y-1">
            {members.filter((m) => removed.has(m.id)).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 break-words text-muted">{m.display_name}</span>
                <button type="button" className="ui-link min-h-11 px-1" disabled={busy} onClick={() => void run(async () => { await undoRemove(tripId, m.id); return `${m.display_name} can join again with the invite link.` })}>
                  Let back in<span className="sr-only"> {m.display_name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link className="ui-link" to={`/t/${tripId}/who`}>
        I'm not {members.find((m) => m.id === me)?.display_name ?? 'that person'}
      </Link>

      {staff && (
        <div className="mt-4 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">Who can change the plan</h3>
          <p className="mt-1 text-sm text-muted">
            {hosted
              ? 'Only organizers. Travelers vote, comment, and see their own documents and costs. New people wait for you to let them in.'
              : 'Everyone on the trip, as in any Stowaway trip.'}
          </p>
          <Segmented
            label="Who can change the plan"
            className="mt-3"
            value={access.mode}
            options={[{ value: 'group', label: 'Everyone' }, { value: 'hosted', label: 'Organizers' }]}
            onChange={async (mode) => {
              if (mode === access.mode || busy) return
              const ok = await confirm(mode === 'hosted'
                ? 'Only organizers will change the plan. Travelers keep voting and commenting, but stop seeing other people’s documents and costs, and new people wait for you to let them in. Everyone’s phone reloads the trip.'
                : 'Everyone on the trip will be able to change the plan and see all documents and costs again, and new people join without waiting. Everyone’s phone reloads the trip.')
              if (ok) void run(async () => { await setAccessMode(tripId, mode); return mode === 'hosted' ? 'Only organizers can change the plan now.' : 'Everyone can change the plan now.' })
            }}
          />
        </div>
      )}

      {creator && !access.organized && can(access, 'read') && (
        <div className="mt-4 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">Organize this trip</h3>
          <p className="mt-1 text-sm text-muted">You created this trip. As its organizer you can decide who changes the plan, let people in, and give others roles. Nothing changes for your group until you do.</p>
          {account.kind === 'signed-in'
            ? <OrganizeForm busy={busy} email={account.email} name={members.find((m) => m.id === me)?.display_name ?? ''}
                onClaim={(name, email) => void run(async () => { await becomeOrganizer(tripId, name, email); return 'You’re now this trip’s organizer.' })} />
            : <><p className="mt-2 text-sm">Organizers need an account, so the trip stays yours on any phone.</p><Link className="ui-link" to="/signin" onClick={() => rememberSignInReturn(`/t/${tripId}/more/settings`)}>Sign in or create an account</Link></>}
        </div>
      )}

      {(msg || error) && (
        <div className="mt-3 space-y-2">
          {msg && <p role="status" className="rounded-surface bg-brand-50 px-3 py-2 text-sm text-ink">{msg}</p>}
          <ErrorNote error={error} />
        </div>
      )}
    </Card>
  )
}

/** The organizer profile travelers will see, then the claim. Prefilled, filled in once. */
function OrganizeForm({ busy, email, name, onClaim }: { busy: boolean; email: string | null; name: string; onClaim: (name: string, email: string) => void }) {
  const [displayName, setDisplayName] = useState(name)
  const [supportEmail, setSupportEmail] = useState(email ?? '')
  const submit = (e: FormEvent) => { e.preventDefault(); onClaim(displayName.trim(), supportEmail.trim()) }
  return (
    <form onSubmit={submit} className="mt-3 space-y-3">
      <Field label="Organizer name" hint="What travelers see on trip pages and receipts. A business name or your own.">
        <Input required maxLength={80} value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="organization" />
      </Field>
      <Field label="Email travelers can write to">
        <Input type="email" required value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} autoComplete="email" />
      </Field>
      <Button type="submit" variant="secondary" className="w-full" disabled={busy}>Become the organizer</Button>
    </form>
  )
}
