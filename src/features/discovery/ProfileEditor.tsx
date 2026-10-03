import { useState } from 'react'
import { Button, ErrorNote, Field, Textarea } from '@/ui'
import { requestAI } from './client'
import { AXES, classify, inferredProfileSchema, NEUTRAL, type Profile } from './model'
import { RadarChart } from './RadarChart'

export function ProfileEditor({ initial, onSave }: { initial: Profile | null; onSave(profile: Profile): Promise<void> }) {
  const [profile, setProfile] = useState<Profile>(initial ?? { scores: { ...NEUTRAL }, description: '', constraints: '' })
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  async function infer() {
    setBusy('infer'); setError(null); setMessage('')
    try {
      const result = inferredProfileSchema.parse(await requestAI({ action: 'profile', description: profile.description.trim() }))
      setProfile((p) => ({ ...p, scores: result.scores }))
      setMessage(`${result.explanation} Review the scores, then save your profile.`)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not interpret your preferences.') }
    finally { setBusy(null) }
  }
  async function save() {
    setBusy('save'); setError(null); setMessage('')
    try { await onSave(profile); setMessage('Profile saved. Your trip ideas will use these preferences.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save your profile.') }
    finally { setBusy(null) }
  }
  return <div className="space-y-5">
    <div><h2 className="travel-heading text-2xl">Your travel style</h2><p className="mt-2 text-sm leading-relaxed text-stone-600">Describe a great trip in your own words, or set the scores yourself. Higher means it matters more; 50 is undecided.</p></div>
    <Field label="What does your ideal trip feel like?"><Textarea maxLength={2000} value={profile.description} disabled={!!busy} onChange={(e) => setProfile((p) => ({ ...p, description: e.target.value }))} placeholder="I love street food and quiet beaches. One big hike is enough, and I’d rather skip clubs…" /></Field>
    <Button variant="secondary" onClick={() => void infer()} disabled={!!busy || !profile.description.trim()}>{busy === 'infer' ? 'Understanding your preferences…' : 'Let AI suggest my scores'}</Button>
    <ErrorNote error={error} />
    <p role="status" className="text-sm leading-relaxed text-brand-900">{busy === 'infer' ? 'Reading your description and updating the chart…' : message}</p>
    <div className="grid items-start gap-5 md:grid-cols-2">
      <div><RadarChart scores={profile.scores} /><p className="mt-2 text-center font-medium text-brand-900">{classify(profile.scores)}</p><p className="mt-1 text-center text-xs text-stone-500">A description of your interests, yours to change.</p></div>
      <div className="space-y-2">{AXES.map(({ key, label, hint }) => <label key={key} className="block rounded-xl border border-stone-200 px-3 py-2">
        <span className="flex justify-between gap-3 text-sm font-medium"><span>{label}{key === 'budget' ? ' consciousness' : ''}</span><output className="tabular-nums text-brand-700">{profile.scores[key]}</output></span>
        <span className="block text-xs text-stone-600">{hint}</span>
        <input type="range" min="0" max="100" step="5" value={profile.scores[key]} disabled={!!busy} aria-label={label === 'Budget' ? 'Budget consciousness' : label} aria-valuetext={`${profile.scores[key]} out of 100`} className="min-h-11 w-full accent-brand-700" onChange={(e) => setProfile((p) => ({ ...p, scores: { ...p.scores, [key]: Number(e.target.value) } }))} />
      </label>)}</div>
    </div>
    <Field label="Must-haves and things to avoid" hint="Dietary needs, mobility requirements, spending limits, or anything you want every suggestion to respect. Shared with this trip’s group when saved."><Textarea value={profile.constraints} maxLength={2000} disabled={!!busy} onChange={(e) => setProfile((p) => ({ ...p, constraints: e.target.value }))} placeholder="Vegetarian options, no strenuous hikes, private room…" /></Field>
    <Button onClick={() => void save()} disabled={!!busy}>{busy === 'save' ? 'Saving profile…' : 'Save my preferences'}</Button>
  </div>
}
