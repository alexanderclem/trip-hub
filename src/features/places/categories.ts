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
  // Journal tones rather than a rainbow; each keeps a white icon at AA on the pin.
  lodging: { label: 'Lodging', color: '#5e5585', Icon: BedDouble },
  food: { label: 'Food', color: '#b5502f', Icon: UtensilsCrossed },
  drink: { label: 'Drinks', color: '#a2426a', Icon: Martini },
  activity: { label: 'Activity', color: '#4a7553', Icon: Sparkles },
  sight: { label: 'Sight', color: '#2b6a79', Icon: Camera },
  reservation: { label: 'Reservation', color: '#8f6319', Icon: Ticket },
  transport: { label: 'Transport', color: '#52646a', Icon: Bus },
  flight: { label: 'Flight', color: '#295361', Icon: Plane },
  shopping: { label: 'Shopping', color: '#84497a', Icon: ShoppingBag },
  other: { label: 'Other', color: '#68716f', Icon: CircleDot },
}

export const STATUS_LABEL: Record<PlaceStatus, string> = {
  catalog: 'Idea pool',
  shortlist: 'Shortlist',
  planned: 'Planned',
  booked: 'Booked',
  visited: 'Visited',
  rejected: 'Nope',
}
