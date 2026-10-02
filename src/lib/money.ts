// Money is always integer minor units (cents, centavos). Floats only appear
// transiently during FX conversion and are rounded immediately.

export type MemberId = string

export type SplitMethod = 'equal' | 'shares' | 'exact' | 'percent'

export interface Expense {
  id: string
  amount_minor: number // in `currency`
  currency: string
  fx_rate: number // units of `currency` per 1 unit of base currency
  base_currency: string
  base_amount_minor: number
  payers: { member_id: MemberId; amount_minor: number }[] // original currency, sums to amount_minor
  split_method: SplitMethod
  // equal: value ignored; shares: integer weight; exact: minor units (original currency);
  // percent: basis points summing to 10000
  split: { member_id: MemberId; value: number }[]
  deleted_at?: string | null
}

export interface Settlement {
  id: string
  from_member_id: MemberId
  to_member_id: MemberId
  base_amount_minor: number
  deleted_at?: string | null
}

export interface Transfer {
  from: MemberId
  to: MemberId
  amount_minor: number
}

const exponentCache = new Map<string, number>()

/** Number of decimal places for a currency (USD/GTQ 2, JPY 0). */
export function minorUnits(currency: string): number {
  let e = exponentCache.get(currency)
  if (e === undefined) {
    e = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
    exponentCache.set(currency, e)
  }
  return e
}

export function roundHalfEven(x: number): number {
  const r = Math.round(x)
  // Math.round rounds .5 up; correct exact ties toward the even neighbour.
  if (Math.abs(x % 1) === 0.5 && r % 2 !== 0) return r - 1
  return r
}

/** Converts an amount in `currency` to base-currency minor units. */
export function toBaseMinor(
  amount_minor: number,
  currency: string,
  fx_rate: number,
  base_currency: string,
): number {
  if (currency === base_currency) return amount_minor
  if (!(fx_rate > 0)) throw new Error(`Invalid FX rate ${fx_rate} for ${currency}`)
  const scale = 10 ** (minorUnits(base_currency) - minorUnits(currency))
  // Round to 6 dp first so float noise can't turn an exact .5 into .4999999.
  const exact = Number(((amount_minor * scale) / fx_rate).toFixed(6))
  return roundHalfEven(exact)
}

/** FNV-1a, used only to break rounding ties deterministically. */
function hash32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Splits `total` into integer parts proportional to `weights` (largest-remainder method).
 * The parts always sum exactly to `total`. Leftover units go to the largest fractional
 * remainders; ties are broken by hash of `tieKeys[i]`, so which person absorbs the extra
 * cent varies between expenses instead of always landing on the same member.
 */
export function allocate(total: number, weights: number[], tieKeys: string[]): number[] {
  if (!Number.isSafeInteger(total)) throw new Error('total must be an integer')
  if (weights.length !== tieKeys.length) throw new Error('weights/tieKeys length mismatch')
  if (weights.some((w) => !Number.isSafeInteger(w) || w < 0)) {
    throw new Error('weights must be non-negative integers')
  }
  const sumW = weights.reduce((a, b) => a + b, 0)
  if (weights.length === 0 || sumW === 0) {
    if (total === 0) return weights.map(() => 0)
    throw new Error('Cannot allocate a non-zero total across zero weight')
  }

  const sign = total < 0 ? -1n : 1n
  const T = BigInt(Math.abs(total))
  const W = BigInt(sumW)
  const parts = weights.map((w) => (T * BigInt(w)) / W)
  const rems = weights.map((w) => (T * BigInt(w)) % W)
  let leftover = Number(T - parts.reduce((a, b) => a + b, 0n))

  const order = weights
    .map((_, i) => i)
    .sort((a, b) => {
      const ra = rems[a]!
      const rb = rems[b]!
      if (ra !== rb) return ra > rb ? -1 : 1
      return hash32(tieKeys[a]!) - hash32(tieKeys[b]!) || a - b
    })
  for (const i of order) {
    if (leftover === 0) break
    parts[i]! += 1n
    leftover--
  }
  return parts.map((p) => Number(p * sign))
}

