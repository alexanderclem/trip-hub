// The phone's side of the trip agent (docs/AGENT_PLANNER.md).
// requestAgentPlan asks the Worker for a checked plan; finalizeAgentPlan is what the "Finalize" button
// calls once the person accepts it: it queues the "your itinerary is ready" email through the existing
// Gmail outbox. Booking each offer is a separate, explicit step per item; finalizing books nothing.
import { ensureSession, supabase } from '@/lib/supabase'
import type { FinalPlan } from '../../../worker/agent/loop'
import type { z } from 'zod'
import type { agentRequestSchema } from '../../../worker/agent/handler'

export type AgentRequest = z.input<typeof agentRequestSchema>
export type { FinalPlan }

export async function requestAgentPlan(input: AgentRequest, signal?: AbortSignal): Promise<FinalPlan> {
  if (!navigator.onLine) throw new Error('The trip agent needs a connection.')
  await ensureSession()
  const { data } = await supabase.auth.getSession()
  const response = await fetch('/api/agent-plan', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify(input),
  })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The trip agent is not connected on this server yet.')
  const body = await response.json() as { plan?: FinalPlan; error?: string }
  if (!response.ok || !body.plan) throw new Error(body.error ?? 'The trip agent could not finish this plan.')
  return body.plan
}

/** What the email needs, trimmed to stay well under the server's 20 kB limit. */
export function emailPayload(plan: FinalPlan) {
  return {
    summary: plan.summary.slice(0, 600), currency: plan.currency, totalMinor: plan.totalMinor,
    days: plan.days.slice(0, 21).map((d) => ({ date: d.date, stay: d.stay?.name ?? null, items: d.items.slice(0, 12).map((i) => ({ start: i.start, title: i.title.slice(0, 120) })) })),
  }
}

export type FinalizeResult = 'queued' | 'no_email' | 'limited'

/**
 * Queue the confirmation email. `planKey` must be stable for one plan (use the draft id) so a double
 * tap or a retry sends one email. Guests without an account get 'no_email': say "Sign in to get
 * your itinerary by email" rather than treating it as an error.
 */
export async function finalizeAgentPlan(tripId: string, planKey: string, plan: FinalPlan): Promise<FinalizeResult> {
  const { data, error } = await supabase.rpc('queue_trip_finalized_email', { p_trip: tripId, p_plan_key: planKey, p_plan: emailPayload(plan) })
  if (error) throw new Error('Could not send the itinerary email. Your plan is saved; try again.')
  return data as FinalizeResult
}
