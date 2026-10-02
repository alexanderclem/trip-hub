// Exchange rates. Source: open.er-api.com (free, no key, covers GTQ; attribution required:
// "Rates By Exchange Rate API"). One snapshot per day is stored with the trip so everything works
// offline; a built-in table covers phones that have never been online.
//
// Convention everywhere: a rate is "units of `currency` per 1 unit of `base`" (e.g. GTQ per USD).

import { toBaseMinor } from './money'

export const FX_ATTRIBUTION = { text: 'Rates By Exchange Rate API', url: 'https://www.exchangerate-api.com' }
export const FX_ENDPOINT = 'https://open.er-api.com/v6/latest/USD'

/** Rough rates per 1 USD, used only when no snapshot exists yet. GTQ has hovered at 7.6–7.85 for years. */
export const FALLBACK_PER_USD: Record<string, number> = {
  USD: 1, GTQ: 7.7, MXN: 18.5, EUR: 0.92, GBP: 0.79, CAD: 1.37, CRC: 510, HNL: 24.7, NIO: 36.7, BZD: 2, SVC: 8.75, COP: 4100, PEN: 3.75, JPY: 150,
}

export interface Rate {
  rate: number // units of currency per 1 base
  source: 'same' | 'snapshot' | 'fallback'
  asOf: string | null
}

export interface RateTable {
  rates: Record<string, number> // per 1 USD
  as_of: string
}

/** How many `currency` one `base` buys, from a USD-based table (crossing via USD if needed). */
export function rateFor(currency: string, base: string, snapshot?: RateTable | null): Rate | null {
  if (currency === base) return { rate: 1, source: 'same', asOf: null }
  const cross = (table: Record<string, number>) => {
    const c = currency === 'USD' ? 1 : table[currency]
    const b = base === 'USD' ? 1 : table[base]
    return c && b ? c / b : null
  }
  const fromSnapshot = snapshot ? cross(snapshot.rates) : null
  if (fromSnapshot) return { rate: fromSnapshot, source: 'snapshot', asOf: snapshot!.as_of }
  const fallback = cross(FALLBACK_PER_USD)
  return fallback ? { rate: fallback, source: 'fallback', asOf: null } : null
}

/** Converts minor units of `from` into minor units of `to`. `rateToPerFrom` = units of `to` per 1 `from`
 *  (e.g. USD → GTQ for display: 7.63). */
export function convertMinor(amountMinor: number, from: string, to: string, rateToPerFrom: number): number {
  if (from === to) return amountMinor
  // toBaseMinor wants "units of `from` per 1 `to`".
  return toBaseMinor(amountMinor, from, 1 / rateToPerFrom, to)
}

/** Fetches today's USD-based rates. Throws on network or API failure. */
export async function fetchRates(fetchFn: typeof fetch = fetch): Promise<RateTable> {
  const res = await fetchFn(FX_ENDPOINT)
  if (!res.ok) throw new Error(`Exchange rates unavailable (HTTP ${res.status})`)
  const j = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_unix?: number }
  if (j.result !== 'success' || !j.rates) throw new Error('Exchange rates unavailable')
  const asOf = new Date((j.time_last_update_unix ?? Date.now() / 1000) * 1000).toISOString().slice(0, 10)
  return { rates: j.rates, as_of: asOf }
}
