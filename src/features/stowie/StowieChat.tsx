import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { DateTime } from 'luxon'
import { SendHorizontal } from 'lucide-react'
import { db } from '@/data/db'
import { useDevice, useMyMemberId } from '@/data/device'
import { useMembers, usePlaces, useTrip } from '@/data/hooks'
import { requestAI } from '@/features/discovery/client'
import { saveProfile, undoIdea, useDrafts, useProfiles } from '@/features/discovery/data'
import { assistReplySchema, chatReplySchema, inferredProfileSchema, type Profile } from '@/features/discovery/model'
import { tripAreas } from '@/features/destinations/destinations'
import { useItems } from '@/features/itinerary/data'
import { Button, Input } from '@/ui'
import { applyDraft, generateDraft } from './actions'
import { Bubble, ChipRow, DraftCard, ProfileCard, ProposalCard } from './chat'
import { carryOut, toProposal, type Link } from './proposal'
import { newThread, step, type Chip, type Ctx, type Effect, type Event, type Mood, type Screen, type Step, type Thread } from './script'
import { buildSnapshot, moneySummary, todayIn } from './snapshot'
import { Stowie } from './Stowie'

const PLACEHOLDER: Partial<Record<Step, string>> = {
  describe: 'I love street food and quiet beaches…',
  destination: 'A country, city or region',
  days: 'A number of days',
  budget: 'An amount, such as 800',
  refine: 'Less driving, keep the food market…',
  busy: 'Stowie is thinking…',
}
const message = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback)
/** Remembers the travel style someone had when they left for the quiz or the sliders. */
const leftKey = (scope: string) => `stowie-style-before:${scope}`

const PATHS: Record<Link, string> = { plan: 'plan', tasks: 'more/tasks', packing: 'more/packing', votes: 'more/vote', money: 'money' }

/**
 * The conversation itself: one private thread per trip (or one personal thread), kept on this
 * phone. The full page and the floating companion both show it, each with its own header.
 */
