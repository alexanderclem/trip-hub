import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { AXES, NEUTRAL, classify, scoresSchema } from '@/features/discovery/model'
import { QUESTIONS, reach, safeNext, scoreQuiz, tripIdOf, type Answers } from './quiz'

const answersArb = fc.tuple(...QUESTIONS.map((q) => fc.option(fc.nat(q.options.length - 1), { nil: undefined })))
  .map((picks) => Object.fromEntries(QUESTIONS.map((q, i) => [q.id, picks[i]])) as Answers)

/** Picks, for every question, the option that pushes one axis furthest in one direction. */
const extreme = (axis: (typeof AXES)[number]['key'], sign: 1 | -1): Answers => Object.fromEntries(QUESTIONS.map((q) => {
  const values = q.options.map((o) => sign * (o.weights[axis] ?? 0))
  return [q.id, values.indexOf(Math.max(...values))]
}))

describe('opening quiz', () => {
  it('always produces scores the server accepts, in steps of 5', () => {
    fc.assert(fc.property(answersArb, (answers) => {
      const scores = scoreQuiz(answers)
      expect(scoresSchema.safeParse(scores).success).toBe(true)
      for (const { key } of AXES) expect(scores[key] % 5).toBe(0)
    }))
  })

  it('leaves everything undecided when nothing is answered', () => {
    expect(scoreQuiz({})).toEqual(NEUTRAL)
  })

  it('can make every interest a focus, and can rule every one out', () => {
    for (const { key, type } of AXES) {
      const high = scoreQuiz(extreme(key, 1))
      expect(high[key], key).toBeGreaterThanOrEqual(65)
      expect(classify(high), key).toContain(type)
      expect(scoreQuiz(extreme(key, -1))[key], key).toBeLessThanOrEqual(35)
    }
  })

  it('spreads each interest across several questions', () => {
    for (const { key } of AXES) {
      for (const sign of [1, -1] as const) {
        const total = reach(key, sign)
        const shares = QUESTIONS.map((q) => Math.max(0, ...q.options.map((o) => sign * (o.weights[key] ?? 0))) / total)
        expect(Math.max(...shares), `${key} ${sign}`).toBeLessThanOrEqual(0.4)
        expect(shares.filter((s) => s > 0).length, `${key} ${sign}`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('gives every question at least three answers with distinct effects', () => {
    for (const q of QUESTIONS) {
      expect(q.options.length).toBeGreaterThanOrEqual(3)
      expect(new Set(q.options.map((o) => JSON.stringify(o.weights))).size).toBe(q.options.length)
    }
  })

  it('only returns to paths inside the app', () => {
    expect(safeNext('/t/abc/map')).toBe('/t/abc/map')
    expect(safeNext('/t/abc/more/settings?x=1')).toBe('/t/abc/more/settings?x=1')
    for (const bad of [null, '', 'https://evil.example', '//evil.example', '/\\evil.example', '/quiz?next=/', 'map']) expect(safeNext(bad)).toBe('/app')
    expect(tripIdOf('/t/abc/more/ideas')).toBe('abc')
    expect(tripIdOf('/inspire')).toBeUndefined()
  })
})
