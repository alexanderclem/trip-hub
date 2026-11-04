// A detail screen's own row, read by its route loader before the navigation commits.
//
// Live queries answer a moment after a screen mounts, so a detail screen's first frame used to be
// empty and its content arrived outside the navigation's transition. Reading the one row up front
// (IndexedDB, a few milliseconds, no network) lets the screen draw its icon, title and time in the
// same commit that removes the list, which is what lets those elements morph across (src/ui/Morph.tsx).
// The live query takes over as soon as it answers, so edits and sync still show up as before.

import { useLoaderData, type LoaderFunctionArgs } from 'react-router'
import { db } from './db'

type Table = 'itinerary_items' | 'places' | 'attachments'

/** A route loader returning the row named by a URL parameter, or null. */
export const rowLoader = (table: Table, param: string) => async ({ params }: LoaderFunctionArgs) => {
  const id = params[param]
  return id ? ((await db.table(table).get(id)) ?? null) : null
}

/** The live row once it has answered; until then, the row the loader read for this same id. */
export function useFirstRow<T extends { id: string }>(id: string | undefined, live: T | undefined): T | undefined {
  const first = useLoaderData() as T | null | undefined
  return live ?? (first && first.id === id ? first : undefined)
}