export function StowieChat({ tripId, screen = null, subject = null, sheet = false, header }: {
  tripId: string | undefined
  /** The trip screen this was opened over, for the first suggestions. */
  screen?: Screen | null
  subject?: string | null
  /** Shown in the companion's sheet, which reaches the bottom of the screen. */
  sheet?: boolean
  header(restart: () => void): ReactNode
}) {
  const scope = tripId ?? 'personal'
  const here = tripId ? `/t/${tripId}/more/ideas` : '/inspire'
  const navigate = useNavigate()
  const trip = useTrip(tripId)
  const memberId = useMyMemberId(tripId)
  const personal = useDevice((s) => s.travelProfile)
  const profiles = useProfiles(tripId)
  const members = useMembers(tripId)
  const places = usePlaces(tripId)
  const items = useItems(tripId ?? '')
  const drafts = useDrafts(scope)

  const mine = profiles?.find((p) => p.member_id === memberId) ?? null
  const saved: Profile | null = mine ?? personal
  const group: Profile[] = tripId ? (profiles ?? []).filter((p) => members?.some((member) => member.id === p.member_id)) : []
  // A profile saved on this phone counts before its copy reaches the trip.
  const included: Profile[] = tripId ? (mine || !personal ? group : [...group, personal]) : personal ? [personal] : []
  const tripDays = trip?.start_date && trip.end_date ? Math.round(DateTime.fromISO(trip.end_date).diff(DateTime.fromISO(trip.start_date), 'days').days) + 1 : null
  const latest = drafts?.[0]
  // Effects finish long after the render that started them, so they read the newest values here.
  const world = useRef({ trip, memberId, saved, included, tripDays, places, items, latest, members, screen, subject })
  world.current = { trip, memberId, saved, included, tripDays, places, items, latest, members, screen, subject }
  const ctx = useCallback((): Ctx => {
    const w = world.current
    return {
      tripName: tripId ? w.trip?.name ?? 'this trip' : null, hasProfile: !!w.saved, travelers: w.included.length,
      destination: tripId ? tripAreas(w.trip).map((a) => a.name).join(', ').slice(0, 160) : '',
      maxDays: Math.max(1, Math.min(14, w.tripDays ?? 14)), currency: w.trip?.base_currency ?? 'USD', online: navigator.onLine,
      latestDraft: w.latest ? { id: w.latest.id, applied: !!w.latest.application } : null,
      screen: w.screen, subject: w.subject,
    }
  }, [tripId])

  const [thread, setThread] = useState<Thread | null>(null)
  const current = useRef<Thread | null>(null)
  const [flash, setFlash] = useState<Mood | null>(null)
  const [focused, setFocused] = useState(false)
  const [text, setText] = useState('')
  const request = useRef<AbortController | null>(null)
  const alive = useRef(true)
  const log = useRef<HTMLDivElement>(null)
  const loaded = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort() } }, [])

  const commit = useCallback((next: Thread, mood?: Mood) => {
    const stamped = { ...next, updatedAt: new Date().toISOString() }
    current.current = stamped
    setThread(stamped)
    if (mood) setFlash(mood)
    void db.stowie_threads.put(stamped)
  }, [])
  useEffect(() => {
    if (!flash || flash === 'thinking') return
    const timer = setTimeout(() => setFlash(null), flash === 'delighted' ? 2400 : 1500)
    return () => clearTimeout(timer)
  }, [flash, thread])

  const perform = useCallback(async (effect: Effect): Promise<Event | null> => {
    const w = world.current
    const controller = new AbortController()
    request.current = controller
    switch (effect.type) {
      case 'go': {
        if (effect.to === 'quiz' || effect.to === 'manual') sessionStorage.setItem(leftKey(scope), JSON.stringify(w.saved?.scores ?? null))
        navigate(effect.to === 'build' ? `/new?draft=${effect.draftId}&idea=0` : effect.to === 'quiz' ? `/quiz?next=${encodeURIComponent(here)}` : effect.to === 'manual' ? `${here}/manual` : `/t/${tripId}/${PATHS[effect.to]}`)
        return null
      }
      case 'interpret': {
        const messages = current.current?.messages ?? []
        const draftId = current.current?.draft?.id
        try {
          const reply = chatReplySchema.parse(await requestAI({ action: 'chat', text: effect.text, context: {
            hasProfile: !!w.saved, destination: ctx().destination, inTrip: !!tripId,
            draftTitle: draftId ? (await db.ai_drafts.get(draftId))?.result.ideas[0]?.title.slice(0, 120) ?? null : null,
            recent: messages.slice(-7, -1).map((m) => ({ from: m.from, text: m.text.slice(0, 500) })),
          } }, controller.signal))
          return { type: 'interpreted', text: effect.text, reply }
        } catch { return { type: 'interpreted', text: effect.text, reply: null } }
      }
      case 'infer': {
        // What they said before still counts; the new line refines it.
        const description = [w.saved?.description, effect.description].filter(Boolean).join('\n').slice(-2000)
        try {
          const result = inferredProfileSchema.parse(await requestAI({ action: 'profile', description }, controller.signal))
          return { type: 'inferred', scores: result.scores, explanation: result.explanation, description }
        } catch (error) { return { type: 'failed', message: message(error, 'I couldn’t read that just now. Try again, or set your style by hand.') } }
      }
      case 'saveProfile': {
        const profile: Profile = { scores: effect.scores, description: effect.description, constraints: w.saved?.constraints ?? '' }
        try {
          if (tripId) {
            if (!w.memberId) throw new Error('Choose who you are before saving preferences.')
            await saveProfile(tripId, w.memberId, profile)
          }
          useDevice.getState().setTravelProfile(profile)
          return { type: 'profileSaved', scores: profile.scores }
        } catch (error) { return { type: 'failed', message: message(error, 'Could not save your travel style.') } }
      }
      case 'generate':
        try {
          // Their own style may have been saved a moment ago, before the live query caught up.
          const own = useDevice.getState().travelProfile
          const profiles = w.included.length ? w.included : own ? [own] : []
          const draftId = await generateDraft({ plan: effect.plan, trip: tripId ? w.trip ?? null : null, tripDays: w.tripDays, profiles, places: w.places ?? [], items: w.items ?? [], signal: controller.signal })
          return { type: 'drafted', draftId }
        } catch (error) { return { type: 'failed', message: message(error, 'I couldn’t sketch that. Your earlier drafts are safe.') } }
      case 'apply':
        try {
          if (!w.trip || !w.memberId) throw new Error('Open this trip and choose who you are before adding a draft.')
          return { type: 'applied', count: await applyDraft(effect.draftId, w.trip, w.memberId) }
        } catch (error) { return { type: 'failed', message: message(error, 'Could not add this draft.') } }
      case 'undo':
        try {
          if (!w.memberId) throw new Error('Choose who you are before undoing a draft.')
          return { type: 'undone', ...(await undoIdea(effect.draftId, w.memberId)) }
        } catch (error) { return { type: 'failed', message: message(error, 'Could not undo this draft.') } }
      case 'tally':
        try {
          if (!w.trip || !w.memberId) throw new Error('Open this trip and choose who you are first.')
          return { type: 'assisted', reply: (await moneySummary(w.trip, w.memberId)).mine, proposal: null, link: 'money' }
        } catch (error) { return { type: 'failed', message: message(error, 'I couldn’t add up the balances.') } }
      case 'assist':
        try {
          if (!w.trip || !w.memberId) throw new Error('Open this trip and choose who you are first.')
          const me = w.members?.find((m) => m.id === w.memberId)?.display_name ?? ''
          const reply = assistReplySchema.parse(await requestAI({
            action: 'assist', tripId: w.trip.id, text: effect.text, me, today: todayIn(w.trip),
            snapshot: await buildSnapshot(w.trip, w.memberId, effect.topics),
          }, controller.signal))
          // One topic means one obvious place to look; several don't.
          const only = effect.topics.length === 1 ? effect.topics[0]! : null
          const link: Link | null = only === 'plan' || only === 'tasks' || only === 'packing' || only === 'votes' || only === 'money' ? only : null
          return { type: 'assisted', reply: reply.reply, proposal: toProposal(reply, w.trip, w.members ?? [], w.memberId), link }
        } catch (error) { return { type: 'failed', message: message(error, 'I couldn’t look that up just now.') } }
      case 'act':
        try {
          if (!w.trip || !w.memberId) throw new Error('Open this trip and choose who you are first.')
          return { type: 'acted', ...(await carryOut(effect.proposal, w.trip, w.memberId)) }
        } catch (error) { return { type: 'failed', message: message(error, 'Could not add that. Nothing was changed.') } }
    }
  }, [ctx, here, navigate, scope, tripId])

  const dispatch = useCallback(async (event: Event) => {
    let next: Event | null = event
    while (next && current.current && alive.current) {
      const outcome = step(current.current, next, ctx())
      if (outcome.thread !== current.current) commit(outcome.thread, outcome.mood)
      next = outcome.effect ? await perform(outcome.effect) : null
    }
  }, [commit, ctx, perform])

  const ready = !tripId || (!!trip && profiles !== undefined && members !== undefined)
  useEffect(() => {
    if (!ready || drafts === undefined || loaded.current) return
    loaded.current = true
    void db.stowie_threads.get(scope).then((stored) => {
      if (!alive.current) return
      if (!stored) { commit(step(newThread(scope), { type: 'open' }, ctx()).thread, 'talking'); return }
      // Threads saved by an earlier version gain any fields added since.
      stored = { ...newThread(scope), ...stored }
      current.current = stored
      setThread(stored)
      if (stored.step === 'busy') { void dispatch({ type: 'interrupted' }); return }
      void dispatch({ type: 'arrive' })
      // Back from the quiz or the sliders with a new travel style: carry on from there.
      const before = sessionStorage.getItem(leftKey(scope))
      sessionStorage.removeItem(leftKey(scope))
      const now = world.current.saved
      if (before !== null && now && JSON.stringify(now.scores) !== before && ['style', 'describe', 'profile'].includes(stored.step)) void dispatch({ type: 'profileSaved', scores: now.scores })
    })
  }, [commit, ctx, dispatch, drafts, ready, scope])

  // A card is taller than the screen: show where it starts. Anything else, show the newest line.
  const newest = thread?.messages.at(-1)
  const follow = useCallback(() => {
    const last = current.current?.messages.at(-1)
    if (last?.card) log.current?.querySelector('[data-newest]')?.scrollIntoView({ block: 'start' })
    else log.current?.scrollTo({ top: log.current.scrollHeight })
  }, [])
  useEffect(follow, [follow, newest?.id])

  function send(e: FormEvent) {
    e.preventDefault()
    if (!text.trim() || thread?.step === 'busy') return
    setText('')
    void dispatch({ type: 'text', text })
  }
  async function restart() {
    request.current?.abort()
    await db.stowie_threads.delete(scope)
    commit(step(newThread(scope), { type: 'open' }, ctx()).thread, 'talking')
  }

  if (!thread) return <div>{header(() => {})}<p role="status" className="p-5">Waking Stowie…</p></div>
  const busy = thread.step === 'busy'
  const mood: Mood = busy ? 'thinking' : flash ?? (focused ? 'listening' : 'idle')
  const numeric = thread.step === 'days' || thread.step === 'budget'
  return (
    <div className="flex h-full min-h-0 flex-col">
      {header(() => void restart())}
      <div ref={log} role="log" aria-label="Conversation with Stowie" className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {thread.messages.map((m) => (
            <div key={m.id} data-newest={m.id === newest?.id ? '' : undefined} className="flex flex-col gap-2">
              <Bubble from={m.from}>{m.text}</Bubble>
              {m.card?.kind === 'profile' && <ProfileCard scores={m.card.scores} />}
              {m.card?.kind === 'proposal' && <ProposalCard proposal={m.card.proposal} state={m.card.state} />}
              {m.card?.kind === 'draft' && <DraftCard draftId={m.card.draftId} profiles={included} onLoad={m.id === newest?.id ? follow : undefined} />}
            </div>
          ))}
        </div>
      </div>
      <div className={`shrink-0 border-t border-stone-200 bg-surface px-4 pt-3 ${tripId && !sheet ? 'pb-3' : 'pb-[max(0.75rem,env(safe-area-inset-bottom))]'}`}>
        <div className="mx-auto max-w-2xl">
          <div className="flex items-end gap-3">
            <Stowie mood={mood} size={60} />
            <div className="min-w-0 flex-1 pb-2">
              {busy ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p role="status" className="text-sm text-stone-600">{thread.pending?.type === 'generate' ? 'Stowie is sketching your trip…' : thread.pending?.type === 'assist' || thread.pending?.type === 'tally' ? 'Stowie is checking the trip…' : 'Stowie is thinking…'}</p>
                  {thread.pending?.type === 'generate' && <Button variant="secondary" onClick={() => request.current?.abort()}>Stop</Button>}
                </div>
              ) : (
                <ChipRow chips={thread.chips} onPick={(chip: Chip) => void dispatch({ type: 'chip', chip })} />
              )}
            </div>
          </div>
          <form onSubmit={send} className="mt-3 flex items-center gap-2">
            <label htmlFor="stowie-message" className="sr-only">Message Stowie</label>
            <Input
              id="stowie-message" value={text} disabled={busy} maxLength={1000} autoComplete="off" enterKeyHint="send"
              inputMode={numeric ? 'decimal' : 'text'} placeholder={PLACEHOLDER[thread.step] ?? (tripId ? 'Ask about the trip…' : 'Tell Stowie what you’re imagining…')}
              onChange={(e) => setText(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            />
            <button type="submit" className="ui-icon-button shrink-0 bg-brand-700 text-white disabled:opacity-45" aria-label="Send" disabled={busy || !text.trim()}><SendHorizontal aria-hidden="true" className="size-5" /></button>
          </form>
        </div>
      </div>
    </div>
  )
}
