import { describe, expect, it } from 'vitest'
import { NEUTRAL, type ChatReply } from '@/features/discovery/model'
import { MAX_MESSAGES, newThread, step, type Ctx, type Event, type Outcome, type Thread } from './script'

const trip: Ctx = { tripName: 'Guatemala', hasProfile: true, travelers: 3, destination: 'Antigua, Lake Atitlán', maxDays: 9, currency: 'USD', online: true, latestDraft: null, screen: null, subject: null }
const personal: Ctx = { ...trip, tripName: null, travelers: 1, destination: '', maxDays: 14 }
const reply = (over: Partial<ChatReply> = {}): ChatReply => ({ intent: 'plan', reply: 'Street food and slow mornings, noted.', destination: null, days: null, budget: null, topics: [], ...over })
const chip = (thread: Thread, id: string): Event => ({ type: 'chip', chip: thread.chips.find((c) => c.id === id) ?? { id, label: id } })
/** Plays events in order, returning the last outcome. */
function play(ctx: Ctx, events: (Event | ((t: Thread) => Event))[], from = step(newThread('t'), { type: 'open' }, ctx)): Outcome {
  return events.reduce<Outcome>((out, e) => step(out.thread, typeof e === 'function' ? e(out.thread) : e, ctx), from)
}
const last = (out: Outcome) => out.thread.messages.at(-1)!

describe('opening', () => {
  it('asks for a travel style before anything else when there is none', () => {
    const out = step(newThread('t'), { type: 'open' }, { ...trip, hasProfile: false })
    expect(out.thread.step).toBe('style')
    expect(out.thread.chips.map((c) => c.id)).toEqual(['quiz', 'describe', 'manual'])
    expect(last(out).text).toContain('for Guatemala')
  })
  it('asks what they are imagining once a style exists', () => {
    const out = step(newThread('t'), { type: 'open' }, trip)
    expect(out.thread.step).toBe('imagine')
    expect(last(out).text).toContain('3 of you')
    expect(out.effect).toBeUndefined()
  })
  it('leaves the thread untouched when a chip only navigates', () => {
    const opened = step(newThread('t'), { type: 'open' }, { ...trip, hasProfile: false })
    const out = step(opened.thread, chip(opened.thread, 'quiz'), trip)
    expect(out.thread).toBe(opened.thread)
    expect(out.effect).toEqual({ type: 'go', to: 'quiz' })
  })
})

describe('collecting a brief', () => {
  it('uses the trip’s destination and asks only for days and budget, without the model', () => {
    const days = play(trip, [(t) => chip(t, 'starter:food')])
    expect(days.effect).toBeUndefined()
    expect(days.thread.step).toBe('days')
    expect(days.thread.chips.map((c) => c.label)).toEqual(['3 days', '5 days', '7 days', 'All 9'])
    const out = play(trip, [(t) => chip(t, 'days:5'), (t) => chip(t, 'budget:none')], days)
    expect(out.effect).toEqual({ type: 'generate', plan: { prompt: 'Slow mornings and great food', destination: 'Antigua, Lake Atitlán', days: 5, budget: 'none', refineDraftId: null } })
    expect(out.thread.step).toBe('busy')
    expect(out.mood).toBe('thinking')
    expect(last(out).text).toContain('5 days in Antigua, Lake Atitlán.')
  })
  it('asks where to go outside a trip, and accepts typed answers', () => {
    const where = play(personal, [(t) => chip(t, 'starter:surprise')])
    expect(where.thread.step).toBe('destination')
    const out = play(personal, [{ type: 'text', text: 'Portugal' }, { type: 'text', text: 'about 6 days' }, { type: 'text', text: '$1,200' }], where)
    expect(out.effect).toMatchObject({ type: 'generate', plan: { destination: 'Portugal', days: 6, budget: 1200 } })
  })
  it('rejects days the trip has no room for, and a budget that is not a number', () => {
    const days = play(trip, [(t) => chip(t, 'starter:food'), { type: 'text', text: '12' }])
    expect(days.thread.step).toBe('days')
    expect(last(days).text).toContain('1 to 9')
    const budget = play(trip, [{ type: 'text', text: '4' }, { type: 'text', text: 'cheap-ish' }], days)
    expect(budget.thread.step).toBe('budget')
    expect(play(trip, [{ type: 'text', text: 'no limit' }], budget).effect).toMatchObject({ type: 'generate', plan: { days: 4, budget: 'none' } })
  })
})

