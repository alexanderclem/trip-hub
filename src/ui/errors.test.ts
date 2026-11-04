import { describe, expect, it } from 'vitest'
import { friendlyError, NETWORK_MESSAGE } from './errors'

describe('friendlyError', () => {
  it.each(['TypeError: Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.', 'Network request failed'])('turns "%s" into advice', (m) => {
    expect(friendlyError(m)).toBe(NETWORK_MESSAGE)
  })
  it('keeps messages written for people', () => {
    expect(friendlyError('That email is already on the list.')).toBe('That email is already on the list.')
  })
})
