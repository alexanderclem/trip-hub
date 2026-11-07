import { useEffect } from 'react'
import { CalendarDays, CloudOff, Compass, Smartphone } from 'lucide-react'
import { useDevice, useQuizPending } from '@/data/device'
import { useOnline } from '@/lib/useOnline'
import { mobilePlatform, isStandalone } from '@/features/install/installPrompt'
import { Button, Card, Row } from '@/ui'

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
        {canInstall
          ? <Row to="?install=1" icon={icon(Smartphone)} title="Add Stowaway to your Home Screen" detail="Then the plan, map and tickets work with no signal" />
          : <Row to={`${root}/more/settings`} icon={icon(CloudOff)} title="Get ready for no signal" detail="Save the plan, map and tickets on this phone" />}
        {quizPending && online && <Row to={`/quiz?next=${encodeURIComponent(`${root}/overview`)}`} icon={icon(Compass)} title="How do you like to travel?" detail="10 quick questions, so trip ideas fit you" />}
      </ul>
    </Card>
  )
}