describe('free text', () => {
  it('goes to the model, and skips questions it already answered', () => {
    const asked = play(personal, [{ type: 'text', text: 'Five days of street food in Oaxaca under 900' }])
    expect(asked.effect).toEqual({ type: 'interpret', text: 'Five days of street food in Oaxaca under 900' })
    const out = play(personal, [{ type: 'interpreted', text: 'Five days of street food in Oaxaca under 900', reply: reply({ destination: 'Oaxaca', days: 5, budget: 900 }) }], asked)
    expect(out.effect).toMatchObject({ type: 'generate', plan: { destination: 'Oaxaca', days: 5, budget: 900 } })
    expect(out.thread.messages.some((m) => m.text === 'Street food and slow mornings, noted.')).toBe(true)
  })
  it('still plans when the model does not answer', () => {
    const out = play(trip, [{ type: 'text', text: 'Volcano hikes' }, { type: 'interpreted', text: 'Volcano hikes', reply: null }])
    expect(out.thread.plan.prompt).toBe('Volcano hikes')
    expect(out.thread.step).toBe('days')
  })
  it('answers small talk and returns to where it was', () => {
    const out = play(trip, [{ type: 'text', text: 'who are you?' }, { type: 'interpreted', text: 'who are you?', reply: reply({ intent: 'other', reply: 'A suitcase with opinions.' }) }])
    expect(last(out).text).toBe('A suitcase with opinions.')
    expect(out.thread.step).toBe('imagine')
    expect(out.thread.chips.some((c) => c.id === 'starter:food')).toBe(true)
  })
  it('says so offline instead of calling the model, and can retry', () => {
    const offline = step(step(newThread('t'), { type: 'open' }, trip).thread, { type: 'text', text: 'Beaches' }, { ...trip, online: false })
    expect(offline.effect).toBeUndefined()
    expect(offline.mood).toBe('oops')
    expect(offline.thread.chips.map((c) => c.id)).toEqual(['retry', 'manual'])
    expect(step(offline.thread, chip(offline.thread, 'retry'), trip).effect).toEqual({ type: 'interpret', text: 'Beaches' })
  })
})

describe('travel style', () => {
  const fresh = { ...trip, hasProfile: false }
  it('turns a description into a suggested radar, saves it, and resumes the trip they asked for', () => {
    const wanted = play(fresh, [{ type: 'text', text: 'A lazy beach week' }, { type: 'interpreted', text: 'A lazy beach week', reply: reply() }])
    expect(wanted.thread.step).toBe('style')
    const described = play(fresh, [(t) => chip(t, 'describe'), { type: 'text', text: 'I love food and hate clubs' }], wanted)
    expect(described.effect).toEqual({ type: 'infer', description: 'I love food and hate clubs' })
    const shown = play(fresh, [{ type: 'inferred', scores: { ...NEUTRAL, food: 90 }, explanation: 'Food leads.', description: 'I love food and hate clubs' }], described)
    expect(last(shown).card).toEqual({ kind: 'profile', scores: { ...NEUTRAL, food: 90 }, description: 'I love food and hate clubs' })
    const saving = play(fresh, [(t) => chip(t, 'saveProfile')], shown)
    expect(saving.effect).toEqual({ type: 'saveProfile', scores: { ...NEUTRAL, food: 90 }, description: 'I love food and hate clubs' })
    const out = play(trip, [{ type: 'profileSaved', scores: { ...NEUTRAL, food: 90 } }], saving)
    expect(out.mood).toBe('delighted')
    expect(out.thread.plan.prompt).toBe('A lazy beach week')
    expect(out.thread.step).toBe('days')
  })
  it('reads a stated preference as a style change', () => {
    const out = play(trip, [{ type: 'text', text: 'more food, less nightlife' }, { type: 'interpreted', text: 'more food, less nightlife', reply: reply({ intent: 'preferences' }) }])
    expect(out.effect).toEqual({ type: 'infer', description: 'more food, less nightlife' })
  })
})

