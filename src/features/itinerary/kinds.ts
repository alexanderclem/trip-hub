import { BedDouble, Bus, Coffee, Plane, Sparkles, Sun, Ticket, type LucideIcon } from 'lucide-react'
import type { ItemKind, ItemStatus } from '@/data/types'

// A restrained journal palette (sage, coral, ocean, slate, dusk, sand, paper) instead of a rainbow.
// Every text colour passes AA on its own tint and on the surface; the icon and label carry the kind.
export const KIND_STYLE: Record<ItemKind, { label: string; Icon: LucideIcon; bg: string; border: string; text: string }> = {
  activity: { label: 'Activity', Icon: Sparkles, bg: 'bg-success', border: 'border-success-ink', text: 'text-success-ink' },
  meal: { label: 'Meal', Icon: Coffee, bg: 'bg-meal', border: 'border-meal-ink', text: 'text-meal-ink' },
  flight: { label: 'Flight', Icon: Plane, bg: 'bg-mist', border: 'border-action', text: 'text-ink' },
  transport: { label: 'Transport', Icon: Bus, bg: 'bg-mist', border: 'border-control', text: 'text-ink' },
  lodging: { label: 'Stay', Icon: BedDouble, bg: 'bg-stay', border: 'border-stay-ink', text: 'text-stay-ink' },
  reservation: { label: 'Reservation', Icon: Ticket, bg: 'bg-warning', border: 'border-warning-ink', text: 'text-warning-ink' },
  free: { label: 'Free time', Icon: Sun, bg: 'bg-stone-50', border: 'border-control', text: 'text-stone-700' },
}

export const STATUS_TEXT: Record<ItemStatus, string> = {
  idea: 'Idea',
  tentative: 'Tentative',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
}
