// Where to go after signing in from a trip or the operator dashboard.
// Only validated trip paths and exact operator routes on this site are kept.

const RETURN_KEY = 'stowaway-signin-return'
const TRIP_PATH = /^\/t\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/[\w/-]*)?(#[\w-]+)?$/

export const isTripPath = (path: string) => TRIP_PATH.test(path)
const isReturnPath = (path: string) => isTripPath(path) || ['/organize', '/organize/travelers', '/organize/campaigns', '/organize/import'].includes(path)

export function rememberSignInReturn(path: string) {
  if (!isReturnPath(path)) return
  try { sessionStorage.setItem(RETURN_KEY, path) } catch { /* private mode: falls back to the trip list */ }
}

export function takeSignInReturn(): string | null {
  try {
    const value = sessionStorage.getItem(RETURN_KEY)
    sessionStorage.removeItem(RETURN_KEY)
    return value && isReturnPath(value) ? value : null
  } catch {
    return null
  }
}
