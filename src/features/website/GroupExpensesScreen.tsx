import { Link } from 'react-router'
import { WebsiteFrame } from './WebsiteFrame'
import { TagHead } from './tag/parts'

const methods: [title: string, text: string][] = [
  ['Equally', 'The default. Tick who was there and the cost is divided between them. Leftover cents are spread across people in turn, so shares always add up to the total.'],
  ['By shares', 'For when one person should count double: a couple sharing a room, or someone who stayed four nights of five. Give each person a number of shares.'],
  ['Exact amounts', 'For a restaurant bill where everyone knows what they ordered. Type each person’s amount; a counter shows what’s left to assign.'],
  ['Percentages', 'For agreed splits like 60/40. Percentages must add up to 100 before the cost can be saved.'],
]

/** The feature page for splitting costs, written for "split expenses group trip" searches. */
export function GroupExpensesScreen() {
  return (
    <WebsiteFrame>
      <TagHead id="expenses-title" title="Split group trip expenses, free and offline" intro="Stowaway keeps a running tab for your whole trip. Anyone in the group logs what they paid, from their own phone, even with no signal. Everyone sees their balance, and settle-up suggests the fewest payments to make it even." fields={[['Price', 'Free, no limits'], ['Split methods', 'Equal, shares, exact, percent'], ['Currencies', 'Home + local currency'], ['Offline', 'Log costs without signal']]}>
        <div className="website-actions"><Link to="/new" className="website-button website-button-primary">Create a trip</Link><Link to="/tools/trip-cost-splitter" className="website-text-link">Try the cost splitter</Link></div>
      </TagHead>

      <section className="marketing-section website-container" aria-labelledby="expenses-how">
        <h2 id="expenses-how">How it works on a trip</h2>
        <ol className="marketing-walkthrough">{[
          ['Someone pays', 'They add the cost: what it was for, the amount, and the currency it was paid in. If two people put their cards down, add both payers and how much each paid.'],
          ['Choose who it’s for', 'Everyone on the trip is ticked by default. Untick the people who weren’t there, or switch to shares, exact amounts or percentages.'],
          ['Balances update for everyone', 'Each person sees whether they’re owed or owe, and by how much. The Money tab shows bars for the whole group and the history day by day.'],
          ['Settle up in the fewest payments', 'Stowaway works out the smallest set of payments that evens everyone out, then lets you record each one when it’s made. You pay each other however you usually do.'],
        ].map(([title, text], index) => <li key={title}><span className="marketing-step-index" aria-hidden="true">{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol>
      </section>

      <section className="marketing-section website-container" aria-labelledby="expenses-methods">
        <h2 id="expenses-methods">Four ways to split a cost</h2>
        <ul className="marketing-points">{methods.map(([title, text]) => <li key={title}><h3>{title}</h3><p>{text}</p></li>)}</ul>
      </section>

      <section className="marketing-section website-container marketing-split" aria-labelledby="expenses-currency">
        <div>
          <h2 id="expenses-currency">Paying in another currency</h2>
          <p className="marketing-body">Log a cost in the currency you paid in, such as quetzales in Guatemala or euros in Paris. Stowaway fills in the day’s exchange rate (you can change it), stores that rate with the cost, and keeps every balance in the trip’s home currency so the totals never drift. You can view amounts in either currency.</p>
          <p className="marketing-body">Exchange rates are refreshed once a day when you’re online and saved on the phone for when you’re not.</p>
        </div>
        <div>
          <h3 className="marketing-subtitle">Built for the trip itself</h3>
          <ul className="marketing-plain-list">
            <li>Costs can be added with no signal and sync when the phone reconnects.</li>
            <li>Scan a receipt to fill in the amount, and keep the photo with the cost.</li>
            <li>Turn a plan item into a cost with “Log what it cost”, so the dinner and its bill stay together.</li>
            <li>“What this trip costs you” adds your share of what’s been spent to your share of the plan’s estimates.</li>
            <li>No daily limit on how many costs you add, and no ads.</li>
          </ul>
        </div>
      </section>

      <section className="marketing-section website-container" aria-labelledby="expenses-faq">
        <h2 id="expenses-faq">Questions</h2>
        <div className="website-faq">
          <details><summary>Does Stowaway send money between friends?</summary><p>No. Stowaway is a shared record of who paid and who owes. When it suggests a payment, you make it with Venmo, Zelle, cash or whatever your group uses, then mark it as paid.</p></details>
          <details><summary>Does everyone need the app?</summary><p>No download is needed. Everyone opens the trip’s link in their browser and picks their name, and can add costs from there. On an iPhone it can be added to the Home Screen to work like an app.</p></details>
          <details><summary>How many people can share a trip?</summary><p>There’s no fixed limit. For up to 16 people with a balance, settle-up finds the true fewest payments; for bigger groups it uses a quick method that stays close, and the Money tab says which one it used.</p></details>
          <details><summary>Is it really free?</summary><p>Yes. Expenses, like the rest of group planning, are free with no limits. Only tools for organizers who sell trips are paid. <Link to="/pricing">See pricing</Link>.</p></details>
          <details><summary>How is this different from a split-the-bill app?</summary><p>The costs live with the trip: the plan, the votes and the tickets are in the same place, so a bill can be linked to the dinner it paid for. If you only need to split bills, a dedicated app works well too; <Link to="/compare/splitwise-alternative-for-group-trips">here’s an honest comparison</Link>.</p></details>
        </div>
      </section>

      <section className="website-closing" aria-labelledby="expenses-closing"><div className="website-container website-closing-inner"><h2 id="expenses-closing">Start the trip’s tab.</h2><Link to="/new" className="website-button website-button-primary">Create a trip</Link></div></section>
    </WebsiteFrame>
  )
}
