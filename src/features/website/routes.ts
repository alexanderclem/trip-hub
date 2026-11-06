import { publicPages } from './metadata'

/** Old addresses kept working with a permanent redirect. */
export const redirects: Record<string, string> = { '/operators': '/organizers' }

/** Top-level segments that belong to the app (trips, joining, accounts, organizer tools). Never indexed. */
const APP = /^\/(app|quiz|new|inspire|join|signin|auth|oauth|connections|travel-history|organize|unsubscribe|b|go|t)(\/|$)/

export type PathKind =
  | { kind: 'asset' }
  | { kind: 'page' }
  | { kind: 'app' }
  | { kind: 'redirect'; to: string }
  | { kind: 'missing' }

/**
 * What the Worker does with a path: files go to static assets, website pages are served as built,
 * app routes get the app shell (noindex), old addresses redirect, and everything else is a 404.
 */
export function classifyPath(pathname: string): PathKind {
  if (/\.[a-z0-9]+$/i.test(pathname)) return { kind: 'asset' }
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const to = redirects[path]
  if (to) return { kind: 'redirect', to }
  if (publicPages[path]) return { kind: 'page' }
  if (APP.test(path)) return { kind: 'app' }
  return { kind: 'missing' }
}
