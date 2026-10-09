import { useState } from 'react'
import { DateTime } from 'luxon'
import { Check, Copy, Share2 } from 'lucide-react'
import type { Poll, PollOption, Trip } from '@/data/types'
import { Button, ErrorNote } from '@/ui'
import { shareLink } from '@/features/trips/actions'
import { shareText } from './share'

/** Sends a vote to the group chat: the phone's share sheet, or the clipboard where there is none. */
export function useSharePoll(trip: Trip | undefined, poll: Poll | undefined, options: PollOption[]) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = !!trip?.share_token && !!poll
  // Closing times read in the sender's own time, like everywhere else they are shown.
  const message = () => ({
    text: shareText(poll!, options, Date.now(), DateTime.local().zoneName),
    url: shareLink(trip!.share_token, `vote/${poll!.id}`),
  })
  async function copy() {
    if (!ready) return
    setError(null)
    const { text, url } = message()
    try { await navigator.clipboard.writeText(`${text}\n${url}`); setCopied(true) }
    catch { setError('Could not copy the link. Try Share instead.') }
  }
  async function share() {
    if (!ready) return
    setError(null)
    if (!navigator.share) return copy()
    const { text, url } = message()
    // The link rides inside `text`, not `url`: with both, the iPhone share sheet's Copy pastes the link twice.
    try { await navigator.share({ title: poll!.title, text: `${text}\n${url}` }) }
    catch (e) { if (!(e instanceof Error && e.name === 'AbortError')) setError('Could not open sharing. Try Copy instead.') }
  }
  return { share, copy, copied, error, ready }
}

export function SharePollCard({ sharing }: { sharing: ReturnType<typeof useSharePoll> }) {
  const { share, copy, copied, error } = sharing
  return (
    <section aria-labelledby="share-vote-title" className="ui-card border-brand-300 bg-brand-50 p-4">
      <h2 id="share-vote-title" className="font-semibold text-brand-900">Send it to the group</h2>
      <p className="mt-1 text-sm leading-relaxed text-stone-600">Drop this vote in your group chat. The link opens straight to it. Like the invite, it lets anyone who has it join and edit the trip.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button onClick={() => void share()}><Share2 aria-hidden="true" className="size-4" />Share vote</Button>
        <Button variant="secondary" onClick={() => void copy()}>{copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}{copied ? 'Copied' : 'Copy'}</Button>
      </div>
      <div className="mt-3 empty:hidden">{copied && <p role="status" className="text-sm text-brand-700">Copied. Paste it into your group chat.</p>}<ErrorNote error={error} /></div>
    </section>
  )
}
