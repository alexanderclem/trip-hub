import { v4, v5 } from 'uuid'

/** Random id for a new row. Generated on the device so rows can be created offline. */
export const newId = (): string => v4()

/**
 * Deterministic id scoped to a trip. The same inputs always give the same id, so one
 * person's vote from two devices, or re-importing the same OSM place, lands on one row.
 */
export const stableId = (tripId: string, ...parts: string[]): string => v5(parts.join('|'), tripId)
