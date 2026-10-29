import { BedDouble, Bus, Coffee, Plane, Sparkles, Sun, Ticket, type LucideIcon } from 'lucide-react'
import type { ItemKind, ItemStatus } from '@/data/types'

// A restrained journal palette (sage, coral, ocean, slate, dusk, sand, paper) instead of a rainbow.
// Every text colour passes AA on its own tint and on the surface; the icon and label carry the kind.
export const KIND_STYLE: Record<ItemKind, { label: string; Icon: LucideIcon; bg: string; border: string; text: string }> = {
  activity: { label: 'Activity', Icon: Sparkles, bg: 'bg-[#e2ede0]', border: 'border-[#5d7f63]', text: 'text-[#2e5c3c]' },
  meal: { label: 'Meal', Icon: Coffee, bg: 'bg-[#fbe6dd]', border: 'border-[#d9785a]', text: 'text-[#8a3b22]' },
  flight: { label: 'Flight', Icon: Plane, bg: 'bg-mist', border: 'border-action', text: 'text-ink' },
  transport: { label: 'Transport', Icon: Bus, bg: 'bg-[#e6ebea]', border: 'border-control', text: 'text-[#2b4650]' },
  lodging: { label: 'Stay', Icon: BedDouble, bg: 'bg-[#e7e4ef]', border: 'border-[#6f6690]', text: 'text-[#3e3760]' },
  reservation: { label: 'Reservation', Icon: Ticket, bg: 'bg-warning', border: 'border-[#b88a3e]', text: 'text-warning-ink' },
  free: { label: 'Free time', Icon: Sun, bg: 'bg-stone-50', border: 'border-[#a8b0ab]', text: 'text-stone-700' },
}

export const STATUS_TEXT: Record<ItemStatus, string> = {
  idea: 'Idea',
  tentative: 'Tentative',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
}
