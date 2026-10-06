import { Link, useRouteError } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/ui'

/** Kept in the main bundle so a missing lazy chunk cannot prevent recovery. */
export function RouteError() {
  const error = useRouteError()
  const message = error instanceof Error ? error.message : String(error)
  const assetError = /dynamically imported module|module script|MIME type|Loading chunk|Importing a module script|preload/i.test(message)

  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        {assetError ? 'The app needs a refresh' : 'This page couldn’t load'}
      </h1>
      <p className="mt-3 leading-relaxed text-stone-600">
        {assetError
          ? 'An app file could not load. This can happen after an update or when your connection drops. Reconnect and reload to try again.'
          : 'Try reloading this page, or return to your trips.'}
      </p>
      <p className="mt-3 text-sm text-stone-600">Reloading keeps your saved trips and offline changes on this device.</p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button onClick={() => window.location.reload()}><RefreshCw aria-hidden="true" className="size-4" />Reload app</Button>
        <Link className="rounded-lg px-2 py-3 font-medium text-brand-700 underline underline-offset-4" to="/app">Your trips</Link>
      </div>
    </main>
  )
}
