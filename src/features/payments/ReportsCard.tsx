// /organize → Reports (Pro): per-trip money for a period, from the ledger. The CSV keeps one column
// order (dates, trip, collected, fees, refunds, net) so it imports into QuickBooks or Xero the same way.

import { useState } from 'react'
import { DateTime } from 'luxon'
import { Download } from 'lucide-react'
import { Button, Card, DateInput, ErrorNote, Field, SectionTitle } from '@/ui'
import { organizerReport, type ReportRow } from './api'
import { ProBadge, useMyOrganizer } from './pro'
import { reportCsv } from './data'

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
export function ReportsCard() {
  const me = useMyOrganizer()
  const [from, setFrom] = useState(() => DateTime.now().startOf('year').toISODate()!)
  const [to, setTo] = useState(() => DateTime.now().toISODate()!)
  const [data, setData] = useState<{ from: string; to: string; trips: ReportRow[]; payouts: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!me || !me.pro) return null

  async function run() {
    setBusy(true); setError(null)
    try { setData({ from, to, ...await organizerReport(from, to) }) } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  function download() {
    if (!data) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([reportCsv(data.from, data.to, data.trips)], { type: 'text/csv;charset=utf-8' }))
    a.download = `stowaway-report-${data.from}-to-${data.to}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const total = (k: keyof Omit<ReportRow, 'trip_id' | 'title'>) => (data?.trips ?? []).reduce((a, r) => a + r[k], 0)

  return (
    <Card>
      <SectionTitle>Reports<ProBadge beta={me.beta} /></SectionTitle>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Field label="From"><DateInput value={from} onValue={setFrom} /></Field>
        <Field label="To"><DateInput value={to} onValue={setTo} /></Field>
      </div>
      <Button variant="secondary" className="mt-3 w-full" disabled={busy || !from || !to || from > to} onClick={() => void run()}>{busy ? 'Adding up…' : 'Show report'}</Button>
      <ErrorNote error={error} />
      {data && <>
        <p role="status" className="mt-3 text-sm text-muted">Report: {data.from} to {data.to}.</p>
        {data.trips.length === 0 ? <p className="mt-2 text-sm text-muted">No traveler payments or refunds in this period.</p> : <>
        <div className="mt-3 overflow-x-auto">
          <table aria-label="Money collected by trip" className="w-full text-sm">
            <thead><tr className="text-left text-muted"><th className="py-1 pr-2 font-medium">Trip</th><th className="py-1 pr-2 text-right font-medium">Collected</th><th className="py-1 pr-2 text-right font-medium">Fees</th><th className="py-1 pr-2 text-right font-medium">Refunds</th><th className="py-1 text-right font-medium">Net</th></tr></thead>
            <tbody className="divide-y divide-line">
              {data.trips.map((r) => <tr key={r.trip_id}><td className="py-1.5 pr-2 break-words">{r.title}</td><td className="py-1.5 pr-2 text-right tabular-nums">{usd(r.collected)}</td><td className="py-1.5 pr-2 text-right tabular-nums">{usd(r.stripe_fees + r.stowaway_fees)}</td><td className="py-1.5 pr-2 text-right tabular-nums">{usd(r.refunds)}</td><td className="py-1.5 text-right tabular-nums">{usd(r.net)}</td></tr>)}
              <tr className="font-semibold"><td className="py-1.5 pr-2">Total</td><td className="py-1.5 pr-2 text-right tabular-nums">{usd(total('collected'))}</td><td className="py-1.5 pr-2 text-right tabular-nums">{usd(total('stripe_fees') + total('stowaway_fees'))}</td><td className="py-1.5 pr-2 text-right tabular-nums">{usd(total('refunds'))}</td><td className="py-1.5 text-right tabular-nums">{usd(total('net'))}</td></tr>
            </tbody>
          </table>
        </div>
        </>}
        <p className="mt-2 text-sm text-muted">Paid out to your bank in this period: {usd(data.payouts)}.</p>
        <button type="button" className="ui-link mt-1 inline-flex min-h-11 items-center gap-2" onClick={download}><Download aria-hidden="true" className="size-4" />Download as CSV</button>
      </>}
    </Card>
  )
}
