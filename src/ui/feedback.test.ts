import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDevice } from '@/data/device'
import { cue } from './feedback'

describe('cue', () => {
  const vibrate = vi.fn()
  beforeEach(() => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', { vibrate })
    vibrate.mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    useDevice.setState({ cues: { haptics: true, sound: false } })
  })

  it('vibrates by default, with a longer pattern for a finish than a tap', () => {
    cue('tap')
    cue('success')
    expect(vibrate).toHaveBeenNthCalledWith(1, 6)
    expect(vibrate).toHaveBeenNthCalledWith(2, [10, 60, 16])
  })

  it('stays still when this phone turned touch cues off', () => {
    useDevice.getState().setCues({ haptics: false })
    cue('success')
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('lets Settings preview a cue while the preference is off', () => {
    useDevice.getState().setCues({ haptics: false })
    cue('success', { haptics: true, sound: false })
    expect(vibrate).toHaveBeenCalledOnce()
  })

  it('never throws, even when the platform refuses', () => {
    vibrate.mockImplementation(() => { throw new Error('blocked') })
    useDevice.getState().setCues({ sound: true }) // no AudioContext in node either
    expect(() => cue('error')).not.toThrow()
  })
})
