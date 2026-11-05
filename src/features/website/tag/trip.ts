// The public site's Paris trip. Travelers, votes, times, tickets and amounts are illustrative;
// the homepage labels them together as an example trip.

export type Code = 'CDG' | 'PAR' | 'VRS' | 'MON' | 'MAR' | 'LAT'

export const TRIP = {
  name: 'Paris with friends',
  destination: 'Paris',
  season: 'Spring 2027',
  route: ['CDG', 'PAR', 'VRS'] as Code[],
}

export const TRAVELERS = ['Maya', 'Jordan', 'Sam', 'Priya', 'Leo', 'Ana', 'Theo', 'Rosa'] as const

export const IDEAS = [
  { name: 'Eiffel Tower', town: 'Paris', code: 'PAR', kind: 'Sight', by: 'Maya' },
  { name: 'Louvre', town: 'Paris', code: 'PAR', kind: 'Museum', by: 'Jordan' },
  { name: 'Montmartre', town: 'Paris', code: 'MON', kind: 'Neighborhood', by: 'Priya' },
  { name: 'Musée d’Orsay', town: 'Paris', code: 'PAR', kind: 'Museum', by: 'Leo' },
  { name: 'Luxembourg Gardens', town: 'Paris', code: 'LAT', kind: 'Garden', by: 'Ana' },
  { name: 'Palace of Versailles', town: 'Versailles', code: 'VRS', kind: 'Sight', by: 'Theo' },
] as const

/** Seven example votes leave the top two tied until the visitor votes. */
export const SCORES = ['No way', 'Fine', 'Want', 'Must-do'] as const
export const NEIGHBORHOODS = [
  { name: 'Montmartre', code: 'MON' as Code, detail: 'Sacré-Cœur and the hilltop streets', votes: [3, 2, 2, 3, 1, 2, 3] },
  { name: 'Le Marais', code: 'MAR' as Code, detail: 'Shops, cafés and Place des Vosges', votes: [2, 3, 2, 2, 3, 3, 1] },
  { name: 'Latin Quarter', code: 'LAT' as Code, detail: 'Bookshops and Luxembourg Gardens', votes: [1, 1, 2, 0, 2, 1, 2] },
]
export const total = (votes: readonly number[]) => votes.reduce((sum, value) => sum + value, 0)

export const DAYS = [
  { day: 1, from: 'CDG', to: 'PAR', title: 'Arrive in Paris', items: [
    { time: '11:40', what: 'Land at Charles de Gaulle', state: 'confirmed' },
    { time: '13:00', what: 'Transfer to the hotel', note: 'Confirmation saved', state: 'confirmed' },
    { time: '19:30', what: 'Dinner near the Eiffel Tower', state: 'tentative' },
  ] },
  { day: 2, from: 'PAR', to: 'PAR', title: 'A day in Paris', items: [
    { time: '09:00', what: 'Louvre', state: 'confirmed' },
    { time: '12:30', what: 'Lunch by the Tuileries', state: 'tentative' },
  ] },
  { day: 3, from: 'PAR', to: 'VRS', title: 'Versailles for the day', items: [
    { time: '09:00', what: 'Train to Versailles', note: 'Ticket saved', state: 'confirmed' },
    { time: '10:00', what: 'Palace of Versailles', state: 'confirmed' },
    { time: '17:00', what: 'Return to Paris', state: 'tentative' },
  ] },
] as const
