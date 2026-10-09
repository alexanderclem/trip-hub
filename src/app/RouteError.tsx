import { Link, useRouteError } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { Button, LinkButton } from '@/ui'
import { Brand } from '@/ui/Brand'

/** Kept in the main bundle so a missing lazy chunk cannot prevent recovery. */
export function RouteError() {
  const error = useRouteError()
  const message = error instanceof Error ? error.message : String(error)
  const assetError = /dynamically imported module|module script|MIME type|Loading chunk|Importing a module script|preload/i.test(message)

  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <Link to="/app" aria-label="Stowaway — your trips" className="mb-8 inline-flex"><Brand /></Link>
      <h1 className="travel-heading text-3xl text-brand-900">
        {assetError ? 'The app needs a refresh' : 'This page couldn’t load'}
      </h1>
      <p className="mt-3 leading-relaxed text-stone-600">
        {assetError
          ? 'An app file could not load. This can happen after an update or when your connection drops. Reconnect and reload to try again.'
          : 'Try reloading this page, or return to your trips.'}
      </p>
      <p className="mt-3 text-sm text-stone-600">Reloading keeps your saved trips and offline changes on this device.</p>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button onClick={() => window.location.reload()}><RefreshCw aria-hidden="true" className="size-4" />Reload app</Button>
        <LinkButton variant="secondary" to="/app">Your trips</LinkButton>
      </div>
    </main>
  )
}
