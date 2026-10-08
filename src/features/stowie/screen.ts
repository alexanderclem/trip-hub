import type { Screen } from './script'

/**
 * The trip screen a path shows, for Stowie's first suggestions there. null means Stowie stays out
 * of the way: forms, the ticket viewer, emergency cards, settings, and the chat's own page.
 */
export function screenOf(pathname: string): { screen: Screen; placeId?: string } | null {
  const rest = pathname.match(/^\/t\/[^/]+\/(.*?)\/?$/)?.[1]
  if (rest === undefined) return null
  const place = rest.match(/^more\/places\/([^/]+)$/)?.[1]
  if (place) return place === 'new' ? null : { screen: 'place', placeId: place }
  if (/^plan\/[^/]+$/.test(rest)) return rest === 'plan/new' ? null : { screen: 'plan' }
  if (/^more\/vote(\/[^/]+)?$/.test(rest)) return { screen: 'votes' }
  const exact: Record<string, Screen> = {
    overview: 'overview', activity: 'overview', more: 'overview', map: 'map', plan: 'plan', tickets: 'tickets', money: 'money',
    'more/tasks': 'tasks', 'more/packing': 'packing', 'more/places': 'places',
  }
  const screen = exact[rest]
  return screen ? { screen } : null
}
