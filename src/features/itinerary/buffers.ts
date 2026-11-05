import type { ItineraryItem } from '@/data/types'

export function bufferMinutes(value: string | undefined): number {
  const minutes = Number(value ?? 0)
  return Number.isInteger(minutes) && minutes >= 0 && minutes <= 1440 ? minutes : 0
}

export function arrivalBuffers(item: Pick<ItineraryItem, 'details'>) {
  const checkIn = bufferMinutes(item.details.check_in_minutes)
  const waiting = bufferMinutes(item.details.waiting_minutes)
  return { checkIn, waiting, totalS: (checkIn + waiting) * 60 }
}
