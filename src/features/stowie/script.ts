import { classify, type ChatReply, type Scores, type Topic } from '@/features/discovery/model'
import type { Link, Proposal } from './proposal'

/**
 * Stowie's side of the conversation: planning a trip, and answering questions about one. `step` is pure: it owns every scripted line, the
 * reply chips and what happens next, and asks the screen to do anything that touches the network
 * or the database by returning an effect. The effect's result comes back in as another event.
 */
export type Mood = 'idle' | 'listening' | 'thinking' | 'talking' | 'delighted' | 'oops'
export interface Chip { id: string; label: string }
export type Card =
  | { kind: 'profile'; scores: Scores; description: string }
  | { kind: 'draft'; draftId: string }
  /** Something Stowie offers to add. Nothing is written while it is pending. */
  | { kind: 'proposal'; proposal: Proposal; state: 'pending' | 'done' | 'dismissed' }
export interface Message { id: number; from: 'stowie' | 'me'; text: string; card?: Card }

/** The brief in progress. null means Stowie hasn't asked yet; '' is "you pick", 'none' is "no limit". */
export interface Plan { prompt: string; destination: string | null; days: number | null; budget: number | 'none' | null; refineDraftId: string | null }
export type Step = 'style' | 'describe' | 'profile' | 'imagine' | 'destination' | 'days' | 'budget' | 'draft' | 'refine' | 'applied' | 'confirm' | 'busy'

export interface Thread {
  scope: string // trip id, or 'personal'; stays on this device
  seq: number
  messages: Message[]
  chips: Chip[]
  step: Step
  /** The step to return to when the pending effect finishes or fails. */
  back: Step
  pending: Effect | null
  /** Where the conversation was before Stowie offered to add something. */
  resume: Step
  plan: Plan
  draft: { id: string; applied: boolean } | null
  updatedAt: string
}

export interface Ctx {
  tripName: string | null
  hasProfile: boolean
  /** Travelers with a saved travel style, including this one. */
  travelers: number
  /** The trip's own destination; '' outside a trip or before one is set. */
  destination: string
  maxDays: number
  currency: string
  online: boolean
  latestDraft: { id: string; applied: boolean } | null
  /** The trip screen Stowie was opened over, which decides the first suggestions. null in the full-page chat. */
  screen: Screen | null
  /** What that screen is about, such as the name of the place being viewed. */
  subject: string | null
}
export type Screen = 'overview' | 'plan' | 'map' | 'places' | 'place' | 'tickets' | 'money' | 'tasks' | 'packing' | 'votes'

export type Effect =
  | { type: 'interpret'; text: string }
  | { type: 'infer'; description: string }
  | { type: 'saveProfile'; scores: Scores; description: string }
  | { type: 'generate'; plan: Plan }
  | { type: 'apply'; draftId: string }
  | { type: 'undo'; draftId: string }
  /** Answer from the parts of the trip the question needs. */
  | { type: 'assist'; text: string; topics: Topic[] }
  /** Balances, worked out on the phone: exact, and available offline. */
  | { type: 'tally' }
  | { type: 'act'; proposal: Proposal }
  | { type: 'go'; to: 'quiz' | 'manual' | Link }
  | { type: 'go'; to: 'build'; draftId: string }

export type Event =
  | { type: 'open' }
  /** The saved conversation was reopened, possibly over a different screen. */
  | { type: 'arrive' }
  | { type: 'chip'; chip: Chip }
  | { type: 'text'; text: string }
  | { type: 'interpreted'; text: string; reply: ChatReply | null }
  | { type: 'inferred'; scores: Scores; explanation: string; description: string }
  | { type: 'profileSaved'; scores: Scores }
  | { type: 'drafted'; draftId: string }
  | { type: 'applied'; count: number }
  | { type: 'undone'; removed: number; kept: number }
  | { type: 'assisted'; reply: string; proposal: Proposal | null; link: Link | null }
  | { type: 'acted'; summary: string; link: Link }
  | { type: 'failed'; message: string }
  /** The app closed while Stowie was waiting on something. */
  | { type: 'interrupted' }

export interface Outcome { thread: Thread; effect?: Effect; mood?: Mood }

const BLANK: Plan = { prompt: '', destination: null, days: null, budget: null, refineDraftId: null }
export const MAX_MESSAGES = 120
export const newThread = (scope: string): Thread => ({ scope, seq: 0, messages: [], chips: [], step: 'imagine', back: 'imagine', pending: null, resume: 'imagine', plan: { ...BLANK }, draft: null, updatedAt: '' })

