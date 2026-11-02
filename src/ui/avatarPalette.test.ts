import { describe, expect, it } from 'vitest'
import { avatarPalette } from './avatarPalette'

describe('avatar contrast', () => {
  it('uses dark initials on pale traveler colors and white initials on dark colors', () => {
    expect(avatarPalette('#ef9477').lightText).toBe(false)
    expect(avatarPalette('#ca8a04').lightText).toBe(false)
    expect(avatarPalette('#245b69').lightText).toBe(true)
  })
  it('uses a readable fixed fallback in either theme', () => {
    expect(avatarPalette(null)).toEqual({ background: '#245b69', lightText: true })
    expect(avatarPalette('invalid')).toEqual(avatarPalette(null))
  })
})
