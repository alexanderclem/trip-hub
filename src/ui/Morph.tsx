import { ViewTransition, type ReactElement } from 'react'
import { useMotionPreference } from './MotionProvider'

/**
 * Marks one element as "the same thing" across two screens: a plan row's icon, title and time, a
 * place's name, a ticket's confirmation code. When a navigation unmounts one and mounts the other
 * with the same name, the browser carries it from its old spot to its new one (View Transitions;
 * Safari 18+, Chromium). Elsewhere, and with reduced motion, the page keeps its plain fade.
 *
 * A name must be on screen at most once, so pass one only where an id appears once per screen.
 * The child must be a single element: the name lands on it. An empty name renders it plainly.
 */
export function Morph({ name, text = false, children }: {
  name: string
  /** Wrapping text (a title): travel at its own size and cross-fade, since a reflowed snapshot can't scale cleanly. */
  text?: boolean
  children: ReactElement
}) {
  const reduced = useMotionPreference()
  if (reduced || !name) return children
  return <ViewTransition name={name} share={text ? 'stowaway-morph-text' : 'stowaway-morph'} default="none">{children}</ViewTransition>
}

/** Names for the parts of a record that travel between its list row and its own screen. */
export const morphName = (kind: 'plan' | 'place' | 'ticket' | 'pick', id: string, part: 'icon' | 'title' | 'time' | 'code' | 'stamp') => `${kind}-${part}-${id}`
