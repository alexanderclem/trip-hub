// Browsers report a request that never reached the server in their own words: Chrome "Failed to
// fetch", Safari "Load failed", Firefox "NetworkError when attempting to fetch resource.", and
// supabase-js passes them on as "TypeError: …". None of them tell a person what to do.
const NETWORK = /failed to fetch|load failed|networkerror|network request failed/i

export const NETWORK_MESSAGE = 'We couldn’t reach Stowaway. Check your connection and try again.'

/** The message to show for an error: a dropped connection becomes advice, anything else is kept. */
export function friendlyError(message: string): string {
  return NETWORK.test(message) ? NETWORK_MESSAGE : message
}
