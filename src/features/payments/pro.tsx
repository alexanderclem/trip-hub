// Pro (20261102000001_pro.sql): the organizer plan for repeat-business tools, free during the beta.
// The server enforces it; this only decides what to offer. The last answer is kept for offline use.

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface MyOrganizer {
  id: string
  display_name: string
  support_email: string
  slug: string
  reviewed: boolean
  pro: boolean
  beta: boolean
  postal_address?: string | null
  /** Campaign mail goes out only once Stowaway has a sender on its own domain. */
  campaign_sending?: boolean
  /** The credit a traveler earns for each friend who books (0 = off). */
  referral_credit_minor?: number
}

const KEY = 'stowaway-my-organizer'

const cached = (): MyOrganizer | null => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') as MyOrganizer | null } catch { return null }
}

/** The signed-in person's organizer profile and plan, or null if they don't organize trips. */
export function useMyOrganizer(): MyOrganizer | null {
  const [me, setMe] = useState<MyOrganizer | null>(cached)
  useEffect(() => {
    if (!navigator.onLine) return
    let cancelled = false
    void supabase.rpc('my_organizer').then(({ data, error }) => {
      if (cancelled || error) return // an older server without Pro keeps the cached answer
      const value = (data as MyOrganizer | null) ?? null
      try { localStorage.setItem(KEY, JSON.stringify(value)) } catch { /* private mode */ }
      setMe(value)
    })
    return () => { cancelled = true }
  }, [])
  return me
}

/** Marks a Pro tool; during the beta it says it's free, so nobody is surprised later. */
export function ProBadge({ beta = true }: { beta?: boolean }) {
  return <span className="ml-2 inline-flex items-center rounded-control border border-line px-1.5 py-0.5 text-xs font-medium text-muted">Pro{beta ? ' · free during beta' : ''}</span>
}