function splitWeights(e: Expense): number[] {
  switch (e.split_method) {
    case 'equal':
      return e.split.map(() => 1)
    case 'shares':
    case 'exact':
    case 'percent':
      return e.split.map((s) => s.value)
  }
}

/** Returns a problem with the split, or null if it is valid. */
export function validateExpense(e: Expense): string | null {
  if (e.split.length === 0) return 'Pick at least one person to split with'
  if (e.payers.length === 0) return 'Pick who paid'
  const paid = e.payers.reduce((a, p) => a + p.amount_minor, 0)
  if (paid !== e.amount_minor) return 'Payer amounts must add up to the total'
  if (e.split_method === 'exact') {
    const sum = e.split.reduce((a, s) => a + s.value, 0)
    if (sum !== e.amount_minor) return 'Exact amounts must add up to the total'
  }
  if (e.split_method === 'percent') {
    const sum = e.split.reduce((a, s) => a + s.value, 0)
    if (sum !== 10000) return 'Percentages must add up to 100%'
  }
  if (e.split_method === 'shares' && e.split.every((s) => s.value === 0)) {
    return 'At least one person needs a share'
  }
  return null
}

/** Per-member amounts paid and owed for one expense, in base-currency minor units. */
export function computeShares(e: Expense): Map<MemberId, { paid: number; owed: number }> {
  const out = new Map<MemberId, { paid: number; owed: number }>()
  const get = (m: MemberId) => {
    let v = out.get(m)
    if (!v) out.set(m, (v = { paid: 0, owed: 0 }))
    return v
  }
  const owed = allocate(
    e.base_amount_minor,
    splitWeights(e),
    e.split.map((s) => `${e.id}:owe:${s.member_id}`),
  )
  e.split.forEach((s, i) => (get(s.member_id).owed += owed[i]!))
  const paid = allocate(
    e.base_amount_minor,
    e.payers.map((p) => p.amount_minor),
    e.payers.map((p) => `${e.id}:pay:${p.member_id}`),
  )
  e.payers.forEach((p, i) => (get(p.member_id).paid += paid[i]!))
  return out
}

/** Net balance per member: positive means the group owes them money. Always sums to zero. */
export function balances(
  expenses: Expense[],
  settlements: Settlement[],
): Map<MemberId, number> {
  const net = new Map<MemberId, number>()
  const add = (m: MemberId, v: number) => net.set(m, (net.get(m) ?? 0) + v)
  for (const e of expenses) {
    if (e.deleted_at) continue
    for (const [m, { paid, owed }] of computeShares(e)) add(m, paid - owed)
  }
  for (const s of settlements) {
    if (s.deleted_at) continue
    add(s.from_member_id, s.base_amount_minor)
    add(s.to_member_id, -s.base_amount_minor)
  }
  return net
}

/**
 * Greedy min-cash-flow: repeatedly settle the largest debtor against the largest creditor.
 * Produces at most n-1 transfers. Deterministic (ties broken by member id).
 */
export function simplifyDebts(net: Map<MemberId, number>): Transfer[] {
  const creditors: [MemberId, number][] = []
  const debtors: [MemberId, number][] = []
  for (const [m, v] of net) {
    if (v > 0) creditors.push([m, v])
    else if (v < 0) debtors.push([m, -v])
  }
  const byAmount = (a: [MemberId, number], b: [MemberId, number]) =>
    b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)

  const transfers: Transfer[] = []
  while (creditors.length && debtors.length) {
    creditors.sort(byAmount)
    debtors.sort(byAmount)
    const c = creditors[0]!
    const d = debtors[0]!
    const amt = Math.min(c[1], d[1])
    transfers.push({ from: d[0], to: c[0], amount_minor: amt })
    c[1] -= amt
    d[1] -= amt
    if (c[1] === 0) creditors.shift()
    if (d[1] === 0) debtors.shift()
  }
  return transfers
}

/** "$58.98", "Q450.00" (the local symbol, not "GTQ 450.00"). */
export function formatMoney(minor: number, currency: string, locale = 'en-US'): string {
  const e = minorUnits(currency)
  return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(minor / 10 ** e)
}
