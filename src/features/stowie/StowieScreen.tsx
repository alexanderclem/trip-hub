import { Link, useParams } from 'react-router'
import { RotateCcw } from 'lucide-react'
import { PageHeader } from '@/ui'
import { StowieChat } from './StowieChat'

/** Stowie as a full page: Home → Help me plan, and a trip's More → Trip ideas. */
export function StowieScreen() {
  const { tripId } = useParams()
  const here = tripId ? `/t/${tripId}/more/ideas` : '/inspire'
  return (
    <StowieChat tripId={tripId} header={(restart) => (
      <PageHeader title="Stowie" back={tripId ? `/t/${tripId}/more` : '/'} action={<>
        <Link to={`${here}/manual`} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-brand-700 hover:bg-brand-50">Edit by hand</Link>
        <button type="button" className="ui-icon-button" aria-label="Start a new chat" onClick={restart}><RotateCcw aria-hidden="true" className="size-5" /></button>
      </>} />
    )} />
  )
}
