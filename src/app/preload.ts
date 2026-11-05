import { matchRoutes, type RouteObject } from 'react-router'

/**
 * Every screen is its own chunk, so a tap would otherwise wait for a download and a parse before
 * anything moves. This warms a screen's code as soon as someone shows intent: a mouse resting on a
 * link, a finger landing on one (about 100 ms before the click), or keyboard focus. The service
 * worker precaches every chunk, so once the app is installed this costs no network at all; it
 * only moves the module evaluation ahead of the tap.
 *
 * Only code is warmed. Screens read IndexedDB, which answers within a frame, so loaders aren't run.
 */
const warmed = new Set<string>()
let routes: RouteObject[] = []

function warm(pathname: string) {
  if (!routes.length || warmed.has(pathname)) return
  warmed.add(pathname)
  for (const { route } of matchRoutes(routes, pathname) ?? []) {
    if (typeof route.lazy === 'function') void (route.lazy as () => Promise<unknown>)().catch(() => warmed.delete(pathname))
  }
}

function pathOf(target: EventTarget | null): string | null {
  const link = (target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
  if (!link || link.target === '_blank' || link.hasAttribute('download')) return null
  const url = new URL(link.href, location.href)
  return url.origin === location.origin ? url.pathname : null
}

/** Listen once, on the document, for intent on any in-app link. */
export function installIntentPreload(all: RouteObject[]) {
  routes = all
  const onIntent = (event: Event) => {
    if (event.type === 'pointerover' && (event as PointerEvent).pointerType !== 'mouse') return
    const path = pathOf(event.target)
    if (path) warm(path)
  }
  for (const type of ['pointerover', 'pointerdown', 'focusin']) document.addEventListener(type, onIntent, { passive: true, capture: true })
}

/** Warm screens someone is likely to open next, once the browser is idle. */
export function preloadPaths(paths: string[]) {
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 600))
  let index = 0
  const next = () => {
    const path = paths[index++]
    if (!path) return
    warm(path)
    idle(next)
  }
  idle(next)
}
