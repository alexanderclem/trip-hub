import { AXES, type Axis, type Scores } from '@/features/discovery/model'

type Weights = Partial<Record<Axis, number>>
export interface Question {
  id: string
  prompt: string
  options: { label: string; weights: Weights }[]
}

/**
 * This-or-that scenarios. Each answer nudges several axes up or down; nothing here may name a
 * destination. Budget is "how much saving money matters", so a splurge is a negative weight.
 */
export const QUESTIONS: Question[] = [
  {
    id: 'morning',
    prompt: 'A free morning with nothing planned. You…',
    options: [
      { label: 'Catch the sunrise from a trail', weights: { adventure: 2, nature: 2, relaxation: -1, food: -1, nightlife: -1 } },
      { label: 'Wander the old town and duck into a museum', weights: { culture: 2, nature: -1 } },
      { label: 'Sleep in, then a long coffee', weights: { relaxation: 2, adventure: -1 } },
      { label: 'Track down the breakfast everyone talks about', weights: { food: 2 } },
    ],
  },
  {
    id: 'stay',
    prompt: 'Where are you sleeping?',
    options: [
      { label: 'The cheapest clean bunk', weights: { budget: 2, comfort: -2 } },
      { label: 'A cabin or eco-lodge out of town', weights: { nature: 2, nightlife: -1, comfort: -1 } },
      { label: 'A nice hotel in the centre', weights: { comfort: 2, budget: -1, nature: -1 } },
      { label: 'Somewhere special: the stay is part of the trip', weights: { comfort: 2, budget: -2, relaxation: 1 } },
    ],
  },
  {
    id: 'dinner',
    prompt: 'Dinner tonight is…',
    options: [
      { label: 'Street stalls the locals queue for', weights: { food: 2, budget: 1, adventure: 1, comfort: -1 } },
      { label: 'A booked table and a tasting menu', weights: { food: 2, budget: -2, comfort: 1 } },
      { label: 'Quick and cheap. Food is fuel', weights: { food: -2, budget: 1 } },
      { label: 'Wherever has music and a crowd', weights: { nightlife: 2, food: -1 } },
    ],
  },
  {
    id: 'night',
    prompt: 'It’s 10 pm. You’re…',
    options: [
      { label: 'Just getting started. Find the dancing', weights: { nightlife: 2, relaxation: -1 } },
      { label: 'Having one drink with a view, then bed', weights: { nightlife: 1, relaxation: 1 } },
      { label: 'Asleep already. Big day tomorrow', weights: { nightlife: -2, adventure: 1 } },
      { label: 'In for a quiet night', weights: { nightlife: -2, relaxation: 2, budget: 1, adventure: -1 } },
    ],
  },
  {
    id: 'transport',
    prompt: 'Getting to the next town?',
    options: [
      { label: 'The local bus: cheap, and a story', weights: { budget: 2, comfort: -2, adventure: 1 } },
      { label: 'A shared shuttle, door to door', weights: { comfort: 1, budget: 1 } },
      { label: 'A private driver, leaving when we like', weights: { comfort: 2, budget: -2, adventure: -1 } },
      { label: 'Bikes or scooters, the scenic way', weights: { adventure: 2, nature: 1, comfort: -1 } },
    ],
  },
  {
    id: 'daytrip',
    prompt: 'Pick the day trip.',
    options: [
      { label: 'A summit climb or rafting, packed lunch', weights: { adventure: 2, nature: 1, relaxation: -2, comfort: -1, food: -1 } },
      { label: 'A boat to a quiet beach or swimming hole', weights: { nature: 2, relaxation: 1, culture: -1 } },
      { label: 'Ancient ruins with a guide', weights: { culture: 2, nature: -1 } },
      { label: 'A market tour and cooking class', weights: { food: 2, culture: 1, nature: -1 } },
    ],
  },
  {
    id: 'view',
    prompt: 'The view from your window?',
    options: [
      { label: 'Mountains or forest, nobody around', weights: { nature: 2, nightlife: -1 } },
      { label: 'Rooftops and an old square', weights: { culture: 2, nature: -1 } },
      { label: 'A lit-up street full of bars', weights: { nightlife: 2, nature: -1 } },
      { label: 'A pool and a sun lounger', weights: { relaxation: 2, comfort: 1, culture: -1, adventure: -1 } },
    ],
  },
  {
    id: 'pace',
    prompt: 'How full is the itinerary?',
    options: [
      { label: 'Packed. See everything, eat on the move', weights: { relaxation: -2, culture: 1, adventure: 1, food: -1 } },
      { label: 'One big thing a day, the rest open', weights: { relaxation: 1 } },
      { label: 'Mostly empty, on purpose', weights: { relaxation: 2, adventure: -1, culture: -1 } },
    ],
  },
  {
    id: 'windfall',
    prompt: 'A little unexpected trip money. You…',
    options: [
      { label: 'Keep it and stretch the trip', weights: { budget: 2 } },
      { label: 'Upgrade the room or the seat', weights: { comfort: 2, budget: -1 } },
      { label: 'Spend it on one splurge meal', weights: { food: 2, budget: -1 } },
      { label: 'Book an experience, like a dive or a paraglide', weights: { adventure: 2, budget: -1 } },
    ],
  },
  {
    id: 'invite',
    prompt: 'A local invites the group to something you’ve never heard of.',
    options: [
      { label: 'Yes, immediately', weights: { adventure: 2, culture: 1 } },
      { label: 'Yes, if it’s a festival or a family meal', weights: { culture: 2, food: 1 } },
      { label: 'Only if there’s a party after', weights: { nightlife: 2, culture: -1 } },
      { label: 'Politely pass. I like my plan', weights: { adventure: -2, comfort: 1 } },
    ],
  },
]

/** Question id → index of the chosen option. Unanswered questions change nothing. */
export type Answers = Record<string, number | undefined>

/** The most an axis can be pushed up (sign 1) or down (sign -1) across every question. */
export function reach(axis: Axis, sign: 1 | -1, questions = QUESTIONS): number {
  return questions.reduce((sum, q) => sum + Math.max(0, ...q.options.map((o) => sign * (o.weights[axis] ?? 0))), 0)
}

/**
 * Every axis starts undecided at 50. The net weight of the chosen answers moves it towards 100 or
 * 0 in proportion to how far that axis could have gone, then snaps to a multiple of 5.
 */
export function scoreQuiz(answers: Answers, questions = QUESTIONS): Scores {
  const scores = {} as Scores
  for (const { key } of AXES) {
    let net = 0
    for (const q of questions) {
      const picked = answers[q.id]
      if (picked !== undefined) net += q.options[picked]?.weights[key] ?? 0
    }
    const limit = reach(key, net >= 0 ? 1 : -1, questions)
    const raw = limit ? 50 + (50 * net) / limit : 50
    scores[key] = Math.min(100, Math.max(0, Math.round(raw / 5) * 5))
  }
  return scores
}

/** Where to go after the quiz: a path inside the app, never another site and never the quiz itself. */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || raw.startsWith('/quiz')) return '/app'
  return raw
}

/** The trip a `next` path points into, so a retake can update that trip's profile too. */
export function tripIdOf(next: string): string | undefined {
  return next.match(/^\/t\/([^/?#]+)/)?.[1]
}
