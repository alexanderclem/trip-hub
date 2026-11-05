// The homepage's trip: real places and real lake routes from our spring-break 2027 trip to
// Guatemala (seed/guatemala-2027). Traveler names, votes, times, tickets and amounts are examples
// and are labelled as such wherever they appear.

export type Code = 'GUA' | 'ANT' | 'PAN' | 'SMR' | 'SPL'

export const TRIP = {
  name: 'Spring break, Guatemala',
  season: 'Spring break 2027',
  route: ['GUA', 'ANT', 'PAN'] as Code[],
}

/** Example travelers. Real names stay off the page until the group says yes. */
export const TRAVELERS = ['Maya', 'Jordan', 'Sam', 'Priya', 'Leo', 'Ana', 'Theo', 'Rosa'] as const

export const PLACE_CODE: Record<string, Code> = {
  'La Aurora airport': 'GUA', Antigua: 'ANT', Panajachel: 'PAN', 'San Marcos La Laguna': 'SMR', 'San Pedro La Laguna': 'SPL',
}

/** Real places from the trip's idea pool (OpenStreetMap, via seed/guatemala-2027/places.json). */
export const IDEAS = [
  { name: 'El Mirador de La Cruz', town: 'Antigua', kind: 'Lookout', by: 'Maya' },
  { name: 'Arco de Santa Catalina', town: 'Antigua', kind: 'Sight', by: 'Jordan' },
  { name: 'Mercado de Artesanías', town: 'Antigua', kind: 'Market', by: 'Priya' },
  { name: 'Museo del Café', town: 'Antigua', kind: 'Coffee', by: 'Leo' },
  { name: 'Jardín Lago', town: 'Panajachel', kind: 'Garden', by: 'Ana' },
  { name: 'Café 6 Hermanas', town: 'San Marcos La Laguna', kind: 'Food', by: 'Theo' },
] as const

/**
 * Where do we stay at the lake? Each friend scores each town the way the app does:
 * 0 No way · 1 Fine · 2 Want · 3 Must-do. The seven example votes leave San Marcos and
 * San Pedro level, so the visitor's vote decides it.
 */
export const SCORES = ['No way', 'Fine', 'Want', 'Must-do'] as const
export const LAKE_OPTIONS = [
  { town: 'San Marcos La Laguna', code: 'SMR' as Code, boat: '20–35 min by lancha from Panajachel', votes: [3, 2, 2, 3, 1, 2, 3] },
  { town: 'San Pedro La Laguna', code: 'SPL' as Code, boat: '25–45 min by lancha from Panajachel', votes: [2, 3, 2, 2, 3, 3, 1] },
  { town: 'Panajachel', code: 'PAN' as Code, boat: 'The lancha dock is in town', votes: [1, 1, 2, 0, 2, 1, 2] },
]
export const total = (votes: readonly number[]) => votes.reduce((sum, value) => sum + value, 0)

/** The example plan. Travel times are from the trip's own route notes (seed/guatemala-2027/areas.json). */
export const DAYS = [
  { day: 1, from: 'GUA', to: 'ANT', title: 'Land and get to Antigua', items: [
    { time: '11:40', what: 'Arrive at La Aurora airport', state: 'confirmed' },
    { time: '13:00', what: 'Shuttle to Antigua', note: 'Ticket saved', state: 'confirmed' },
    { time: '19:30', what: 'Dinner near the Arco de Santa Catalina', state: 'tentative' },
  ] },
  { day: 2, from: 'ANT', to: 'ANT', title: 'Antigua on foot', items: [
    { time: '07:30', what: 'Walk up to El Mirador de La Cruz', state: 'confirmed' },
    { time: '10:00', what: 'Museo del Café', state: 'tentative' },
    { time: '15:00', what: 'Mercado de Artesanías', state: 'tentative' },
  ] },
  { day: 3, from: 'ANT', to: 'PAN', title: 'Over to Lake Atitlán', items: [
    { time: '08:00', what: 'Shuttle to Panajachel', note: '2½–3½ h', state: 'confirmed' },
    { time: '12:30', what: 'Lancha across the lake', note: 'Boats run about 6:30 am to 5 pm', state: 'confirmed' },
  ] },
] as const
