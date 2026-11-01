// Where to go after signing in, when it was started from a trip (for example "Organize this trip").
// Only paths inside a trip on this site are kept, so this can never redirect anywhere else.

const RETURN_KEY = 'stowaway-signin-return'
const TRIP_PATH = /^\/t\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/[\w/-]*)?(#[\w-]+)?$/

export const isTripPath = (path: string) => TRIP_PATH.test(path)

export function rememberSignInReturn(path: string) {
  if (!isTripPath(path)) return
  try { sessionStorage.setItem(RETURN_KEY, path) } catch { /* private mode: falls back to the trip list */ }
}

export function takeSignInReturn(): string | null {
  try {
    const value = sessionStorage.getItem(RETURN_KEY)
    sessionStorage.removeItem(RETURN_KEY)
    return value && isTripPath(value) ? value : null
  } catch {
    return null
  }
}
