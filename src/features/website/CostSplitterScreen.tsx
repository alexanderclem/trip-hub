import { useId, useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Link } from 'react-router'
import { formatMoney } from '@/lib/money'
import { WebsiteFrame } from './WebsiteFrame'
import { TagHead } from './tag/parts'
import { splitCosts, type SplitCost, type SplitPerson } from './splitter'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'MXN', 'GTQ', 'JPY'] as const
const MAX_PEOPLE = 20

/** A free calculator for one trip's shared costs. Nothing is saved or sent; it lives in this page. */
export function CostSplitterScreen() {
  const id = useId()
  const next = useRef(10)
  const newId = () => String(next.current++)
  const [currency, setCurrency] = useState<string>('USD')
  const [people, setPeople] = useState<SplitPerson[]>([{ id: 'p1', name: 'Maya' }, { id: 'p2', name: 'Jordan' }, { id: 'p3', name: 'Priya' }])
  const [costs, setCosts] = useState<SplitCost[]>([
    { id: 'c1', label: 'Beach house', amount: '900', paidBy: 'p1', among: ['p1', 'p2', 'p3'] },
    { id: 'c2', label: 'Airport shuttle', amount: '60', paidBy: 'p2', among: ['p1', 'p2', 'p3'] },
  ])
  const result = useMemo(() => splitCosts(people, costs, currency), [people, costs, currency])
  const money = (minor: number) => formatMoney(minor, currency)
  const nameOf = (personId: string) => people.find((p) => p.id === personId)?.name.trim() || 'Someone'
  const problems = new Map(result.skipped.map((s) => [s.id, s.reason]))

  const updateCost = (costId: string, change: Partial<SplitCost>) => setCosts((list) => list.map((c) => (c.id === costId ? { ...c, ...change } : c)))
  function addPerson() {
    const person = { id: `p${newId()}`, name: '' }
    setPeople((list) => [...list, person])
    // A new person shares every existing cost until someone unticks them.
    setCosts((list) => list.map((c) => ({ ...c, among: [...c.among, person.id] })))
  }
  function removePerson(personId: string) {
    setPeople((list) => list.filter((p) => p.id !== personId))
    setCosts((list) => list.map((c) => ({ ...c, among: c.among.filter((m) => m !== personId), paidBy: c.paidBy === personId ? '' : c.paidBy })))
  }

  return (
    <WebsiteFrame>
      <TagHead id="splitter-title" title="Trip cost splitter" intro="Add who paid for what on your trip. See each person’s share and who owes whom, settled in the fewest payments. Free, with no sign-up, and nothing you type leaves this page." fields={[['Price', 'Free'], ['Sign-up', 'None'], ['Your data', 'Not saved or sent'], ['Settle-up', 'Fewest payments']]} />

      <section className="marketing-section website-container" aria-labelledby={`${id}-inputs`}>
        <h2 id={`${id}-inputs`}>Your trip’s costs</h2>
        <div className="calc splitter">
          <form className="splitter-form" onSubmit={(e) => e.preventDefault()} aria-label="Trip costs">
            <label className="splitter-currency">Currency
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            </label>

            <fieldset>
              <legend>Who’s on the trip</legend>
              <ul className="splitter-people">
                {people.map((person, index) => (
                  <li key={person.id}>
                    <input aria-label={`Person ${index + 1}`} value={person.name} placeholder={`Person ${index + 1}`} onChange={(e) => setPeople((list) => list.map((p) => (p.id === person.id ? { ...p, name: e.target.value } : p)))} />
                    <button type="button" className="splitter-icon" onClick={() => removePerson(person.id)} disabled={people.length <= 2} aria-label={`Remove ${person.name.trim() || `person ${index + 1}`}`}><X size={18} aria-hidden="true" /></button>
                  </li>
                ))}
              </ul>
              <button type="button" className="splitter-add" onClick={addPerson} disabled={people.length >= MAX_PEOPLE}><Plus size={18} aria-hidden="true" /> Add a person</button>
            </fieldset>

            <fieldset>
              <legend>What was paid</legend>
              <ol className="splitter-costs">
                {costs.map((cost, index) => (
                  <li key={cost.id}>
                    <fieldset className="splitter-cost">
                      <legend className="sr-only">Cost {index + 1}</legend>
                      <div className="splitter-cost-row">
                        <label>What for<input value={cost.label} placeholder="Dinner, tickets, gas…" onChange={(e) => updateCost(cost.id, { label: e.target.value })} /></label>
                        <label>Amount ({currency})<input inputMode="decimal" value={cost.amount} onChange={(e) => updateCost(cost.id, { amount: e.target.value })} aria-invalid={problems.has(cost.id) || undefined} aria-describedby={problems.has(cost.id) ? `${id}-problem-${cost.id}` : undefined} /></label>
                        <label>Paid by
                          <select value={cost.paidBy} onChange={(e) => updateCost(cost.id, { paidBy: e.target.value })}>
                            <option value="" disabled>Choose</option>
                            {people.map((p, i) => <option key={p.id} value={p.id}>{p.name.trim() || `Person ${i + 1}`}</option>)}
                          </select>
                        </label>
                      </div>
                      <fieldset>
                        <legend>Split equally between</legend>
                        <div className="calc-choice splitter-among">
                          {people.map((p, i) => (
                            <label key={p.id}><input type="checkbox" checked={cost.among.includes(p.id)} onChange={(e) => updateCost(cost.id, { among: e.target.checked ? [...cost.among, p.id] : cost.among.filter((m) => m !== p.id) })} />{p.name.trim() || `Person ${i + 1}`}</label>
                          ))}
                        </div>
                      </fieldset>
                      {problems.has(cost.id) && <p id={`${id}-problem-${cost.id}`} className="splitter-problem" role="alert">{problems.get(cost.id)} This cost isn’t counted yet.</p>}
                      <button type="button" className="splitter-remove" onClick={() => setCosts((list) => list.filter((c) => c.id !== cost.id))}>Remove {cost.label.trim() || `cost ${index + 1}`}</button>
                    </fieldset>
                  </li>
                ))}
              </ol>
              <button type="button" className="splitter-add" onClick={() => setCosts((list) => [...list, { id: `c${newId()}`, label: '', amount: '', paidBy: '', among: people.map((p) => p.id) }])}><Plus size={18} aria-hidden="true" /> Add a cost</button>
            </fieldset>
          </form>

          <section className="calc-result" aria-labelledby={`${id}-result`}>
            <h3 id={`${id}-result`} className="marketing-muted">To settle up</h3>
            {result.transfers.length ? (
              <ol className="splitter-transfers" aria-live="polite">
                {result.transfers.map((t) => <li key={`${t.from}-${t.to}`}><strong>{nameOf(t.from)}</strong> pays <strong>{nameOf(t.to)}</strong> <span className="splitter-amount">{money(t.amount_minor)}</span></li>)}
              </ol>
            ) : <p className="calc-keep" aria-live="polite">Everyone’s even</p>}
            <div className="calc-table-wrap">
              <table className="calc-table">
                <caption className="sr-only">What each person paid and owes</caption>
                <thead><tr><th scope="col">Person</th><th scope="col">Paid</th><th scope="col">Share</th><th scope="col">Balance</th></tr></thead>
                <tbody>
                  {result.people.map((p, i) => <tr key={p.id}><th scope="row">{p.name.trim() || `Person ${i + 1}`}</th><td>{money(p.paid)}</td><td>{money(p.share)}</td><td>{p.balance > 0 ? `gets ${money(p.balance)}` : p.balance < 0 ? `owes ${money(-p.balance)}` : 'even'}</td></tr>)}
                  <tr><th scope="row">Total</th><td>{money(result.total)}</td><td>{money(result.total)}</td><td /></tr>
                </tbody>
              </table>
            </div>
            <p className="calc-note">Shares are split to the cent; any leftover cents go to different people in turn, so the shares always add up to the total. The payments shown are the fewest that settle everyone up.</p>
          </section>
        </div>
      </section>

      <section className="marketing-section website-container marketing-split" aria-labelledby={`${id}-app`}>
        <div>
          <h2 id={`${id}-app`}>Splitting costs for a whole trip?</h2>
          <p className="marketing-body">This calculator is the same maths Stowaway uses inside every trip. In the app, each person adds their own costs from their phone, even offline, and the balances update for everyone. Costs can be split by shares, exact amounts or percentages too, logged in the local currency, and paid by more than one person.</p>
          <div className="website-actions"><Link to="/new" className="website-button website-button-primary">Start a free trip</Link><Link to="/group-expenses" className="website-text-link">How group expenses work</Link></div>
        </div>
        <div className="website-faq">
          <details><summary>How is each share worked out?</summary><p>Each cost is divided equally between the people you tick. Amounts are kept in whole cents, and if a cost doesn’t divide evenly the leftover cents are spread across different people rather than rounded away.</p></details>
          <details><summary>What does “fewest payments” mean?</summary><p>Instead of everyone paying back each cost separately, the splitter adds up each person’s balance and finds the smallest number of payments that brings everyone to zero. For up to 16 people with a balance it finds the true minimum.</p></details>
          <details><summary>Is anything I type saved?</summary><p>No. The calculation runs in your browser and nothing is stored or sent. Reloading the page clears it.</p></details>
        </div>
      </section>
    </WebsiteFrame>
  )
}
