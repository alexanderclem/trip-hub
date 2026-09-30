import {
  BedDouble,
  Bus,
  Camera,
  CircleDot,
  Martini,
  Plane,
  ShoppingBag,
  Sparkles,
  Ticket,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import type { PlaceCategory, PlaceStatus } from '@/data/types'

export const CATEGORY_STYLE: Record<PlaceCategory, { label: string; color: string; Icon: LucideIcon }> = {
  lodging: { label: 'Lodging', color: '#7c3aed', Icon: BedDouble },
  food: { label: 'Food', color: '#ea580c', Icon: UtensilsCrossed },
  drink: { label: 'Drinks', color: '#db2777', Icon: Martini },
  activity: { label: 'Activity', color: '#16a34a', Icon: Sparkles },
  sight: { label: 'Sight', color: '#0891b2', Icon: Camera },
  reservation: { label: 'Reservation', color: '#ca8a04', Icon: Ticket },
  transport: { label: 'Transport', color: '#475569', Icon: Bus },
  flight: { label: 'Flight', color: '#2563eb', Icon: Plane },
  shopping: { label: 'Shopping', color: '#be185d', Icon: ShoppingBag },
  other: { label: 'Other', color: '#78716c', Icon: CircleDot },
}

export const STATUS_LABEL: Record<PlaceStatus, string> = {
  catalog: 'Idea pool',
  shortlist: 'Shortlist',
  planned: 'Planned',
  booked: 'Booked',
  visited: 'Visited',
  rejected: 'Nope',
}
