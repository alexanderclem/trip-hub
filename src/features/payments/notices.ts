// What an organizer is told about their Stripe account, payouts and disputes (docs/PLAN_THE_SWITCH.md,
// section 7). Every hold says what happened, whose decision it is, what to do, and when it ends.

export interface StripeAccountRow {
  stripe_account_id: string
  charges_enabled: boolean
  payouts_enabled: boolean
  details_submitted: boolean
  requirements: { currently_due?: string[]; past_due?: string[]; current_deadline?: number | null; disabled_reason?: string | null }
  disabled_reason: string | null
  payout_schedule: { interval?: string; delay_days?: number; weekly_anchor?: string; monthly_anchor?: number }
  disconnected_at: string | null
}

export interface PayoutRow { stripe_payout_id: string; amount_minor: number; arrival_date: string | null; status: string; failure_code: string | null; failure_message: string | null }
export interface DisputeRow { stripe_dispute_id: string; amount_minor: number; status: string; evidence_due_by: string | null }

export interface Notice {
  tone: 'info' | 'warning' | 'danger'
  title: string
  body: string
  /** Where the organizer acts: Stripe onboarding (via stripe-connect), or the Stripe Dashboard. */
  action?: { label: string; to: 'onboarding' | 'dashboard' | 'disputes' }
}

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
const deadline = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000).toISOString().slice(0, 10) : null)

/** Stripe's requirement names, in plain words. */
export function requirementLabel(key: string): string {
  if (key.includes('verification.document')) return 'a photo of your ID'
  if (key.includes('verification.additional_document')) return 'a document proving your address'
  if (key.includes('external_account')) return 'your bank account'
  if (key.includes('ssn_last_4') || key.includes('id_number')) return 'your Social Security number'
  if (key.includes('dob')) return 'your date of birth'
  if (key.includes('address')) return 'your address'
  if (key.includes('phone')) return 'your phone number'
  if (key.includes('tos_acceptance')) return 'accepting Stripe’s terms'
  if (key.includes('business_profile')) return 'a description of your business'
  return 'some details about you or your business'
}

/** How payouts reach the bank, in words ("every business day, 2 days after payment"). */
export function scheduleText(s: StripeAccountRow['payout_schedule']): string {
  const delay = s.delay_days ? `, ${s.delay_days} days after payment` : ''
  switch (s.interval) {
    case 'daily': return `every business day${delay}`
    case 'weekly': return `every week${s.weekly_anchor ? ` on ${s.weekly_anchor[0]!.toUpperCase()}${s.weekly_anchor.slice(1)}` : ''}${delay}`
    case 'monthly': return `every month${s.monthly_anchor ? ` on day ${s.monthly_anchor}` : ''}${delay}`
    case 'manual': return 'when you ask for one in Stripe'
    default: return 'on your Stripe schedule'
  }
}

export function accountNotices(account: StripeAccountRow | null, payouts: PayoutRow[] = [], disputes: DisputeRow[] = []): Notice[] {
  if (!account) {
    return [{ tone: 'info', title: 'Connect Stripe to take payments', body: 'Travelers pay into your own Stripe account, and Stripe pays out to your bank on the schedule you choose. Stowaway never holds the money.', action: { label: 'Connect Stripe', to: 'onboarding' } }]
  }
  if (account.disconnected_at) {
    return [{ tone: 'danger', title: 'Your Stripe account is disconnected', body: 'Travelers can’t pay until you connect it again. Money already paid is in your Stripe account.', action: { label: 'Connect Stripe', to: 'onboarding' } }]
  }
  const notices: Notice[] = []
  const due = [...new Set([...(account.requirements.past_due ?? []), ...(account.requirements.currently_due ?? [])].map(requirementLabel))]
  if (!account.details_submitted) {
    notices.push({ tone: 'warning', title: 'Finish connecting Stripe to take payments', body: 'Stripe needs a few details to verify you. It usually takes about 5 minutes.', action: { label: 'Continue with Stripe', to: 'onboarding' } })
  } else if (due.length) {
    const by = deadline(account.requirements.current_deadline)
    notices.push({
      tone: account.requirements.past_due?.length ? 'danger' : 'warning',
      title: 'Stripe needs more information',
      body: `Stripe needs ${due.join(', ')}${by ? ` by ${day(by)}` : ''}. If it isn’t provided, Stripe will pause ${account.charges_enabled ? 'payouts' : 'payments'}${by ? ` on ${day(by)}` : ''}. This is Stripe’s identity check, which every payment provider must do; Stowaway can’t waive it.`,
      action: { label: 'Provide it in Stripe', to: 'onboarding' },
    })
  }
  if (account.details_submitted && !account.payouts_enabled) {
    notices.push({
      tone: 'danger',
      title: 'Stripe has paused payouts to your bank',
      body: `${account.disabled_reason ? `Reason Stripe gave: ${account.disabled_reason.replace(/[._]/g, ' ')}. ` : ''}${account.charges_enabled ? 'Travelers can still pay you; their money is safe in your Stripe balance and pays out once this is resolved. ' : ''}We’ll email you when Stripe lifts the pause.`,
      action: { label: 'Open Stripe', to: 'dashboard' },
    })
  }
  for (const p of payouts.filter((p) => p.status === 'failed')) {
    notices.push({ tone: 'danger', title: `Your ${usd(p.amount_minor)} payout didn’t reach your bank`, body: `${p.failure_message ?? p.failure_code ?? 'Stripe gave no reason'}. Stripe returned it to your balance. Update your bank details in Stripe and it retries on your next payout date.`, action: { label: 'Open Stripe', to: 'dashboard' } })
  }
  for (const d of disputes.filter((d) => d.status === 'needs_response' || d.status === 'warning_needs_response')) {
    notices.push({ tone: 'danger', title: `A ${usd(d.amount_minor)} payment was disputed`, body: `A traveler disputed a payment with their card issuer. Stripe has taken ${usd(d.amount_minor)} plus its dispute fee from your balance until it’s decided.${d.evidence_due_by ? ` Respond by ${day(d.evidence_due_by)}; after that you can’t.` : ''}`, action: { label: 'Respond in Stripe', to: 'disputes' } })
  }
  if (account.charges_enabled && account.payouts_enabled && !payouts.some((p) => p.status === 'paid')) {
    const next = payouts.find((p) => p.status === 'pending' || p.status === 'in_transit')
    notices.push({ tone: 'info', title: next?.arrival_date ? `Your first payout is scheduled for ${day(next.arrival_date)}` : 'About your first payout', body: `Stripe holds a new account’s first payout for about 7 days (up to 14 in some industries). After that, payouts reach your bank ${scheduleText(account.payout_schedule)}.` })
  }
  return notices
}
