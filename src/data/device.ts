import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile } from '@/features/discovery/model'
import { defaultTempUnit, type TempUnit } from '@/lib/weather'

export interface PushPrefs {
  leave: boolean
  vote: boolean
  expense: boolean
  task: boolean
  /** Missing on phones that turned notifications on before comments existed; treated as on. */
  comment?: boolean
}

export interface PushSetting {
  endpoint: string
  prefs: PushPrefs
}

export interface JoinedTrip {
  tripId: string
  memberId: string | null // who this device is on the trip ("Who are you?")
  joinedAt: string
}

interface DeviceState {
  setupDismissed: Record<string, boolean>
  setSetupDismissed: (tripId: string, dismissed: boolean) => void
  /** When this person last looked at each trip's "what's new" (ISO), per trip. */
  activitySeen: Record<string, string>
  setActivitySeen: (tripId: string, at: string) => void
  travelProfile: Profile | null
  setTravelProfile: (profile: Profile) => void
  /** The opening quiz was finished or skipped on this device, so it isn't offered again. */
  quizSeen: boolean
  setQuizSeen: () => void
  trips: Record<string, JoinedTrip>
  timeView: 'trip' | 'device'
  /** auto: offline map when there's no signal and it's downloaded; otherwise the online map. */
  basemap: 'auto' | 'online' | 'offline'
  /** Show money in the trip's settle-up currency or converted to the local one. */
  moneyView: 'base' | 'local'
  setMoneyView: (v: 'base' | 'local') => void
  tempUnit: TempUnit
  setTempUnit: (u: TempUnit) => void
  /** Push notifications this phone has turned on, per trip (the server keeps the subscription). */
  push: Record<string, PushSetting>
  setPush: (tripId: string, setting: PushSetting | null) => void
  setBasemap: (b: 'auto' | 'online' | 'offline') => void
  rememberTrip: (tripId: string, memberId?: string | null) => void
  setMember: (tripId: string, memberId: string) => void
  forgetTrip: (tripId: string) => void
  setTimeView: (v: 'trip' | 'device') => void
}

/** Per-device preferences and identity. Trip data itself lives in IndexedDB. */
export const useDevice = create<DeviceState>()(
  persist(
    (set) => ({
      setupDismissed: {},
      setSetupDismissed: (tripId, dismissed) => set((s) => ({ setupDismissed: { ...s.setupDismissed, [tripId]: dismissed } })),
      activitySeen: {},
      setActivitySeen: (tripId, at) => set((s) => ({ activitySeen: { ...s.activitySeen, [tripId]: at } })),
      travelProfile: null,
      setTravelProfile: (travelProfile) => set({ travelProfile }),
      quizSeen: false,
      setQuizSeen: () => set({ quizSeen: true }),
      trips: {},
      timeView: 'trip',
      basemap: 'auto',
      moneyView: 'base',
      setMoneyView: (moneyView) => set({ moneyView }),
      tempUnit: defaultTempUnit(),
      setTempUnit: (tempUnit) => set({ tempUnit }),
      push: {},
      setPush: (tripId, setting) =>
        set((s) => {
          const { [tripId]: _old, ...rest } = s.push
          return { push: setting ? { ...rest, [tripId]: setting } : rest }
        }),
      setBasemap: (basemap) => set({ basemap }),
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

/** True until this device has a travel profile or the person has skipped the opening quiz. */
export const useQuizPending = () => useDevice((s) => !s.quizSeen && s.travelProfile === null)

export const useMyMemberId =(tripId: string | undefined) =>
  useDevice((s) => (tripId ? (s.trips[tripId]?.memberId ?? null) : null))
