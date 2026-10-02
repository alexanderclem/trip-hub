import { useDevice } from '@/data/device'
import type { Trip } from '@/data/types'
import { convertMinor, rateFor, type RateTable } from '@/lib/fx'
import { formatMoney } from '@/lib/money'

/**
 * Formats base-currency amounts for display, honouring the USD / local toggle. Balances are
 * always computed in the base currency; showing them in quetzales is a display-only conversion
 * at the latest rate, marked with "≈".
 */
export function useMoneyFormat(trip: Trip | undefined, snapshot: RateTable | null) {
  const view = useDevice((s) => s.moneyView)
  const base = trip?.base_currency ?? 'USD'
  const local = trip?.local_currency ?? null
  const rate = local ? rateFor(local, base, snapshot) : null
  const showLocal = view === 'local' && !!local && !!rate && local !== base

  const fmt = (baseMinor: number, opts: { signed?: boolean } = {}) => {
    const value = showLocal ? convertMinor(baseMinor, base, local!, rate!.rate) : baseMinor
    const text = formatMoney(Math.abs(value), showLocal ? local! : base)
    const sign = opts.signed ? (value > 0 ? '+' : value < 0 ? '−' : '') : value < 0 ? '−' : ''
    return `${showLocal ? '≈ ' : ''}${sign}${text}`
  }
  return { fmt, base, local, rate, showLocal }
}
