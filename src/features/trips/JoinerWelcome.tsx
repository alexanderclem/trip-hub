import { useEffect } from 'react'
import { CalendarDays, CloudOff, Compass, Smartphone } from 'lucide-react'
import { useDevice, useQuizPending } from '@/data/device'
import { useOnline } from '@/lib/useOnline'
import { mobilePlatform, isStandalone } from '@/features/install/installPrompt'
import { Button, Card, Row } from '@/ui'
import { useAttachments } from '@/features/tickets/files'

/**
 * Someone who just tapped the trip link from a group chat lands here knowing nothing about the app.
 * Three starting points, until they close it. Creators never see it: only a join marks it.
 * `setupDismissed[trip]`: false = show the welcome, true = closed, missing = never joined by link.
 */
export function JoinerWelcome({ tripId, justJoined }: { tripId: string; justJoined: boolean }) {
  const state = useDevice((s) => s.setupDismissed[tripId])
  const setDismissed = useDevice((s) => s.setSetupDismissed)
  const quizPending = useQuizPending()
  const online = useOnline()
  const tickets = useAttachments(tripId)
  useEffect(() => {
    if (justJoined && useDevice.getState().setupDismissed[tripId] === undefined) setDismissed(tripId, false)
  }, [justJoined, tripId, setDismissed])
  if (state !== false && !(justJoined && state === undefined)) return null

  const root = `/t/${tripId}`
  const icon = (Icon: typeof Compass) => <Icon aria-hidden="true" className="size-5" />
  const canInstall = mobilePlatform() !== null && !isStandalone()
  return (
    <Card title="You’re in" labelledBy="joiner-welcome-title"
      action={<Button variant="ghost" onClick={() => setDismissed(tripId, true)}>Got it</Button>}>
      <p className="mt-1 text-sm text-muted">Everyone on the trip sees the same plan, votes and expenses. Start here:</p>
      <ul className="ui-row-group mt-3">
        <Row to={`${root}/plan`} icon={icon(CalendarDays)} title="See the plan so far" detail="Day by day, in the trip’s time zone" />
        <Row to={`${root}/more/settings#offline-ready`} icon={icon(CloudOff)} title="Prepare this phone for no signal" detail={tickets === undefined ? 'Checking ticket files on this phone…' : tickets.length ? `${tickets.filter((ticket) => ticket.onPhone).length} of ${tickets.length} ticket files on this phone. Check plan and map downloads in Trip settings.` : 'Download and check the plan, tickets and maps in Trip settings.'} />
        {canInstall && <Row to="?install=1" icon={icon(Smartphone)} title="Add Stowaway to your Home Screen" detail="An optional shortcut. Downloads are a separate step." />}
        {quizPending && online && <Row to={`/quiz?next=${encodeURIComponent(`${root}/overview`)}`} icon={icon(Compass)} title="How do you like to travel?" detail="10 quick questions, so trip ideas fit you" />}
      </ul>
    </Card>
  )
}
