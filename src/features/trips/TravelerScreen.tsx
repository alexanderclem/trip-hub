import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { useMyMemberId } from '@/data/device'
import { useMembers } from '@/data/hooks'
import { save } from '@/data/repo'
import type { Member } from '@/data/types'
import { useItems } from '@/features/itinerary/data'
import { useMoney } from '@/features/money/data'
import { useTasks } from '@/features/tasks/data'
import { usePacking } from '@/features/packing/data'
import { formatMoney } from '@/lib/money'
import { Avatar, Button, Card, ErrorNote, Field, Input, LinkButton, PageHeader, Select } from '@/ui'
import { normalizeVenmo, profilePhoto } from './traveler'
import { formatDate } from '@/lib/time'
import { ListSkeleton } from '@/ui/collection'

export function TravelerScreen() {
  const { tripId, memberId } = useParams() as { tripId: string; memberId: string }
  const me = useMyMemberId(tripId)
  const members = useMembers(tripId)
  const member = members?.find((m) => m.id === memberId)
  const items = useItems(tripId)
  const money = useMoney(tripId)
  const tasks = useTasks(tripId)
  const packing = usePacking(tripId)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const root = `/t/${tripId}`

  async function assign(id: string) {
    const item = items?.find((i) => i.id === id)
    if (!item || pending) return
    setPending(true); setError(null)
    try { await save('itinerary_items', { ...item, attendee_ids: [...new Set([...(item.attendee_ids ?? []), memberId])] }, me) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not assign this event. Try again.') }
    finally { setPending(false) }
  }

  return <div className="pb-24">
    <PageHeader title={member?.display_name ?? 'Traveler'} back={`${root}/overview`} />
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      {!members ? <ListSkeleton label="Loading traveler…" /> : !member ? <p>This traveler is no longer in the trip.</p> : <>
        <Card><div className="flex items-center gap-3"><Avatar name={member.display_name} color={member.color} photo={member.avatar_url} /><div className="min-w-0"><h2 className="break-words text-xl font-semibold">{member.display_name}{memberId === me ? ' (you)' : ''}</h2><p className="text-sm text-stone-600">Events and responsibilities for this trip</p></div></div>
          {member.venmo_username && <a href={`https://venmo.com/u/${encodeURIComponent(member.venmo_username)}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-lg px-2 font-medium text-brand-700 hover:bg-brand-50">Open Venmo · @{member.venmo_username}</a>}
        </Card>
        <ProfileEditor key={member.id} member={member} me={me} />
        <Assignments title="Plans & events" loading={!items} empty="No events assigned yet." action={<LinkButton variant="ghost" to={`${root}/plan/new?attendee=${memberId}`}>Add an event</LinkButton>}>
          {items?.filter((i) => i.attendee_ids === null || i.attendee_ids.includes(memberId)).map((i) => <Assignment key={i.id} to={`${root}/plan/${i.id}`} title={i.title} detail={`${i.start_local.replace('T', ' · ')} · ${i.attendee_ids === null ? 'Everyone' : 'Assigned'} · ${i.status}`} />)}
        </Assignments>
        {items?.some((i) => i.attendee_ids !== null && !i.attendee_ids.includes(memberId)) && <Card><Field label="Assign an existing event"><Select value="" disabled={pending} onChange={(e) => void assign(e.target.value)}><option value="">Choose an event…</option>{items.filter((i) => i.attendee_ids !== null && !i.attendee_ids.includes(memberId)).map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}</Select></Field><ErrorNote error={error} /></Card>}
        <Assignments title="Expenses" loading={!money} empty="No expenses linked yet." action={<LinkButton variant="ghost" to={`${root}/money/new`}>Add an expense</LinkButton>}>
          {money?.expenses.filter((e) => e.payers.some((p) => p.member_id === memberId) || e.split.some((s) => s.member_id === memberId)).map((e) => <Assignment key={e.id} to={`${root}/money/${e.id}`} title={e.description} detail={`${formatMoney(e.amount_minor, e.currency)} · ${e.payers.some((p) => p.member_id === memberId) ? 'Paid' : 'Included in split'} · ${e.spent_on}`} />)}
        </Assignments>
        <Assignments title="Tasks" loading={!tasks} empty="No tasks assigned yet." action={<LinkButton variant="ghost" to={`${root}/more/tasks/new?assignee=${memberId}`}>Assign a task</LinkButton>}>
          {tasks?.filter((t) => t.assignee_id === memberId).map((t) => <Assignment key={t.id} to={`${root}/more/tasks/${t.id}`} title={t.title} detail={`${t.completed ? 'Completed' : 'To do'}${t.due_date ? ` · Due ${formatDate(t.due_date)}` : ''}`} />)}
        </Assignments>
        <Assignments title="Packing" loading={!packing} empty="No packing items assigned yet." action={<LinkButton variant="ghost" to={`${root}/more/packing`}>Manage packing</LinkButton>}>
          {packing?.items.filter((i) => i.owner_id === memberId || i.kind === 'everyone').map((i) => <Assignment key={i.id} to={`${root}/more/packing/${i.id}`} title={i.title} detail={`${i.kind === 'everyone' ? 'Everyone' : 'Assigned'} · ${(i.kind === 'everyone' ? packing.checks.some((c) => !c.deleted_at && c.item_id === i.id && c.member_id === memberId && c.state === 'packed') : i.packed) ? 'Packed' : 'To pack'}`} />)}
        </Assignments>
      </>}
    </div>
  </div>
}

function Assignment({ to, title, detail }: { to: string; title: string; detail: string }) {
  return <li className="border-b border-stone-100 last:border-0"><Link to={to} className="block min-h-11 rounded-lg py-3 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-700"><p className="break-words font-medium text-brand-700">{title}</p><p className="break-words text-sm text-stone-600">{detail}</p></Link></li>
}
function Assignments({ title, loading, empty, action, children }: { title: string; loading: boolean; empty: string; action: ReactNode; children: ReactNode[] | undefined }) {
  return <Card><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{title}</h2>{action}</div>{loading ? <ListSkeleton label="Loading…" rows={2} className="py-3" /> : children?.length ? <ul>{children}</ul> : <p className="py-3 text-sm text-stone-600">{empty}</p>}</Card>
}
function ProfileEditor({ member, me }: { member: Member; me: string | null }) {
  const [name, setName] = useState(member.display_name)
  const [venmo, setVenmo] = useState(member.venmo_username ?? '')
  const [photo, setPhoto] = useState(member.avatar_url ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  return <Card><details><summary className="min-h-11 cursor-pointer py-2 font-medium text-brand-700">Edit traveler profile</summary><form className="mt-3 space-y-4" onSubmit={async (e) => {
    e.preventDefault(); setBusy(true); setError(null); setMessage(null)
    try {
      if (!name.trim() || name.trim().length > 100) throw new Error('Use a name between 1 and 100 characters.')
      await save('members', { ...member, display_name: name.trim(), venmo_username: normalizeVenmo(venmo), avatar_url: photo }, me)
      setMessage('Profile saved on this device. Changes sync when online.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save your profile. Try again.') }
    finally { setBusy(false) }
  }}>
    <Field label="Traveler name"><Input value={name} maxLength={100} required onChange={(e) => setName(e.target.value)} /></Field>
    <Field label="Venmo username or profile link"><Input value={venmo} placeholder="@your-username" onChange={(e) => setVenmo(e.target.value)} /><p className="mt-1 text-sm text-stone-600">Visible to your trip group. Opens your Venmo profile to pay in Venmo.</p></Field>
    <div className="flex flex-wrap items-center gap-3"><Avatar name={name} color={member.color} photo={photo} /><Field label="Profile photo"><Input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async (e) => {
      const file = e.target.files?.[0]; if (!file) return
      setBusy(true); setError(null); setMessage(null)
      try { setPhoto(await profilePhoto(file)) } catch (err) { setError(err instanceof Error ? err.message : 'Could not read photo.') } finally { setBusy(false) }
      e.target.value = ''
    }} /></Field></div>
    <p className="text-sm text-stone-600">Photos are cropped to a square. Without a photo, your bubble shows your initials.</p>
    {photo && <Button type="button" variant="ghost" disabled={busy} onClick={() => setPhoto(null)}>Remove photo</Button>}
    <ErrorNote error={error} />{message && <p role="status" className="text-sm text-brand-700">{message}</p>}
    <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</Button>
  </form></details></Card>
}
