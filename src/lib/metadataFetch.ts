/** Bound metadata requests; file transfers and long-running functions keep their own limits. */
export const METADATA_TIMEOUT_MS = 15_000

export async function metadataFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (!/\/(rest|auth)\/v1\//.test(url)) return fetch(input, init)
  const controller = new AbortController()
  const upstream = init?.signal ?? (input instanceof Request ? input.signal : undefined)
  const abort = () => controller.abort(upstream?.reason)
  if (upstream?.aborted) abort()
  else upstream?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => controller.abort(new DOMException('The connection timed out. Your saved changes are kept; try again.', 'TimeoutError')), METADATA_TIMEOUT_MS)
  try {
    const response = await fetch(input, { ...init, signal: controller.signal })
    // Include a stalled JSON body in the deadline, while retaining the original Response metadata.
    await response.clone().arrayBuffer()
    return response
  } finally {
    clearTimeout(timer)
    upstream?.removeEventListener('abort', abort)
  }
}
