import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { save, softDelete } from '@/data/repo'
import type { ExpenseRow, FxSnapshot, SettlementRow } from '@/data/types'
import { fetchRates, type RateTable } from '@/lib/fx'
import { stableId } from '@/lib/ids'

const alive = <T extends { deleted_at?: string | null }>(r: T) => !r.deleted_at

export function useMoney(tripId: string) {
  return useLiveQuery(async () => {
    const [expenses, settlements, snapshots] = await Promise.all([
      db.expenses.where('trip_id').equals(tripId).filter(alive).toArray(),
      db.settlements.where('trip_id').equals(tripId).filter(alive).toArray(),
      db.fx_snapshots.where('trip_id').equals(tripId).filter(alive).toArray(),
    ])
    // Postgres numeric can arrive as a string; normalise once here.
    const num = <T extends { fx_rate: number }>(r: T): T => ({ ...r, fx_rate: Number(r.fx_rate) })
    return {
      expenses: expenses.map(num).sort((a, b) => b.spent_on.localeCompare(a.spent_on) || (b.created_at ?? '').localeCompare(a.created_at ?? '')),
      settlements: settlements.map(num).sort((a, b) => b.paid_on.localeCompare(a.paid_on)),
      snapshot: latestSnapshot(snapshots),
    }
  }, [tripId])
}

export function useExpense(id: string | undefined) {
  return useLiveQuery(async () => {
    const e = id ? await db.expenses.get(id) : undefined
    return e ? { ...e, fx_rate: Number(e.fx_rate) } : e
  }, [id])
}

function latestSnapshot(rows: FxSnapshot[]): (RateTable & { fetched_at: string }) | null {
  const s = rows.filter((r) => r.base === 'USD').sort((a, b) => b.as_of.localeCompare(a.as_of) || b.fetched_at.localeCompare(a.fetched_at))[0]
  return s ? { rates: s.rates, as_of: s.as_of, fetched_at: s.fetched_at } : null
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Keeps a fresh rate snapshot: when online and the newest is over a day old, fetch and store one. */
export function useFxRefresh(tripId: string, snapshotFetchedAt: string | null | undefined, memberId: string | null) {
  useEffect(() => {
    if (snapshotFetchedAt === undefined || !navigator.onLine) return // still loading, or no signal
    if (snapshotFetchedAt && Date.now() - Date.parse(snapshotFetchedAt) < DAY_MS) return
    let cancelled = false
    fetchRates()
      .then(async (t) => {
        if (cancelled) return
        const row: FxSnapshot = {
          id: stableId(tripId, 'fx', 'USD', t.as_of),
          trip_id: tripId,
          base: 'USD',
          rates: t.rates,
          as_of: t.as_of,
          fetched_at: new Date().toISOString(),
          source: 'open.er-api.com',
        }
        await save('fx_snapshots', row, memberId)
      })
      .catch((e) => console.warn('fx refresh failed', e))
    return () => {
      cancelled = true
    }
  }, [tripId, snapshotFetchedAt, memberId])
}

export const saveExpense = (e: ExpenseRow, memberId: string | null) => save('expenses', e, memberId)
export const deleteExpense = (id: string, memberId: string | null) => softDelete('expenses', id, memberId)
export const saveSettlement = (s: SettlementRow, memberId: string | null) => save('settlements', s, memberId)
export const deleteSettlement = (id: string, memberId: string | null) => softDelete('settlements', id, memberId)
