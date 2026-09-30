import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ClipboardPaste, Plus } from 'lucide-react'

export function HomeScreen() {
  const navigate = useNavigate()
  const [link, setLink] = useState('')

  async function pasteFromClipboard() {
    try {
      setLink(await navigator.clipboard.readText())
    } catch {
      // Clipboard permission denied; the user can paste manually.
    }
  }

  return (
    <div className="pt-safe mx-auto max-w-md p-6">
      <h1 className="text-3xl font-bold text-brand-700">Trip Hub</h1>
      <p className="mt-1 text-stone-600">Your group's trips, all in one place.</p>

      <section className="mt-8 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Join a trip</h2>
        <p className="mt-1 text-sm text-stone-500">Paste the trip link someone shared with you.</p>
        <div className="mt-3 flex gap-2">
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://…/join#t=…"
            className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-base"
          />
          <button
            onClick={pasteFromClipboard}
            className="rounded-lg border border-stone-300 px-3"
            aria-label="Paste from clipboard"
          >
            <ClipboardPaste className="size-5" />
          </button>
        </div>
        <button
          disabled={!link.includes('#t=')}
          className="mt-3 w-full rounded-lg bg-brand-600 py-2.5 font-medium text-white disabled:opacity-40"
        >
          Join
        </button>
      </section>

      <button
        onClick={() => navigate('/t/demo/map')}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 py-4 text-stone-600"
      >
        <Plus className="size-5" /> Create a trip
      </button>
    </div>
  )
}
