import { ensureSession, supabase } from '@/lib/supabase'
import { inferredProfileSchema, ideasSchema, type AIRequest } from './model'

export async function requestAI(request: AIRequest) {
  if (!navigator.onLine) throw new Error('Connect to the internet to generate new ideas. Your saved profiles and drafts still work offline.')
  await ensureSession()
  const { data } = await supabase.auth.getSession()
  const response = await fetch('/api/travel-ai', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify(request), signal: AbortSignal.timeout(90000),
  })
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) {
    throw new Error('AI planning is not connected on this server yet. You can still set your preferences manually.')
  }
  const body: unknown = await response.json()
  if (!response.ok) {
    const error = typeof body === 'object' && body && 'error' in body ? String(body.error) : 'Could not generate ideas. Try again.'
    throw new Error(error)
  }
  return request.action === 'profile' ? inferredProfileSchema.parse(body) : ideasSchema.parse(body)
}
