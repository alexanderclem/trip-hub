import { useDevice } from '@/data/device'

/**
 * Optional touch and sound cues for the moments that finish something: a tick, a vote, a save.
 * Both are per-phone preferences (Settings → On this phone). Nothing here throws, waits or
 * blocks: a cue is a fire-and-forget side effect of a change that has already been shown.
 *
 * Haptics: `navigator.vibrate` where it exists (Android). iPhone Safari has no vibrate API, but
 * toggling an `<input type="checkbox" switch>` (Safari 17.4+) through its label plays the system
 * tick, so on iOS a hidden switch is flipped instead. Both only fire from inside a tap.
 *
 * Sound: a few milliseconds of Web Audio, generated, with no files to download or cache. The
 * audio session is "ambient" so a cue never pauses someone's music and respects the mute switch.
 */
export type Cue = 'tap' | 'toggle' | 'success' | 'error'

const VIBRATION: Record<Cue, number | number[]> = { tap: 6, toggle: 10, success: [10, 60, 16], error: [24, 40, 24] }
// Frequency (Hz) and length (ms) of each note.
const NOTES: Record<Cue, [number, number][]> = {
  tap: [[1240, 22]],
  toggle: [[880, 34]],
  success: [[784, 60], [1175, 90]],
  error: [[330, 70], [262, 110]],
}

const canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
const canSwitchTick = () => typeof document !== 'undefined' && 'switch' in document.createElement('input')

/** True when this phone can give a touch cue at all, so Settings can hide a switch that does nothing. */
export const hapticsSupported = () => canVibrate() || canSwitchTick()

let switchLabel: HTMLLabelElement | null = null
function switchTick() {
  if (!switchLabel) {
    switchLabel = document.createElement('label')
    switchLabel.setAttribute('aria-hidden', 'true')
    switchLabel.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    input.tabIndex = -1
    switchLabel.append(input)
    // Keep the hidden switch's own click and change events out of the app's listeners.
    switchLabel.addEventListener('click', (event) => event.stopPropagation())
    input.addEventListener('change', (event) => event.stopPropagation())
  }
  // Outside an open modal everything is inert, so the switch has to sit inside it to toggle.
  const host = document.querySelector('dialog:modal') ?? document.body
  if (switchLabel.parentElement !== host) host.append(switchLabel)
  const focused = document.activeElement as HTMLElement | null
  switchLabel.click()
  if (focused && document.activeElement !== focused) focused.focus({ preventScroll: true })
}

let audio: AudioContext | null = null
function play(cue: Cue) {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
  if (session && session.type !== 'ambient') session.type = 'ambient'
  audio ??= new AudioContext()
  if (audio.state === 'suspended') void audio.resume()
  let at = audio.currentTime + 0.005
  for (const [frequency, length] of NOTES[cue]) {
    const seconds = length / 1000
    const tone = audio.createOscillator()
    const gain = audio.createGain()
    tone.type = 'sine'
    tone.frequency.value = frequency
    // A fast attack and an exponential tail: a tick, not a beep.
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(cue === 'tap' ? 0.035 : 0.06, at + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds)
    tone.connect(gain).connect(audio.destination)
    tone.start(at)
    tone.stop(at + seconds + 0.02)
    at += seconds * 0.8
  }
}

/** Play a cue if this phone has asked for one. Call it from the tap itself, not after an await. */
export function cue(kind: Cue, force?: { haptics?: boolean; sound?: boolean }) {
  if (typeof window === 'undefined') return
  const prefs = useDevice.getState().cues
  try {
    if (force?.haptics ?? prefs.haptics) {
      if (canVibrate()) navigator.vibrate(VIBRATION[kind])
      else if (canSwitchTick()) switchTick()
    }
  } catch { /* A cue is never worth an error. */ }
  try { if (force?.sound ?? prefs.sound) play(kind) } catch { /* Same. */ }
}
