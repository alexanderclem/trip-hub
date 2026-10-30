import { describe, expect, it } from 'vitest'
import { accountNotices, requirementLabel, scheduleText, type StripeAccountRow } from './notices'

const ready: StripeAccountRow = { stripe_account_id: 'acct_1', charges_enabled: true, payouts_enabled: true, details_submitted: true, requirements: {}, disabled_reason: null, payout_schedule: { interval: 'daily', delay_days: 2 }, disconnected_at: null }

describe('organizer notices', () => {
  it('asks to connect, then to finish connecting', () => {
    expect(accountNotices(null)[0]).toMatchObject({ title: 'Connect Stripe to take payments', action: { to: 'onboarding' } })
    expect(accountNotices({ ...ready, details_submitted: false, charges_enabled: false, payouts_enabled: false })[0]!.title).toBe('Finish connecting Stripe to take payments')
  })

  it('names what Stripe needs and by when, and says whose rule it is', () => {
    const n = accountNotices({ ...ready, requirements: { currently_due: ['individual.verification.document', 'external_account'], current_deadline: 1_801_000_000 } })
    expect(n[0]!.body).toBe('Stripe needs a photo of your ID, your bank account by January 26. If it isn’t provided, Stripe will pause payouts on January 26. This is Stripe’s identity check, which every payment provider must do; Stowaway can’t waive it.')
  })

  it('explains a payout pause, keeping travelers’ money safe', () => {
    const n = accountNotices({ ...ready, payouts_enabled: false, disabled_reason: 'requirements.past_due' })
    expect(n.find((x) => x.title === 'Stripe has paused payouts to your bank')!.body).toMatch(/^Reason Stripe gave: requirements past due\. Travelers can still pay you/)
  })

  it('reports failed payouts and disputes with their deadline', () => {
    const n = accountNotices(ready, [{ stripe_payout_id: 'po', amount_minor: 7000, arrival_date: '2027-01-11', status: 'failed', failure_code: 'account_closed', failure_message: 'The bank account has been closed' }],
      [{ stripe_dispute_id: 'dp', amount_minor: 15000, status: 'needs_response', evidence_due_by: '2027-01-26T00:00:00Z' }])
    expect(n.map((x) => x.title)).toEqual(['Your $70.00 payout didn’t reach your bank', 'A $150.00 payment was disputed', 'About your first payout'])
    expect(n[1]!.body).toContain('Respond by January 26; after that you can’t.')
  })

  it('sets expectations for the first payout until one is paid', () => {
    expect(accountNotices(ready)[0]!.body).toContain('about 7 days (up to 14 in some industries)')
    expect(accountNotices(ready, [{ stripe_payout_id: 'po', amount_minor: 1, arrival_date: '2027-01-11', status: 'paid', failure_code: null, failure_message: null }])).toEqual([])
  })

  it('describes schedules and requirements in plain words', () => {
    expect(scheduleText({ interval: 'daily', delay_days: 2 })).toBe('every business day, 2 days after payment')
    expect(scheduleText({ interval: 'weekly', weekly_anchor: 'friday' })).toBe('every week on Friday')
    expect(scheduleText({ interval: 'manual' })).toBe('when you ask for one in Stripe')
    expect(requirementLabel('individual.ssn_last_4')).toBe('your Social Security number')
  })
})
