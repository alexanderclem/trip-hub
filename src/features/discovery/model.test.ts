import { describe, expect, it } from 'vitest'
import { AXES, NEUTRAL, classify, combine, dayLabel, ideaSchema, matchScore, scoresSchema, tidyIdea, type Idea, type Profile } from './model'

const profile = (n: number): Profile => ({ scores: Object.fromEntries(AXES.map((a) => [a.key, n])) as Profile['scores'], description: '', constraints: '' })
describe('travel preferences', () => {
  it('excludes missing profiles instead of assuming neutral interests', () => {
    expect(combine([])).toBeNull()
    expect(combine([profile(80)])?.mean).toEqual(profile(80).scores)
  })
  it('averages everyone equally and preserves conflicting extremes', () => {
    const group = combine([profile(0), profile(100), profile(80)])!
    expect(group.mean.nature).toBe(60)
    expect(group.low.nature).toBe(0)
    expect(group.high.nature).toBe(100)
    expect(group.disagreements).toHaveLength(8)
  })
  it('penalizes ideas that poorly serve one traveler', () => {
    const profiles = [profile(100), profile(100), profile(0)]
    expect(matchScore(profile(100).scores, profiles, 'everyone')).toBeLessThan(matchScore(profile(100).scores, profiles, 'average'))
    expect(matchScore(profile(50).scores, profiles, 'everyone')).toBeGreaterThan(matchScore(profile(100).scores, profiles, 'everyone'))
    expect(matchScore(profile(80).scores, [profile(80)])).toBe(100)
  })
  it('rejects incomplete, fractional or out-of-range scores', () => {
    expect(scoresSchema.safeParse({ ...NEUTRAL, food: 110 }).success).toBe(false)
    expect(scoresSchema.safeParse({ ...NEUTRAL, food: 24.5 }).success).toBe(false)
    expect(scoresSchema.safeParse({ food: 30 }).success).toBe(false)
  })
  it('uses editable interest labels without inferring sensitive traits', () => {
    expect(classify(NEUTRAL)).toBe('Flexible traveler')
    expect(classify({ ...NEUTRAL, food: 95, nature: 80 })).toBe('Food explorer · Nature lover')
  })
})

describe('tidying a draft', () => {
  const at = (title: string, time: string, durationMinutes: number, notes = '') => ({ title, kind: 'activity' as const, time, durationMinutes, placeName: null, existingPlaceId: null, notes, costMinor: null })
  const idea = (activities: ReturnType<typeof at>[], title = 'Day 1'): Idea => ({ title: 'New York', destination: 'New York', timezone: 'America/New_York', currency: 'USD', summary: 's', why: 'w', tradeoffs: '', scores: NEUTRAL, estimatedCostMinor: null, days: [{ title, activities }], tasks: [] })
  const day = (i: Idea) => tidyIdea(i).days[0]!.activities.map((a) => [a.title, a.time, a.durationMinutes, a.notes])

  it('renames an activity called "Day 1", drops echoed notes and removes the overlap', () => {
    const tidy = tidyIdea(idea([
      at('Day 1', '09:00', 180, 'Visit the Metropolitan Museum of Art'),
      at('Visit the Met and Central Park', '11:00', 120, 'Visit the Central Park'),
      at('Visit the High Line', '14:00', 240, 'Visit the High Line.'),
    ]))
    expect(tidy.days[0]!.activities.map((a) => [a.title, a.time, a.durationMinutes, a.notes])).toEqual([
      ['Visit the Metropolitan Museum of Art', '09:00', 120, ''],
      ['Visit the Met and Central Park', '11:00', 120, 'Visit the Central Park'],
      ['Visit the High Line', '14:00', 240, ''],
    ])
    expect(ideaSchema.safeParse(tidy).success).toBe(true)
  })
  it('puts activities in time order, moves one that starts too soon, and drops one the day has no room for', () => {
    expect(day(idea([at('Dinner', '19:00', 90), at('Market', '10:00', 60), at('Coffee', '10:15', 30)]))).toEqual([['Market', '10:00', 60, ''], ['Coffee', '11:00', 30, ''], ['Dinner', '19:00', 90, '']])
    expect(day(idea([at('Late show', '22:00', 120), at('Nightcap', '22:10', 30)]))).toEqual([['Late show', '22:00', 120, '']])
  })
  it('leaves a clean day alone, and labels days without repeating "Day 1"', () => {
    const clean = idea([at('Market', '10:00', 60, 'Go early'), at('Museum', '11:00', 90)], 'Markets and art')
    expect(tidyIdea(clean)).toEqual(clean)
    expect(dayLabel(0, 'Day 1')).toBe('Day 1')
    expect(dayLabel(1, 'Markets and art')).toBe('Day 2 · Markets and art')
  })
})