const STYLE: Chip[] = [{ id: 'quiz', label: 'Take the quiz' }, { id: 'describe', label: 'Tell you myself' }, { id: 'manual', label: 'Set it by hand' }]
const STARTERS: Chip[] = [
  { id: 'starter:food', label: 'Slow mornings and great food' },
  { id: 'starter:active', label: 'Something active outdoors' },
  { id: 'starter:surprise', label: 'Surprise me' },
]
const REFINEMENTS: Chip[] = [{ id: 'refine:pace', label: 'More downtime' }, { id: 'refine:travel', label: 'Less time in transit' }, { id: 'refine:cost', label: 'Make it cheaper' }]
const NEEDS_NETWORK: Effect['type'][] = ['interpret', 'infer', 'generate', 'assist']
const LINKS: Record<Link, string> = { plan: 'Open the plan', tasks: 'Open tasks', packing: 'Open the packing list', votes: 'Open votes', money: 'Open money' }
const linkChip = (link: Link | null): Chip[] => (link ? [{ id: `open:${link}`, label: LINKS[link] }] : [])
const ask = (label: string, ...topics: Topic[]): Chip => ({ id: `ask:${topics.join(',')}`, label })
const NEXT = ask('What’s next?', 'plan')
/** The first suggestions depend on the screen Stowie was opened over. */
const HERE: Record<Screen, Chip[]> = {
  overview: [NEXT, ask('What’s left to do?', 'tasks')],
  plan: [NEXT, { id: 'starter:free', label: 'Fill a free afternoon' }],
  map: [ask('What haven’t we planned yet?', 'places', 'plan')],
  places: [ask('What haven’t we planned yet?', 'places', 'plan')],
  place: [ask('What pairs with this?', 'places', 'plan')],
  tickets: [NEXT],
  money: [{ id: 'ask:money', label: 'What do I owe?' }],
  tasks: [ask('What’s left to do?', 'tasks'), ask('What’s mine?', 'tasks')],
  packing: [ask('What am I missing?', 'packing')],
  votes: [ask('What needs my vote?', 'votes')],
}
/** Steps where anything can be said, as opposed to answering a question Stowie just asked. */
const OPEN: Step[] = ['style', 'profile', 'imagine', 'draft', 'applied']

function chipsFor(step: Step, thread: Thread, ctx: Ctx): Chip[] {
  const here = ctx.screen && OPEN.includes(step) ? HERE[ctx.screen] : []
  return [...here, ...stepChips(step, thread, ctx)]
}

function stepChips(step: Step, thread: Thread, ctx: Ctx): Chip[] {
  const show: Chip[] = ctx.latestDraft && ctx.latestDraft.id !== thread.draft?.id ? [{ id: 'show', label: 'Show my last draft' }] : []
  switch (step) {
    case 'style': return STYLE
    case 'profile': return [{ id: 'saveProfile', label: 'Yes, save it' }, { id: 'describe', label: 'Let me rephrase' }, { id: 'manual', label: 'Tune it by hand' }]
    case 'imagine': return [...STARTERS, ...show, { id: 'style', label: 'Change my travel style' }]
    case 'destination': return [{ id: 'dest:any', label: 'You pick' }]
    case 'days': {
      const options = [3, 5, 7].filter((n) => n <= ctx.maxDays).map((n) => ({ id: `days:${n}`, label: `${n} days` }))
      return ctx.tripName && ![3, 5, 7].includes(ctx.maxDays) ? [...options, { id: `days:${ctx.maxDays}`, label: `All ${ctx.maxDays}` }] : options
    }
    case 'budget': return [{ id: 'budget:none', label: 'No limit in mind' }]
    case 'refine': return REFINEMENTS
    case 'draft': return [
      ...(thread.draft?.applied ? [] : [{ id: 'apply', label: ctx.tripName ? 'Add it to the plan' : 'Build this trip' }]),
      { id: 'refine', label: 'Change something' }, { id: 'fresh', label: 'Start a new idea' },
    ]
    case 'confirm': return [{ id: 'confirm', label: 'Yes, add it' }, { id: 'dismiss', label: 'No thanks' }]
    case 'applied': return [{ id: 'plan', label: 'Open the plan' }, { id: 'undo', label: 'Undo that' }, { id: 'refine', label: 'Change something' }, { id: 'fresh', label: 'Start a new idea' }]
    default: return []
  }
}

