import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface JoinedTrip {
  tripId: string
  memberId: string | null // who this device is on the trip ("Who are you?")
  joinedAt: string
}

interface DeviceState {
  trips: Record<string, JoinedTrip>
  timeView: 'trip' | 'device'
  rememberTrip: (tripId: string, memberId?: string | null) => void
  setMember: (tripId: string, memberId: string) => void
  forgetTrip: (tripId: string) => void
  setTimeView: (v: 'trip' | 'device') => void
}

/** Per-device preferences and identity. Trip data itself lives in IndexedDB. */
export const useDevice = create<DeviceState>()(
  persist(
    (set) => ({
      trips: {},
      timeView: 'trip',
      rememberTrip: (tripId, memberId = null) =>
        set((s) => ({
          trips: {
            ...s.trips,
            [tripId]: {
              tripId,
              memberId: memberId ?? s.trips[tripId]?.memberId ?? null,
              joinedAt: s.trips[tripId]?.joinedAt ?? new Date().toISOString(),
            },
          },
        })),
      setMember: (tripId, memberId) =>
        set((s) => ({
          trips: {
            ...s.trips,
            [tripId]: { ...(s.trips[tripId] ?? { tripId, joinedAt: new Date().toISOString() }), memberId },
          },
        })),
      forgetTrip: (tripId) =>
        set((s) => {
          const { [tripId]: _removed, ...rest } = s.trips
          return { trips: rest }
        }),
      setTimeView: (timeView) => set({ timeView }),
    }),
    { name: 'trip-hub-device', version: 1 },
  ),
)

export const useMyMemberId = (tripId: string | undefined) =>
  useDevice((s) => (tripId ? (s.trips[tripId]?.memberId ?? null) : null))
