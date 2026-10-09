import { useRef, useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import type { Trip } from '@/data/types'
import { Button, Card, ErrorNote } from '@/ui'
import { shareLink } from './actions'

export function InviteTripCard({ trip }: { trip: Trip }) {
  const [copied, setCopied] = useState(false)
  const [pending, setPending] = useState<'copy' | 'share' | null>(null)
  const inFlight = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const link = shareLink(trip.share_token)

  async function send(action: 'copy' | 'share') {
    if (inFlight.current) return
    const method = action === 'share' && typeof navigator.share === 'function' ? 'share' : 'copy'
    inFlight.current = true
    setPending(method)
    setCopied(false)
    setError(null)
    try {
      if (method === 'copy') {
        await navigator.clipboard.writeText(link)
        setCopied(true)
      } else {
        // The link goes in one field only: with both `text` and `url`, the iPhone share sheet's Copy pastes the link twice.
        await navigator.share({ title: `Join “${trip.name}” on Stowaway`, url: link })
      }
    } catch (e) {
      if (!(method === 'share' && e instanceof Error && e.name === 'AbortError')) {
        setError(method === 'copy' ? 'Could not copy the link. Select the link above and copy it, or try Share.' : 'Could not open sharing. Try Copy instead.')
      }
    } finally {
      inFlight.current = false
      setPending(null)
    }
  }

  return <Card>
    <h2 className="text-lg font-semibold text-brand-900">Invite the group</h2>
    <p className="mt-2 break-words text-sm font-medium text-brand-700">You’re invited to {trip.name}.</p>
    <p className="mt-2 text-sm leading-relaxed text-stone-600">Bring your friends in to save ideas and decide together. Anyone with this link can see and edit the whole trip, so keep it in your group.</p>
    <p className="mt-3 select-all rounded-xl bg-stone-100 p-3 font-mono text-xs break-all">{link}</p>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <Button disabled={pending !== null} aria-busy={pending === 'share'} onClick={() => void send('share')}><Share2 aria-hidden="true" className="size-4" />{pending === 'share' ? 'Sharing…' : 'Share'}</Button>
      <Button variant="secondary" disabled={pending !== null} aria-busy={pending === 'copy'} onClick={() => void send('copy')}>{copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}{pending === 'copy' ? 'Copying…' : copied ? 'Copied' : 'Copy'}</Button>
    </div>
    <div className="mt-3 min-h-10">
      <p role="status" className="text-sm text-brand-700">{pending === 'copy' ? 'Copying your invite link…' : copied ? 'Invite copied. Send it to your friends—there’s room for everyone.' : ''}</p>
      <ErrorNote error={error} />
    </div>
  </Card>
}
