import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight, ClipboardPaste, Link2 } from 'lucide-react'
import { Button, Card, Input } from '@/ui'
import { CardDescription, CardHeader, CardTitle } from '@/ui/collection'
import { joinTargetQuery, parseJoinTarget, parseShareToken } from './actions'

/** "Have an invite?": paste the trip link the group shared, then join. */
export function JoinByLink() {
  const navigate = useNavigate()
  const [link, setLink] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [pasting, setPasting] = useState(false)

  async function pasteFromClipboard() {
    setPasting(true)
    try {
      setLink(await navigator.clipboard.readText())
      setError(null)
      setInvalid(false)
    } catch {
      setError('Could not read the clipboard. Paste the trip link into the box below.')
    } finally {
      setPasting(false)
    }
  }

  function join(event: FormEvent) {
    event.preventDefault()
    const token = parseShareToken(link.trim())
    if (!token) {
      setInvalid(true)
      setError("That doesn't look like a trip link. Copy the full link and try again.")
      return
    }
    navigate(`/join${joinTargetQuery(parseJoinTarget(link))}#t=${token}`)
  }

  return (
    <Card>
      <CardHeader>
        <Link2 aria-hidden="true" className="mb-2 size-5 text-brand-700" />
        <CardTitle>Have an invite?</CardTitle>
        <CardDescription>Paste the link your group shared to join their trip.</CardDescription>
      </CardHeader>
      <form onSubmit={join} className="mt-5">
        <label htmlFor="trip-link" className="text-sm font-medium text-stone-700">Trip link</label>
        <div className="mt-2 flex gap-2">
          <Input id="trip-link" value={link} onChange={(e) => { setLink(e.target.value); setError(null); setInvalid(false) }} placeholder="https://…/join#t=…" className="min-w-0 flex-1" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-invalid={invalid} aria-describedby={error ? 'trip-link-error' : undefined} />
          <Button type="button" variant="secondary" onClick={pasteFromClipboard} disabled={pasting} aria-label="Paste from clipboard" className="px-3"><ClipboardPaste aria-hidden="true" className="size-5" /></Button>
        </div>
        {error && <p id="trip-link-error" role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <Button type="submit" className="mt-4 w-full" disabled={!link.trim()}>Join trip<ArrowRight aria-hidden="true" className="size-4" /></Button>
      </form>
    </Card>
  )
}
