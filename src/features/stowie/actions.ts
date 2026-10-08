import { db } from '@/data/db'
import type { ItineraryItem, Place, Trip } from '@/data/types'
import { applyIdea, refinementPlan } from '@/features/discovery/data'
import { requestAI } from '@/features/discovery/client'
import { briefSchema, ideasSchema, type Draft, type Profile } from '@/features/discovery/model'
import { newId } from '@/lib/ids'
import { minorUnits } from '@/lib/money'
import type { Plan } from './script'

/** Turns the brief Stowie collected into a saved draft, the same way the hand editor does. */
export async function generateDraft({ plan, trip, tripDays, profiles, places, items, signal }: {
  plan: Plan; trip: Trip | null; tripDays: number | null; profiles: Profile[]; places: Place[]; items: ItineraryItem[]; signal: AbortSignal
}): Promise<string> {
  if (!profiles.length) throw new Error('Save a travel style first, so the sketch has something to fit.')
  const scope = trip?.id ?? 'personal'
  const currency = trip?.base_currency ?? 'USD'
  // A revision keeps the earlier draft's shape; only the request changes.
  const earlier = plan.refineDraftId ? await db.ai_drafts.get(plan.refineDraftId) : undefined
  const previous = earlier?.result.ideas[0] ?? null
  const replacesDraftId = earlier?.application && !earlier.application.undone && earlier.application.tripId === trip?.id && earlier.application.ideaIndex === 0 ? earlier.id : undefined
  const days = earlier?.brief.days ?? Math.min(plan.days ?? 5, tripDays ?? 14)
  const brief = briefSchema.parse({
    prompt: plan.prompt, destination: earlier?.brief.destination ?? plan.destination ?? '', days,
    startDate: trip?.start_date ?? earlier?.brief.startDate ?? null,
    budgetMinor: earlier ? earlier.brief.budgetMinor : typeof plan.budget === 'number' ? Math.round(plan.budget * 10 ** minorUnits(currency)) : null,
    currency: earlier?.brief.currency ?? currency,
  })
  const protectedItems = replacesDraftId ? await refinementPlan(items, replacesDraftId) : items
  const result = ideasSchema.parse(await requestAI({
    action: 'ideas', tripId: trip?.id ?? null, brief, mode: 'everyone', requiredAxes: [], previous,
    profiles: profiles.map((p) => ({ scores: p.scores, description: p.description, constraints: p.constraints })),
    places: places.filter((p) => p.status !== 'rejected').slice(0, 100).map((p) => ({ id: p.id, name: p.name.slice(0, 160), category: p.category, area: p.area?.slice(0, 160) ?? null })),
    existingPlan: protectedItems.filter((i) => i.status !== 'cancelled').slice(0, 100).map((i) => ({ title: i.title.slice(0, 160), start: i.start_local, end: i.end_local, status: i.status })),
  }, signal))
  const saved: Draft = { id: newId(), scope, createdAt: new Date().toISOString(), brief, result, replacesDraftId }
  await db.ai_drafts.add(saved)
  return saved.id
}

export async function applyDraft(draftId: string, trip: Trip, memberId: string): Promise<number> {
  const start = trip.start_date ?? (await db.ai_drafts.get(draftId))?.brief.startDate
  if (!start) throw new Error('This trip has no start date yet. Open “Edit by hand”, choose a start date there, and add the draft.')
  return applyIdea(draftId, 0, trip, memberId, start)
}
