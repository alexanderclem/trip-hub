import { z } from 'zod'

export const AXES = [
  { key: 'adventure', label: 'Adventure', hint: 'Hikes, active days, and trying something new', type: 'Adventure seeker' },
  { key: 'nature', label: 'Nature', hint: 'Wildlife, mountains, beaches, and open spaces', type: 'Nature lover' },
  { key: 'culture', label: 'Culture', hint: 'History, art, local life, and museums', type: 'Culture explorer' },
  { key: 'food', label: 'Food', hint: 'Markets, local flavors, and memorable meals', type: 'Food explorer' },
  { key: 'nightlife', label: 'Nightlife', hint: 'Bars, music, dancing, and late nights', type: 'Night owl' },
  { key: 'relaxation', label: 'Relaxation', hint: 'Slow mornings, downtime, and room to breathe', type: 'Slow traveler' },
  { key: 'comfort', label: 'Comfort', hint: 'Comfortable stays and convenient transport', type: 'Comfort seeker' },
  { key: 'budget', label: 'Budget', hint: 'How much saving money matters to you', type: 'Budget explorer' },
] as const
export type Axis = typeof AXES[number]['key']
const score = z.number().int().min(0).max(100)
export const scoresSchema = z.object({ adventure: score, nature: score, culture: score, food: score, nightlife: score, relaxation: score, comfort: score, budget: score })
export type Scores = z.infer<typeof scoresSchema>
export const NEUTRAL: Scores = { adventure: 50, nature: 50, culture: 50, food: 50, nightlife: 50, relaxation: 50, comfort: 50, budget: 50 }
export const profileSchema = z.object({ scores: scoresSchema, description: z.string().max(2000), constraints: z.string().max(2000) })
export type Profile = z.infer<typeof profileSchema>
export const inferredProfileSchema = z.object({ scores: scoresSchema, explanation: z.string().min(1).max(1000) })

export function classify(scores: Scores): string {
  const top = [...AXES].sort((a, b) => scores[b.key] - scores[a.key]).filter((a) => scores[a.key] >= 65)
  return top.length ? top.slice(0, 2).map((a) => a.type).join(' · ') : 'Flexible traveler'
}

export function combine(profiles: Profile[]) {
  if (!profiles.length) return null
  const mean = { ...NEUTRAL }, low = { ...NEUTRAL }, high = { ...NEUTRAL }
  for (const { key } of AXES) {
    const values = profiles.map((p) => p.scores[key])
    mean[key] = Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    low[key] = Math.min(...values)
    high[key] = Math.max(...values)
  }
  return { mean, low, high, disagreements: AXES.filter(({ key }) => high[key] - low[key] >= 45).map(({ key }) => key) }
}

export type MatchMode = 'average' | 'everyone'
export function matchScore(idea: Scores, profiles: Profile[], mode: MatchMode = 'everyone'): number {
  if (!profiles.length) return 0
  // Treat each interest independently; comfort and budget can both matter.
  const matches = profiles.map((p) => 100 - AXES.reduce((sum, { key }) => sum + Math.abs(p.scores[key] - idea[key]), 0) / AXES.length)
  const average = matches.reduce((a, b) => a + b, 0) / matches.length
  return Math.round(mode === 'everyone' ? average * 0.4 + Math.min(...matches) * 0.6 : average)
}

const activitySchema = z.object({
  title: z.string().min(1).max(160),
  kind: z.enum(['activity', 'meal', 'transport', 'lodging', 'free']),
  time: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),
  durationMinutes: z.number().int().min(15).max(480),
  placeName: z.string().max(160).nullable(),
  existingPlaceId: z.string().uuid().nullable(),
  notes: z.string().max(1000),
  costMinor: z.number().int().min(0).max(100000000).nullable(),
})
export const ideaSchema = z.object({
  title: z.string().min(1).max(120), destination: z.string().min(1).max(160),
  timezone: z.string().min(1).max(80), currency: z.string().regex(/^[A-Z]{3}$/),
  summary: z.string().min(1).max(1000), why: z.string().min(1).max(1000),
  tradeoffs: z.string().max(1000), scores: scoresSchema,
  estimatedCostMinor: z.number().int().min(0).max(100000000).nullable(),
  days: z.array(z.object({ title: z.string().min(1).max(160), activities: z.array(activitySchema).min(1).max(4) })).min(1).max(14),
  tasks: z.array(z.string().min(1).max(200)).max(8),
})
export type Idea = z.infer<typeof ideaSchema>
export const ideasSchema = z.object({ ideas: z.array(ideaSchema).min(1).max(3) })
export type IdeaResult = z.infer<typeof ideasSchema>
export const briefSchema = z.object({
  prompt: z.string().min(1).max(3000), destination: z.string().max(160),
  days: z.number().int().min(1).max(14), startDate: z.iso.date().nullable(),
  budgetMinor: z.number().int().min(0).max(100000000).nullable(), currency: z.string().regex(/^[A-Z]{3}$/),
})
export type Brief = z.infer<typeof briefSchema>
/** What Stowie makes of one free-text line: what the person wants, any details they stated, and a short reply. */
export const chatReplySchema = z.object({
  intent: z.enum(['plan', 'refine', 'preferences', 'other']), reply: z.string().min(1).max(400),
  destination: z.string().max(160).nullable(), days: z.number().int().min(1).max(14).nullable(),
  budget: z.number().min(0).max(1000000).nullable(),
})
export type ChatReply = z.infer<typeof chatReplySchema>
export const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('profile'), description: z.string().min(1).max(2000) }),
  z.object({
    action: z.literal('ideas'), tripId: z.string().uuid().nullable(), brief: briefSchema,
    profiles: z.array(profileSchema).min(1).max(30), mode: z.enum(['average', 'everyone']),
    requiredAxes: z.array(z.enum(['adventure', 'nature', 'culture', 'food', 'nightlife', 'relaxation', 'comfort', 'budget'])).max(8),
    previous: ideaSchema.nullable(),
    places: z.array(z.object({ id: z.string().uuid(), name: z.string().max(160), category: z.string().max(40), area: z.string().max(160).nullable() })).max(100),
    existingPlan: z.array(z.object({ title: z.string().max(160), start: z.string().max(40), end: z.string().max(40).nullable(), status: z.string().max(30) })).max(100),
  }),
  z.object({
    action: z.literal('chat'), text: z.string().min(1).max(1000),
    context: z.object({
      hasProfile: z.boolean(), draftTitle: z.string().max(120).nullable(), destination: z.string().max(160),
      recent: z.array(z.object({ from: z.enum(['stowie', 'me']), text: z.string().max(500) })).max(6),
    }),
  }),
])
export type AIRequest = z.infer<typeof requestSchema>

export interface Draft {
  id: string
  scope: string // trip id, or 'personal'; stays on this device until applied
  createdAt: string
  brief: Brief
  result: IdeaResult
  replacesDraftId?: string
  application?: { tripId: string; ideaIndex: number; undone: boolean; rows: { table: 'places' | 'itinerary_items' | 'trip_tasks'; id: string; fingerprint: string }[] }
}
