import { TravelerLink } from './TravelerLink'
import { useConfirm } from '@/ui/ConfirmProvider'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { useDevice, useMyMemberId } from '@/data/device'
import { useMembers, useTrip } from '@/data/hooks'
import { SyncCard } from '@/features/sync/SyncStatus'
import { InviteTripCard } from './InviteTripCard'
import { LoadingState } from '@/ui/LoadingState'
import { DestinationsCard } from '@/features/destinations/DestinationsCard'
import { requestLegs } from '@/features/routing/requestLegs'
import { OfflineMapCard } from '@/features/map/offline/OfflineMapCard'
import { OfflineReadyCard } from '@/features/offline/OfflineReadyCard'
import { NotificationsCard } from '@/features/notifications/NotificationsCard'
import { save } from '@/data/repo'
import { Button, Card, Disclosure, ErrorNote, PageHeader, SectionTitle, Segmented } from '@/ui'
import { rotateShareToken } from './actions'

export function SettingsScreen() {
  const confirm = useConfirm()
  const { tripId } = useParams() as { tripId: string }
  const navigate = useNavigate()
  const trip = useTrip(tripId)
  const members = useMembers(tripId) ?? []
  const me = useMyMemberId(tripId)
  const forgetTrip = useDevice((s) => s.forgetTrip)
  const [legs, setLegs] = useState<{ busy: boolean; msg: string | null; error: string | null }>({ busy: false, msg: null, error: null })
  const tempUnit = useDevice((s) => s.tempUnit)
  const setTempUnit = useDevice((s) => s.setTempUnit)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!trip) return <LoadingState fullScreen title="Loading trip settings…" />

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
          <SectionTitle>Invite the group</SectionTitle>
          <div className="mt-2"><InviteTripCard trip={trip} bare /></div>
          <button
            type="button"
            className="ui-link"
            onClick={async () => {
              if (await confirm('Make a new link? The old link stops working. People who already joined keep access.')) {
                void run(async () => {
                  await rotateShareToken(tripId)
                  return 'New link created.'
                })
              }
            }}
          >
            Replace link
          </button>
          {(msg || error) && (
            <div className="space-y-2">
              {msg && <p role="status" className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">{msg}</p>}
              <ErrorNote error={error} />
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 ui-section-title">People ({members.length})</h2>
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <TravelerLink member={m} you={m.id === me} />
              </li>
            ))}
          </ul>
          <Link className="ui-link" to={`/t/${tripId}/who`}>
            I'm not {members.find((m) => m.id === me)?.display_name ?? 'that person'}
          </Link>
        </Card>

        <DestinationsCard trip={trip} me={me} />

        <OfflineReadyCard trip={trip} />

        <OfflineMapCard trip={trip} />

        <NotificationsCard tripId={tripId} />

        <Card>
          <SectionTitle>On this phone</SectionTitle>
          <div className="mt-3 flex items-center justify-between gap-3 text-sm">
            <span>Temperatures</span>
            <Segmented label="Temperatures" value={tempUnit} onChange={setTempUnit} options={[{ value: 'F', label: '°F' }, { value: 'C', label: '°C' }]} className="w-28" />
          </div>
        </Card>

        {/* Rarely touched: how travel times are padded, and what is waiting to sync. */}
        <Disclosure summary="Advanced" className="px-1">
          <div className="space-y-4">
        <Card>
              <h2 className="ui-section-title">Travel times</h2>
              <p className="mt-1 text-sm text-stone-600">
                Calculated automatically for shortlisted, planned and booked places. Road times are multiplied by this range
                to allow for traffic and delays along the way.
              </p>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span>Road time ×</span>
                <FactorInput value={trip.route_factor_low} onSave={(v) => save('trips', { ...trip, route_factor_low: v, route_factor_high: Math.max(v, trip.route_factor_high) }, me)} />
                <span>to</span>
                <FactorInput value={trip.route_factor_high} onSave={(v) => save('trips', { ...trip, route_factor_high: Math.max(v, trip.route_factor_low) }, me)} />
              </div>
              <Button
                variant="secondary"
                className="mt-3 flex w-full items-center justify-center gap-2"
                disabled={legs.busy}
                onClick={async () => {
                  setLegs({ busy: true, msg: null, error: null })
                  try {
                    if (!navigator.onLine) throw new Error('Connect to the internet to recalculate travel times.')
                    const r = await requestLegs(tripId)
                    const via = r.providers.includes('ors') ? 'OpenRouteService' : r.providers.includes('osrm') ? 'the public OSRM server' : 'no routing service'
                    setLegs({ busy: false, error: null, msg: `Calculated ${r.legs} travel times between ${r.places ?? 0} places via ${via}.${r.warnings.length ? ' ' + r.warnings.join(' ') : ''}` })
                  } catch (e) {
                    setLegs({ busy: false, msg: null, error: e instanceof Error ? e.message : String(e) })
                  }
                }}
              >
                <RefreshCw aria-hidden="true" className={`size-4 ${legs.busy ? 'animate-spin' : ''}`} /> {legs.busy ? 'Calculating…' : 'Recalculate now'}
              </Button>
              {legs.msg && <p role="status" className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">{legs.msg}</p>}
              <div className="mt-3 empty:hidden"><ErrorNote error={legs.error} /></div>
            </Card>

            <SyncCard tripId={tripId} />
          </div>
        </Disclosure>

        <Button
          variant="danger"
          className="w-full"
          onClick={async () => {
            if (await confirm('Remove this trip from this device? You can re-join with the link.')) {
              forgetTrip(tripId)
              navigate('/app', { replace: true })
            }
          }}
        >
          Remove trip from this device
        </Button>
      </div>
    </div>
  )
}

function FactorInput({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [text, setText] = useState(String(value))
  return (
    <input
      inputMode="decimal"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const v = Number(text)
        if (v >= 1 && v <= 4) onSave(Math.round(v * 10) / 10)
        else setText(String(value))
      }}
      className="w-14 rounded-lg border border-stone-300 px-2 py-1 text-center"
      aria-label="Road time multiplier"
    />
  )
}
