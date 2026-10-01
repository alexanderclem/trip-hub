import { BedDouble, Bus, Coffee, Plane, Sparkles, Sun, Ticket, type LucideIcon } from 'lucide-react'
import type { ItemKind, ItemStatus } from '@/data/types'

export const KIND_STYLE: Record<ItemKind, { label: string; Icon: LucideIcon; bg: string; border: string; text: string }> = {
  activity: { label: 'Activity', Icon: Sparkles, bg: 'bg-green-50', border: 'border-green-600', text: 'text-green-900' },
  meal: { label: 'Meal', Icon: Coffee, bg: 'bg-orange-50', border: 'border-orange-500', text: 'text-orange-900' },
  flight: { label: 'Flight', Icon: Plane, bg: 'bg-blue-50', border: 'border-blue-600', text: 'text-blue-900' },
  transport: { label: 'Transport', Icon: Bus, bg: 'bg-slate-100', border: 'border-slate-500', text: 'text-slate-900' },
  lodging: { label: 'Stay', Icon: BedDouble, bg: 'bg-violet-50', border: 'border-violet-600', text: 'text-violet-900' },
  reservation: { label: 'Reservation', Icon: Ticket, bg: 'bg-amber-50', border: 'border-amber-500', text: 'text-amber-900' },
  free: { label: 'Free time', Icon: Sun, bg: 'bg-stone-50', border: 'border-stone-400', text: 'text-stone-700' },
}

export const STATUS_TEXT: Record<ItemStatus, string> = {
  idea: 'Idea',
  tentative: 'Tentative',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
}
