import { describe, expect, it } from 'vitest'
import { syncLabel } from './presentation'

describe('truthful sync state', () => {
  it('distinguishes uploads, refreshes and completed work', () => {
    expect(syncLabel(true, 'syncing', 2, 0)).toBe('Uploading changes…')
    expect(syncLabel(true, 'refreshing', 0, 0)).toBe('Checking for updates…')
    expect(syncLabel(true, 'syncing', 0, 0)).toBe('Checking for updates…')
    expect(syncLabel(true, 'idle', 0, 0)).toBe('Up to date')
  })
  it('never hides rejected changes behind background refresh activity', () => {
    expect(syncLabel(true, 'refreshing', 0, 1)).toBe('Needs attention')
    expect(syncLabel(true, 'error', 0, 0)).toBe('Needs attention')
    expect(syncLabel(false, 'refreshing', 1, 0)).toBe('Offline')
  })
})
