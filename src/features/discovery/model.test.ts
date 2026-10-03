import { describe, expect, it } from 'vitest'
import { AXES, NEUTRAL, classify, combine, matchScore, scoresSchema, type Profile } from './model'

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