describe('drafts', () => {
  const drafted = (ctx: Ctx) => play(ctx, [(t) => chip(t, 'starter:food'), ...(ctx.tripName ? [] : [(t: Thread) => chip(t, 'dest:any')]), (t) => chip(t, 'days:3'), (t) => chip(t, 'budget:none'), { type: 'drafted', draftId: 'd1' }])
  it('shows the draft and adds it to the plan only when asked', () => {
    const shown = drafted(trip)
    expect(last(shown).card).toEqual({ kind: 'draft', draftId: 'd1' })
    expect(shown.thread.chips.map((c) => c.label)).toEqual(['Add it to the plan', 'Change something', 'Start a new idea'])
    const applying = play(trip, [(t) => chip(t, 'apply')], shown)
    expect(applying.effect).toEqual({ type: 'apply', draftId: 'd1' })
    const applied = play(trip, [{ type: 'applied', count: 4 }], applying)
    expect(applied.thread.draft).toEqual({ id: 'd1', applied: true })
    expect(applied.thread.chips.map((c) => c.id)).toEqual(['plan', 'undo', 'refine', 'fresh'])
    expect(play(trip, [(t) => chip(t, 'undo')], applied).effect).toEqual({ type: 'undo', draftId: 'd1' })
  })
  it('builds a new trip from a personal draft', () => {
    const shown = drafted(personal)
    expect(shown.thread.chips[0]!.label).toBe('Build this trip')
    expect(step(shown.thread, chip(shown.thread, 'apply'), personal).effect).toEqual({ type: 'go', to: 'build', draftId: 'd1' })
  })
  it('refines the draft in focus, from a chip, typed text, or the model’s reading', () => {
    const shown = drafted(trip)
    const typed = play(trip, [(t) => chip(t, 'refine'), { type: 'text', text: 'Swap the hike for a market' }], shown)
    expect(typed.effect).toMatchObject({ type: 'generate', plan: { prompt: 'Swap the hike for a market', refineDraftId: 'd1' } })
    const read = play(trip, [{ type: 'text', text: 'less walking please' }, { type: 'interpreted', text: 'less walking please', reply: reply({ intent: 'refine' }) }], shown)
    expect(read.effect).toMatchObject({ type: 'generate', plan: { refineDraftId: 'd1' } })
    expect(last(play(trip, [{ type: 'drafted', draftId: 'd2' }], typed)).text).toContain('revision')
  })
  it('keeps the brief when sketching fails, so it can be retried', () => {
    const waiting = play(trip, [(t) => chip(t, 'starter:food'), (t) => chip(t, 'days:3'), (t) => chip(t, 'budget:none')])
    const failed = play(trip, [{ type: 'failed', message: 'The AI service’s allowance has been reached.' }], waiting)
    expect(failed.mood).toBe('oops')
    expect(failed.thread.step).toBe('imagine')
    expect(failed.thread.chips.map((c) => c.id)).toEqual(['retry', 'fresh', 'manual'])
    expect(step(failed.thread, chip(failed.thread, 'retry'), trip).effect).toEqual(waiting.effect)
  })
  it('offers a draft made elsewhere, and recovers when the app closed mid-thought', () => {
    const withDraft = { ...trip, latestDraft: { id: 'old', applied: true } }
    const opened = step(newThread('t'), { type: 'open' }, withDraft)
    const shown = step(opened.thread, chip(opened.thread, 'show'), withDraft)
    expect(shown.thread.draft).toEqual({ id: 'old', applied: true })
    expect(shown.thread.chips.some((c) => c.id === 'apply')).toBe(false)
    const waiting = play(trip, [{ type: 'text', text: 'Beaches' }])
    const resumed = step(waiting.thread, { type: 'interrupted' }, trip)
    expect(resumed.thread.step).toBe('imagine')
    expect(last(resumed).text).toContain('Nothing was changed')
  })
})

