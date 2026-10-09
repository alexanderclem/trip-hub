import { describe, expect, it } from 'vitest'
import { normalizeVenmo, travelerInitials } from './traveler'

describe('traveler profile', () => {
  it('uses the first and last name, with useful single-name and empty fallbacks', () => {
    expect(travelerInitials('  Ana Maria Rivera ')).toBe('AR')
    expect(travelerInitials('Ben Carter')).toBe('BC')
    expect(travelerInitials('Ana')).toBe('AN')
    expect(travelerInitials('')).toBe('?')
  })
  it('normalizes usernames and Venmo profile links', () => {
    for (const input of ['@ana-rivera', 'ana-rivera', 'https://venmo.com/u/ana-rivera', 'https://www.venmo.com/ana-rivera/']) expect(normalizeVenmo(input)).toBe('ana-rivera')
    expect(normalizeVenmo('')).toBeNull()
  })
  it('rejects other domains and invalid usernames', () => {
    for (const input of ['https://venmo.com.evil.test/u/ana-rivera', 'https://evil.test/ana-rivera', 'https://venmo.com/u/ana-rivera?x=1', 'ana rivera', 'a', 'javascript:alert(1)']) expect(() => normalizeVenmo(input)).toThrow()
  })
})
