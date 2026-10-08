import { ensureSession, supabase } from '@/lib/supabase'
import { assistReplySchema, chatReplySchema, inferredProfileSchema, ideasSchema, type AIRequest } from './model'

export async function requestAI(request: AIRequest, signal?: AbortSignal) {
  const controller = new AbortController()
  const cancel = () => controller.abort(new Error('Idea generation cancelled. You can try again.'))
  // A chat line is one short reply; a draft can take over a minute.
  const timer = setTimeout(() => controller.abort(new Error('The planner took too long. Try again with fewer days or a shorter brief.')), request.action === 'chat' ? 20000 : request.action === 'assist' ? 45000 : 90000)
  signal?.addEventListener('abort', cancel, { once: true })
  if (signal?.aborted) cancel()
  let onAbort: () => void = () => {}
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(controller.signal.reason)
    controller.signal.addEventListener('abort', onAbort, { once: true })
    if (controller.signal.aborted) onAbort()
  })
  try {
    return await Promise.race([performRequest(request, controller.signal), aborted])
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
    controller.signal.removeEventListener('abort', onAbort)
  }
}

async function performRequest(request: AIRequest, signal: AbortSignal) {
  if (!navigator.onLine) throw new Error('Connect to the internet to generate new ideas. Your saved profiles and drafts still work offline.')
  await ensureSession()
  const { data } = await supabase.auth.getSession()
  signal.throwIfAborted()
  const response = await fetch('/api/travel-ai', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify(request), signal,
  })
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) {
    throw new Error('AI planning is not connected on this server yet. You can still set your preferences manually.')
  }
  const body: unknown = await response.json()
  if (!response.ok) {
    const error = typeof body === 'object' && body && 'error' in body ? String(body.error) : 'Could not generate ideas. Try again.'
    throw new Error(error)
  }
  return request.action === 'profile' ? inferredProfileSchema.parse(body) : request.action === 'chat' ? chatReplySchema.parse(body) : request.action === 'assist' ? assistReplySchema.parse(body) : ideasSchema.parse(body)
}