it('caps the stored thread and ignores input while busy', () => {
  let out = step(newThread('t'), { type: 'open' }, trip)
  for (let i = 0; i < 80; i++) out = play(trip, [{ type: 'text', text: `hello ${i}` }, { type: 'interpreted', text: `hello ${i}`, reply: reply({ intent: 'other', reply: 'Hello.' }) }], out)
  expect(out.thread.messages).toHaveLength(MAX_MESSAGES)
  expect(new Set(out.thread.messages.map((m) => m.id)).size).toBe(MAX_MESSAGES)
  const waiting = step(out.thread, { type: 'text', text: 'Beaches' }, trip)
  expect(step(waiting.thread, { type: 'text', text: 'again' }, trip).thread).toBe(waiting.thread)
})

describe('questions about the trip', () => {
  const onPlan: Ctx = { ...trip, screen: 'plan' }
  const task = { kind: 'task', title: 'Book the shuttle', assigneeId: 'sam', assignee: 'Sam', dueDate: null } as const
  it('offers suggestions that fit the screen, ahead of the usual ones', () => {
    const ids = (ctx: Ctx) => step(newThread('t'), { type: 'open' }, ctx).thread.chips.map((c) => c.id)
    expect(ids(onPlan).slice(0, 3)).toEqual(['ask:plan', 'starter:free', 'starter:food'])
    expect(ids({ ...trip, screen: 'money' })[0]).toBe('ask:money')
    expect(ids(trip)[0]).toBe('starter:food')
    // A question Stowie asked gets its own answers only.
    expect(play(onPlan, [(t) => chip(t, 'starter:food')]).thread.chips.map((c) => c.id)).toEqual(['days:3', 'days:5', 'days:7', 'days:9'])
  })
  it('swaps its suggestions when reopened over another screen, but not mid-question', () => {
    const onPlanTab = step(newThread('t'), { type: 'open' }, onPlan).thread
    const onMoney = step(onPlanTab, { type: 'arrive' }, { ...trip, screen: 'money' }).thread
    expect(onMoney.chips[0]).toEqual({ id: 'ask:money', label: 'What do I owe?' })
    expect(onMoney.messages).toEqual(onPlanTab.messages)
    const asking = play(onPlan, [(t) => chip(t, 'starter:food')]).thread
    expect(step(asking, { type: 'arrive' }, { ...trip, screen: 'money' }).thread).toBe(asking)
  })
  it('looks up only the topics a question needs, and returns to where it was', () => {
    const asked = play(onPlan, [(t) => chip(t, 'ask:plan')])
    expect(asked.effect).toEqual({ type: 'assist', text: 'What’s next?', topics: ['plan'] })
    const out = play(onPlan, [{ type: 'assisted', reply: 'Lunch at 13:00.', proposal: null, link: 'plan' }], asked)
    expect(last(out).text).toBe('Lunch at 13:00.')
    expect(out.thread.step).toBe('imagine')
    expect(out.thread.chips[0]).toEqual({ id: 'open:plan', label: 'Open the plan' })
    expect(step(out.thread, chip(out.thread, 'open:plan'), onPlan)).toEqual({ thread: out.thread, effect: { type: 'go', to: 'plan' } })
    const typed = play(trip, [{ type: 'text', text: 'who is bringing the speaker?' }, { type: 'interpreted', text: 'who is bringing the speaker?', reply: reply({ intent: 'ask', reply: 'Let me look.', topics: ['packing', 'people'] }) }])
    expect(typed.effect).toEqual({ type: 'assist', text: 'who is bringing the speaker?', topics: ['packing', 'people'] })
  })
  it('names the place being viewed, and answers money on the phone even offline', () => {
    const place: Ctx = { ...trip, screen: 'place', subject: 'Café Sky' }
    expect(play(place, [(t) => chip(t, 'ask:places,plan')]).effect).toMatchObject({ text: 'What pairs well with Café Sky?' })
    const offline: Ctx = { ...trip, screen: 'money', online: false }
    expect(play(offline, [(t) => chip(t, 'ask:money')]).effect).toEqual({ type: 'tally' })
    expect(play(offline, [(t) => chip(t, 'ask:plan')], step(newThread('t'), { type: 'open' }, { ...offline, screen: 'plan' })).effect).toBeUndefined()
  })
  it('does not pretend to know a trip outside one', () => {
    const out = play(personal, [{ type: 'text', text: 'what time is dinner' }, { type: 'interpreted', text: 'what time is dinner', reply: reply({ intent: 'ask', topics: ['plan'] }) }])
    expect(out.effect).toBeUndefined()
    expect(last(out).text).toContain('inside a trip')
  })
  it('adds something only after a yes, then picks up where it left off', () => {
    const offered = play(trip, [{ type: 'text', text: 'add a task for Sam to book the shuttle' }, { type: 'interpreted', text: 'x', reply: reply({ intent: 'ask', topics: ['tasks'] }) }, { type: 'assisted', reply: 'I can add that for Sam.', proposal: task, link: 'tasks' }])
    expect(offered.effect).toBeUndefined()
    expect(offered.thread.step).toBe('confirm')
    expect(last(offered).card).toEqual({ kind: 'proposal', proposal: task, state: 'pending' })
    expect(offered.thread.chips.map((c) => c.label)).toEqual(['Yes, add it', 'No thanks'])
    const adding = play(trip, [(t) => chip(t, 'confirm')], offered)
    expect(adding.effect).toEqual({ type: 'act', proposal: task })
    const added = play(trip, [{ type: 'acted', summary: 'Added the task.', link: 'tasks' }], adding)
    expect(added.thread.messages.find((m) => m.card?.kind === 'proposal')?.card).toMatchObject({ state: 'done' })
    expect(added.thread.step).toBe('imagine')
    expect(added.mood).toBe('delighted')
    expect(added.thread.chips[0]!.id).toBe('open:tasks')
    // A failed save leaves the offer open to try again.
    const failed = play(trip, [{ type: 'failed', message: 'Choose someone who is still in this trip.' }], adding)
    expect(failed.thread.step).toBe('confirm')
    expect(failed.thread.chips.map((c) => c.id)).toEqual(['confirm', 'dismiss'])
  })
  it('drops the offer on a no, or when they say something else', () => {
    const offered = play(trip, [{ type: 'text', text: 'x' }, { type: 'interpreted', text: 'x', reply: reply({ intent: 'ask', topics: ['tasks'] }) }, { type: 'assisted', reply: 'I can add that.', proposal: task, link: 'tasks' }])
    const no = play(trip, [(t) => chip(t, 'dismiss')], offered)
    expect(no.effect).toBeUndefined()
    expect(no.thread.messages.find((m) => m.card?.kind === 'proposal')?.card).toMatchObject({ state: 'dismissed' })
    expect(no.thread.step).toBe('imagine')
    const moved = play(trip, [{ type: 'text', text: 'actually, what’s next?' }], offered)
    expect(moved.thread.messages.find((m) => m.card?.kind === 'proposal')?.card).toMatchObject({ state: 'dismissed' })
    expect(moved.effect).toEqual({ type: 'interpret', text: 'actually, what’s next?' })
    expect(step(moved.thread, { type: 'chip', chip: { id: 'confirm', label: 'Yes, add it' } }, trip).effect).toBeUndefined()
  })
})
