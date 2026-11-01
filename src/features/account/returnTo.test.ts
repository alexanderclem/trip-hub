import { beforeEach, describe, expect, it } from 'vitest'
import { isTripPath, rememberSignInReturn, takeSignInReturn } from './returnTo'

const trip = '0b9f7c1e-2a3d-4e5f-8a6b-7c8d9e0f1a2b'
beforeEach(() => {
  const store = new Map<string, string>()
  globalThis.sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } as Storage
})

describe('returning after sign-in', () => {
  it('keeps only paths inside a trip', () => {
    expect(isTripPath(`/t/${trip}/more/settings`)).toBe(true)
    for (const bad of ['//evil.example', 'https://evil.example', `/t/${trip}/../../x?y`, '/app', `/t/not-a-trip/plan`]) expect(isTripPath(bad)).toBe(false)
  })
  it('is used once', () => {
    rememberSignInReturn(`/t/${trip}/more/settings`)
    expect(takeSignInReturn()).toBe(`/t/${trip}/more/settings`)
    expect(takeSignInReturn()).toBeNull()
    rememberSignInReturn('//evil.example')
    expect(takeSignInReturn()).toBeNull()
  })
})
