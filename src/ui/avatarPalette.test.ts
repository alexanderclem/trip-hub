import { describe, expect, it } from 'vitest'
import { AVATAR_DEFAULTS, avatarPalette } from './avatarPalette'

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
  it('gives travelers without a color a stable default from the calm set, all with white initials', () => {
    for (const color of AVATAR_DEFAULTS) expect(avatarPalette(color).lightText).toBe(true)
    expect(avatarPalette(null, 'Maya')).toEqual(avatarPalette(null, 'Maya'))
    expect(AVATAR_DEFAULTS).toContain(avatarPalette(null, 'Jordan').background as (typeof AVATAR_DEFAULTS)[number])
    const names = ['Alex', 'Maya', 'Jordan', 'Priya', 'Sam', 'Leo', 'Ana', 'Theo']
    expect(new Set(names.map((name) => avatarPalette(null, name).background)).size).toBeGreaterThan(3)
    // A chosen color always wins over the default.
    expect(avatarPalette('#ef9477', 'Maya').background).toBe('#ef9477')
  })
})
