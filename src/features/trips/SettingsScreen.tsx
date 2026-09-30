import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Check, Copy, RefreshCw, Share2, Upload } from 'lucide-react'
import { db } from '@/data/db'
import { useDevice, useMyMemberId } from '@/data/device'
import { useDeadLetters, useMembers, usePendingCount, useTrip } from '@/data/hooks'
import { syncNow, useSyncStatus } from '@/data/sync/controller'
import { importPlaces } from '@/features/places/importPlaces'
import { Avatar, Button, Card, ErrorNote, PageHeader } from '@/ui'
import { rotateShareToken, shareLink } from './actions'

export function SettingsScreen() {
  const { tripId } = useParams() as { tripId: string }
  const navigate = useNavigate()
  const trip = useTrip(tripId)
  const members = useMembers(tripId) ?? []
  const me = useMyMemberId(tripId)
  const pending = usePendingCount()
  const dead = useDeadLetters()
  const sync = useSyncStatus()
  const forgetTrip = useDevice((s) => s.forgetTrip)
  const [copied, setCopied] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!trip) return <PageHeader title="Settings" back={`/t/${tripId}/more`} />
  const link = shareLink(trip.share_token)

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: trip!.name, text: `Join "${trip!.name}" on Trip Hub`, url: link })
        return
      } catch {
        // cancelled; fall through to copy
      }
    }
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function run(fn: () => Promise<string | void>) {
    setError(null)
    setMsg(null)
    try {
      const m = await fn()
      if (m) setMsg(m)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="pb-10">
      <PageHeader title="Trip settings" back={`/t/${tripId}/more`} />
      <div className="mx-auto max-w-md space-y-4 p-4">
        <Card>
          <h2 className="font-semibold">Invite the group</h2>
          <p className="mt-1 text-sm text-stone-500">
            Anyone with this link can see and edit the whole trip. Share it only in your group chat.
          </p>
          <p className="mt-3 rounded-xl bg-stone-100 p-3 font-mono text-xs break-all">{link}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button onClick={share} className="flex items-center justify-center gap-2">
              <Share2 className="size-4" /> Share
            </Button>
            <Button
              variant="secondary"
              className="flex items-center justify-center gap-2"
              onClick={async () => {
                await navigator.clipboard.writeText(link)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <Button
            variant="ghost"
            className="mt-2 w-full text-sm"
            onClick={() => {
              if (confirm('Make a new link? The old link stops working. People who already joined keep access.')) {
                void run(async () => {
                  await rotateShareToken(tripId)
                  return 'New link created.'
                })
              }
            }}
          >
            Replace link
          </Button>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">People ({members.length})</h2>
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <Avatar name={m.display_name} color={m.color} size="sm" />
                <span className="flex-1">{m.display_name}</span>
                {m.id === me && <span className="text-xs text-stone-500">you</span>}
              </li>
            ))}
          </ul>
          <Button variant="ghost" className="mt-2 w-full text-sm" onClick={() => navigate(`/t/${tripId}/who`)}>
            I'm not {members.find((m) => m.id === me)?.display_name ?? 'that person'}
          </Button>
        </Card>

        <Card>
          <h2 className="font-semibold">Import places</h2>
          <p className="mt-1 text-sm text-stone-500">
            Load a places file (from OpenStreetMap) into the idea pool. Safe to repeat: nothing is duplicated.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              void run(async () => {
                const r = await importPlaces(tripId, JSON.parse(await f.text()), me)
                return `Added ${r.added} places${r.skipped ? `, ${r.skipped} were already there` : ''}.`
              })
            }}
          />
          <Button variant="secondary" className="mt-3 flex w-full items-center justify-center gap-2" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> Choose file
          </Button>
        </Card>

        <Card>
          <h2 className="font-semibold">Sync</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <Row k="Status" v={{ idle: 'Up to date', syncing: 'Syncing…', offline: 'Offline', error: 'Problem' }[sync.phase]} />
            <Row k="Waiting to upload" v={String(pending)} />
            <Row k="Last synced" v={sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleTimeString() : 'Not yet'} />
          </dl>
          {sync.lastError && sync.phase !== 'idle' && <p className="mt-2 text-xs text-stone-500">{sync.lastError}</p>}
          <Button variant="secondary" className="mt-3 flex w-full items-center justify-center gap-2" onClick={() => void syncNow(tripId)}>
            <RefreshCw className="size-4" /> Sync now
          </Button>
          {dead.length > 0 && (
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm">
              <p className="font-medium text-red-800">{dead.length} change(s) were rejected by the server</p>
              <ul className="mt-1 space-y-1 text-xs text-red-700">
                {dead.slice(0, 5).map((d) => (
                  <li key={d.id}>
                    {d.table}: {String(d.payload.name ?? d.payload.url ?? d.rowId)} ({d.error})
                  </li>
                ))}
              </ul>
              <Button variant="ghost" className="mt-2 text-xs" onClick={() => void db._deadletter.clear()}>
                Dismiss
              </Button>
            </div>
          )}
        </Card>

        {(msg || error) && (
          <div className="space-y-2">
            {msg && <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">{msg}</p>}
            <ErrorNote error={error} />
          </div>
        )}

        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            if (confirm('Remove this trip from this device? You can re-join with the link.')) {
              forgetTrip(tripId)
              navigate('/', { replace: true })
            }
          }}
        >
          Remove trip from this device
        </Button>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-stone-500">{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}