export function step(previous: Thread, event: Event, ctx: Ctx): Outcome {
  const t: Thread = { ...previous, messages: [...previous.messages], chips: [], plan: { ...previous.plan } }
  let mood: Mood | undefined
  const say = (text: string, card?: Card) => { t.messages.push({ id: t.seq++, from: 'stowie', text, ...(card ? { card } : {}) }); mood ??= 'talking' }
  const me = (text: string) => { t.messages.push({ id: t.seq++, from: 'me', text }) }
  const done = (effect?: Effect): Outcome => {
    if (!t.chips.length && t.step !== 'busy') t.chips = chipsFor(t.step, t, ctx)
    t.messages = t.messages.slice(-MAX_MESSAGES)
    return { thread: t, ...(effect ? { effect, mood: 'thinking' as const } : mood ? { mood } : {}) }
  }
  const at = (next: Step) => { t.step = next }
  const busy = (effect: Effect): Outcome => {
    if (NEEDS_NETWORK.includes(effect.type) && !ctx.online) {
      say('I can’t reach the planner without a connection. Your saved drafts and travel style still work offline.')
      t.pending = effect
      t.chips = [{ id: 'retry', label: 'Try again' }, ...chipsFor(t.step, t, ctx).filter((c) => c.id === 'show'), { id: 'manual', label: 'Edit by hand' }]
      mood = 'oops'
      return done()
    }
    t.back = t.step; t.pending = effect; at('busy')
    return done(effect)
  }
  const askStyle = (line: string) => { say(line); at('style') }
  const askImagine = (line = 'What are you imagining?') => { t.plan = { ...BLANK }; say(line); at('imagine') }
  /** Ask for the next missing detail, or start sketching once the brief is complete. */
  const advance = (): Outcome => {
    const p = t.plan
    if (p.destination === null && ctx.destination) p.destination = ctx.destination
    if (p.destination === null) { say('Anywhere in mind, or shall I pick?'); at('destination'); return done() }
    if (p.days === null && ctx.maxDays === 1) p.days = 1
    if (p.days === null) { say('How many days should I sketch?'); at('days'); return done() }
    if (p.budget === null) { say(`Any budget per person for the whole trip, in ${ctx.currency}? A rough number is fine.`); at('budget'); return done() }
    const where = p.destination ? ` in ${p.destination}` : ''
    const cost = p.budget === 'none' ? '' : `, about ${p.budget} ${ctx.currency} each`
    say(`Right: ${p.days} ${p.days === 1 ? 'day' : 'days'}${where}${cost}. Give me a moment. A sketch can take up to a minute and a half.`)
    return busy({ type: 'generate', plan: { ...p } })
  }
  const refine = (text: string): Outcome => {
    if (!t.draft) { t.plan = { ...BLANK, prompt: text }; return advance() }
    t.plan = { ...BLANK, prompt: text, refineDraftId: t.draft.id }
    say('Let me rework it. This can take a minute.')
    return busy({ type: 'generate', plan: { ...t.plan } })
  }
  const showDraft = (line: string, draft: { id: string; applied: boolean }) => { t.draft = draft; say(line, { kind: 'draft', draftId: draft.id }); at('draft') }
  /** Settles the offer on the table, if there is one. */
  const settle = (state: 'done' | 'dismissed') => {
    t.messages = t.messages.map((m) => (m.card?.kind === 'proposal' && m.card.state === 'pending' ? { ...m, card: { ...m.card, state } } : m))
  }
  const look = (text: string, topics: Topic[]): Outcome => {
    if (!ctx.tripName) { say('I can answer that once you’re inside a trip. Here I can sketch ideas for a new one.'); return done() }
    // Money alone needs no model: the phone has the exact figures.
    if (topics.length === 1 && topics[0] === 'money') return busy({ type: 'tally' })
    return busy({ type: 'assist', text, topics: topics.length ? topics : ['plan'] })
  }

  switch (event.type) {
    case 'open': {
      say('Hi, I’m Stowie. I ride along in the suitcase and think about trips all day.')
      if (!ctx.hasProfile) askStyle(`Before I sketch anything${ctx.tripName ? ` for ${ctx.tripName}` : ''}, I’d like to know how you travel. One-minute quiz, or tell me in your own words?`)
      else if (ctx.screen && ctx.tripName) askImagine(`Ask me anything about ${ctx.tripName}, or tell me what you’re imagining.`)
      else askImagine(ctx.tripName ? (ctx.travelers > 1 ? `I have travel styles for ${ctx.travelers} of you on ${ctx.tripName}. What are you imagining?` : `What are you imagining for ${ctx.tripName}?`) : 'What kind of trip are you imagining?')
      return done()
    }

    case 'arrive': {
      // Suggestions belong to the screen underneath; an answer Stowie is waiting for stays as it was.
      if (!OPEN.includes(t.step)) return { thread: previous }
      t.chips = chipsFor(t.step, t, ctx)
      return { thread: t }
    }

    case 'chip': {
      const { id, label } = event.chip
      // Leaving the chat changes nothing in it, so coming back shows the same choices.
      if (id === 'quiz' || id === 'manual' || id === 'plan') return { thread: previous, effect: { type: 'go', to: id } }
      if (id.startsWith('open:')) return { thread: previous, effect: { type: 'go', to: id.slice(5) as Link } }
      if (id === 'apply' && t.draft && !ctx.tripName) return { thread: previous, effect: { type: 'go', to: 'build', draftId: t.draft.id } }
      if (id === 'retry') return t.pending ? busy(t.pending) : done()
      me(label)
      if (id.startsWith('ask:')) {
        const question = ctx.screen === 'place' && ctx.subject && label === 'What pairs with this?' ? `What pairs well with ${ctx.subject}?` : label
        return look(question, id.slice(4).split(',') as Topic[])
      }
      if (id === 'confirm') {
        const card = t.messages.findLast((m) => m.card?.kind === 'proposal' && m.card.state === 'pending')?.card
        return card?.kind === 'proposal' ? busy({ type: 'act', proposal: card.proposal }) : done()
      }
      if (id === 'dismiss') { settle('dismissed'); say('No problem. Nothing was added.'); at(t.resume); return done() }
      if (id === 'describe') { say('Go on: what makes a trip great for you, and what do you skip?'); at('describe'); return done() }
      if (id === 'style') { askStyle('Sure. The quiz, your own words, or the sliders?'); return done() }
      if (id === 'saveProfile') {
        const card = t.messages.findLast((m) => m.card?.kind === 'profile')?.card
        return card?.kind === 'profile' ? busy({ type: 'saveProfile', scores: card.scores, description: card.description }) : done()
      }
      if (id === 'fresh') { askImagine(); return done() }
      if (id === 'show' && ctx.latestDraft) { showDraft('Here’s the last one I sketched.', ctx.latestDraft); return done() }
      if (id === 'apply' && t.draft) return busy({ type: 'apply', draftId: t.draft.id })
      if (id === 'undo' && t.draft) return busy({ type: 'undo', draftId: t.draft.id })
      if (id === 'refine') { say('What would you change?'); at('refine'); return done() }
      if (id.startsWith('refine:')) return refine(label)
      if (id.startsWith('starter:')) {
        t.plan = { ...BLANK, prompt: label }
        if (!ctx.hasProfile) { askStyle('First I need your travel style, so the sketch fits you. The quiz, or your own words?'); return done() }
        return advance()
      }
      if (id === 'dest:any') { t.plan.destination = ''; return advance() }
      if (id.startsWith('days:')) { t.plan.days = Math.min(ctx.maxDays, Number(id.slice(5)) || 1); return advance() }
      if (id === 'budget:none') { t.plan.budget = 'none'; return advance() }
      return done()
    }

    case 'text': {
      const text = event.text.trim().slice(0, 1000)
      if (!text || t.step === 'busy') return { thread: previous }
      me(text)
      // Saying something else instead of confirming leaves the offer behind.
      if (t.step === 'confirm') { settle('dismissed'); at(t.resume) }
      if (t.step === 'describe') return busy({ type: 'infer', description: text })
      if (t.step === 'refine') return refine(text)
      if (t.step === 'destination') { t.plan.destination = text.slice(0, 160); return advance() }
      if (t.step === 'days') {
        const days = Number.parseInt(text.match(/\d+/)?.[0] ?? '', 10)
        if (!(days >= 1 && days <= ctx.maxDays)) { say(ctx.maxDays === 14 ? 'I can sketch between 1 and 14 days. How many?' : `This trip has room for 1 to ${ctx.maxDays} days. How many?`); return done() }
        t.plan.days = days
        return advance()
      }
      if (t.step === 'budget') {
        const amount = Number(text.replace(/[^0-9.]/g, ''))
        if (/\d/.test(text) && Number.isFinite(amount) && amount <= 1000000) t.plan.budget = amount
        else if (/^\s*(no|none|nope|skip|any|anything)\b/i.test(text)) t.plan.budget = 'none'
        else { say(`A number in ${ctx.currency} works best, or tap “No limit in mind”.`); return done() }
        return advance()
      }
      return busy({ type: 'interpret', text })
    }

    case 'interpreted': {
      at(t.back); t.pending = null
      const { reply, text } = event
      // If the model didn't answer, read the line the obvious way so planning still moves.
      const intent = reply?.intent ?? (ctx.hasProfile ? 'plan' : 'preferences')
      if (intent === 'other') { say(reply!.reply); return done() }
      if (intent === 'ask') return look(text, reply!.topics)
      if (intent === 'preferences') { if (reply) say(reply.reply); return busy({ type: 'infer', description: text }) }
      if (intent === 'refine' && t.draft) return refine(text)
      t.plan = { ...BLANK, prompt: text, destination: reply?.destination || null, days: reply?.days ? Math.min(reply.days, ctx.maxDays) : null, budget: reply?.budget ?? null }
      say(reply?.reply ?? 'I like the sound of that.')
      if (!ctx.hasProfile) { askStyle('First I need your travel style, so the sketch fits you. The quiz, or your own words?'); return done() }
      return advance()
    }

    case 'inferred': {
      at(t.back); t.pending = null
      say(event.explanation)
      say('Does this look like you?', { kind: 'profile', scores: event.scores, description: event.description })
      at('profile')
      return done()
    }

    case 'profileSaved': {
      at(t.back); t.pending = null
      say(`Saved. I’d call you a ${classify(event.scores).toLowerCase()}.`)
      mood = 'delighted'
      if (t.plan.prompt) return advance()
      askImagine('Now, what are you imagining?')
      return done()
    }

    case 'drafted': {
      const revised = !!t.plan.refineDraftId
      t.pending = null; t.plan = { ...BLANK }
      showDraft(revised ? 'Here’s the revision. Tell me if it’s closer.' : 'Here’s a first sketch. Nothing goes into the plan until you say so.', { id: event.draftId, applied: false })
      mood = 'delighted'
      return done()
    }

    case 'applied': {
      t.pending = null
      if (t.draft) t.draft = { ...t.draft, applied: true }
      say(`Done. ${event.count} tentative ${event.count === 1 ? 'item is' : 'items are'} in the plan, with suggested places and planning tasks. Everything is yours to edit.`)
      at('applied'); mood = 'delighted'
      return done()
    }

    case 'undone': {
      t.pending = null; t.draft = null
      say(`Removed ${event.removed} generated ${event.removed === 1 ? 'entry' : 'entries'}. ${event.kept ? `${event.kept} edited or referenced ${event.kept === 1 ? 'entry was' : 'entries were'} kept.` : 'Your other plans are unchanged.'}`)
      askImagine('Want to try a different idea?')
      return done()
    }

    case 'assisted': {
      at(t.back); t.pending = null
      if (event.proposal) {
        t.resume = t.step
        say(event.reply, { kind: 'proposal', proposal: event.proposal, state: 'pending' })
        at('confirm')
        return done()
      }
      say(event.reply)
      t.chips = [...linkChip(event.link), ...chipsFor(t.step, t, ctx)]
      return done()
    }

    case 'acted': {
      t.pending = null
      settle('done')
      say(event.summary)
      at(t.resume); mood = 'delighted'
      t.chips = [...linkChip(event.link), ...chipsFor(t.step, t, ctx)]
      return done()
    }

    case 'failed':
    case 'interrupted': {
      if (t.step !== 'busy') return { thread: previous }
      // A finished brief has no question left to return to; go somewhere free text is understood.
      const resumed: Step = t.pending?.type === 'generate' ? (t.draft ? 'draft' : 'imagine') : t.back
      at(resumed)
      say(event.type === 'failed' ? event.message : 'I lost my place when the app closed. Nothing was changed.')
      const retry: Chip[] = t.pending && NEEDS_NETWORK.includes(t.pending.type) ? [{ id: 'retry', label: 'Try again' }] : []
      t.chips = [...retry, ...(resumed === 'imagine' ? [{ id: 'fresh', label: 'Start a new idea' }] : chipsFor(resumed, t, ctx)), ...(resumed === 'style' || resumed === 'profile' || resumed === 'confirm' ? [] : [{ id: 'manual', label: 'Edit by hand' }])]
      mood = 'oops'
      return done()
    }
  }
}
