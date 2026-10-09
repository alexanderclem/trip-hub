import { describe, expect, it } from 'vitest'
import type { Attachment, Comment, ExpenseRow, ItineraryItem, Member, Place, PlaceRating, Poll, PollOption, SettlementRow, TripTask } from '@/data/types'
import { buildFeed, groupOf, GROUPS, isNew, unseenCount, type ActivityKind, type FeedRows } from './feed'

const at = (minute: number) => `2027-01-05T10:${String(minute).padStart(2, '0')}:00.000Z`
const base = (id: string, minute: number, by: string | null = 'alex') => ({ id, trip_id: 't', created_at: at(minute), updated_at: at(minute), created_by: by, deleted_at: null })
const rows = (over: Partial<FeedRows> = {}): FeedRows => ({ members: [], polls: [], options: [], places: [], items: [], expenses: [], settlements: [], ratings: [], tasks: [], attachments: [], comments: [], ...over })

const member = (id: string, minute: number) => ({ ...base(id, minute, null), display_name: id, color: null, avatar_emoji: null, home_timezone: null }) as Member
const poll = (id: string, minute: number, over: Partial<Poll> = {}) => ({ ...base(id, minute), title: 'Where do we stay?', description: null, status: 'open', winner_option_id: null, ...over }) as Poll
const option = (id: string, minute: number, by = 'alex', over: Partial<PollOption> = {}) => ({ ...base(id, minute, by), poll_id: 'p', label: 'Casa del Mundo', place_id: null, url: null, description: null, ...over }) as PollOption
const place = (id: string, minute: number, source: Place['source']) => ({ ...base(id, minute), name: 'Café Sabor', source, status: 'shortlist' }) as Place
const comment = (id: string, minute: number, over: Partial<Comment> = {}) => ({ ...base(id, minute, 'sam'), subject_type: 'poll', subject_id: 'p', member_id: 'sam', body: 'Too far from the dock?', ...over }) as Comment

describe('buildFeed', () => {
  it('lists what people did, newest first, with where each one leads', () => {
    const feed = buildFeed(rows({
      members: [member('sam', 1)],
      polls: [poll('p', 2)],
      places: [place('pl', 3, 'manual')],
      items: [{ ...base('i', 4), title: 'Lancha to San Marcos' } as ItineraryItem],
      expenses: [{ ...base('e', 5), description: 'Dinner', amount_minor: 68000, currency: 'GTQ' } as ExpenseRow],
      tasks: [{ ...base('k', 6), title: 'Book shuttle', completed: false } as TripTask],
      attachments: [{ ...base('a', 7), title: 'Flight to GUA' } as Attachment],
      comments: [comment('c', 8)],
    }))
    // Money is written the way the Money tab writes it, which may put a space after the symbol.
    expect(feed.map((e) => [e.kind, e.by, e.text.replace(/Q\s/, 'Q'), e.to])).toEqual([
      ['comment', 'sam', 'on Where do we stay?: “Too far from the dock?”', 'more/vote/p'],
      ['ticket', 'alex', 'added a ticket: Flight to GUA', 'tickets/a'],
      ['task', 'alex', 'added a task: Book shuttle', 'more/tasks/k'],
      ['expense', 'alex', 'logged Q680.00 for Dinner', 'money/e'],
      ['item', 'alex', 'added to the plan: Lancha to San Marcos', 'plan/i'],
      ['place', 'alex', 'added a place: Café Sabor', 'more/places/pl'],
      ['vote', 'alex', 'started a vote: Where do we stay?', 'more/vote/p'],
      ['joined', 'sam', 'joined the trip', 'overview'],
    ])
  })

  it('leaves out the imported idea pool, removed rows and rows the server has not timed yet', () => {
    const feed = buildFeed(rows({
      places: [place('osm', 1, 'osm'), place('imp', 2, 'import'), { ...place('gone', 3, 'manual'), deleted_at: at(4) }],
      tasks: [{ id: 'k', trip_id: 't', title: 'No time yet', completed: false } as TripTask],
    }))
    expect(feed).toEqual([])
  })

  it('reports a decided vote as its own entry, credited to nobody', () => {
    const feed = buildFeed(rows({
      polls: [poll('p', 2, { status: 'closed', winner_option_id: 'o', updated_at: at(30) }), poll('q', 3, { title: 'Volcano day?', status: 'closed', updated_at: at(31) })],
      options: [option('o', 2)],
    }))
    expect(feed.filter((e) => e.kind === 'decided').map((e) => [e.at, e.by, e.text])).toEqual([
      [at(31), null, 'Voting ended: Volcano day?'],
      [at(30), null, 'Decided: Casa del Mundo (Where do we stay?)'],
    ])
  })

  it('mentions an option only when it was added later or by someone else', () => {
    const feed = buildFeed(rows({ polls: [poll('p', 2)], options: [option('first', 3), option('later', 40), option('sams', 4, 'sam', { label: 'La Iguana' })] }))
    expect(feed.filter((e) => e.kind === 'option').map((e) => e.id)).toEqual(['option:later', 'option:sams'])
    expect(feed.find((e) => e.id === 'option:sams')?.text).toBe('added “La Iguana” to the vote: Where do we stay?')
  })

  it('skips a comment whose subject is not on this phone, and trims long ones', () => {
    const feed = buildFeed(rows({ polls: [poll('p', 2)], comments: [comment('lost', 5, { subject_type: 'item', subject_id: 'nope' }), comment('long', 6, { body: 'x'.repeat(200) })] }))
    const comments = feed.filter((e) => e.kind === 'comment')
    expect(comments).toHaveLength(1)
    expect(comments[0]!.text.endsWith('…”')).toBe(true)
    expect(comments[0]!.text.length).toBeLessThan(120)
  })

  it('keeps only the newest entries when there are many', () => {
    const feed = buildFeed(rows({ tasks: Array.from({ length: 30 }, (_, i) => ({ ...base(`k${i}`, i), title: `Task ${i}`, completed: false }) as TripTask) }), 5)
    expect(feed.map((e) => e.id)).toEqual(['task:k29', 'task:k28', 'task:k27', 'task:k26', 'task:k25'])
  })
})

describe('what happened to something after it was added', () => {
  const later = (id: string, made: number, changed: number, by = 'sam') => ({ ...base(id, made), updated_at: at(changed), updated_by: by })

  it('credits a finished task to whoever ticked it, when they did', () => {
    const feed = buildFeed(rows({ tasks: [
      { ...later('done', 1, 20), title: 'Book shuttle', completed: true } as TripTask,
      { ...later('open', 2, 25), title: 'Buy sunscreen', completed: false } as TripTask,
    ] }))
    expect(feed.map((e) => [e.kind, e.by, e.at, e.text])).toEqual([
      ['task-done', 'sam', at(20), 'completed a task: Book shuttle'],
      ['task', 'alex', at(2), 'added a task: Buy sunscreen'],
      ['task', 'alex', at(1), 'added a task: Book shuttle'],
    ])
  })

  it('says who paid whom', () => {
    const feed = buildFeed(rows({
      members: [member('sam', 1)],
      settlements: [{ ...base('s', 9, 'sam'), from_member_id: 'alex', to_member_id: 'sam', amount_minor: 2500, currency: 'USD' } as SettlementRow],
    }))
    expect(feed[0]).toMatchObject({ kind: 'settled', by: 'alex', text: 'paid sam $25.00', to: 'money' })
  })

  it('reports a rating by the person who gave it, and not one that was withdrawn or has no place here', () => {
    const rating = (id: string, over: Partial<PlaceRating>) => ({ ...later(id, 3, 15, 'alex'), place_id: 'pl', member_id: 'sam', stars: 4, note: null, ...over }) as PlaceRating
    const feed = buildFeed(rows({ places: [place('pl', 1, 'osm')], ratings: [rating('r', {}), rating('none', { stars: null }), rating('lost', { place_id: 'nope' })] }))
    expect(feed.map((e) => [e.kind, e.by, e.at, e.text, e.to])).toEqual([['rated', 'sam', at(15), 'rated Café Sabor: 4 ★', 'more/places/pl']])
  })

  it('reports a plan item confirmed or cancelled later, not one saved that way', () => {
    const item = (id: string, changed: number, status: ItineraryItem['status']) => ({ ...later(id, 1, changed), title: 'Volcano hike', status }) as ItineraryItem
    const feed = buildFeed(rows({ items: [item('now', 2, 'confirmed'), item('yes', 30, 'confirmed'), item('no', 31, 'cancelled'), item('maybe', 32, 'tentative')] }))
    expect(feed.filter((e) => e.kind === 'item-status').map((e) => [e.id, e.by, e.text])).toEqual([
      ['item-status:no', 'sam', 'cancelled: Volcano hike'],
      ['item-status:yes', 'sam', 'confirmed: Volcano hike'],
    ])
  })

  it('files every kind under a filter, except someone joining', () => {
    const kinds: ActivityKind[] = ['joined', 'vote', 'option', 'decided', 'place', 'rated', 'item', 'item-status', 'expense', 'settled', 'task', 'task-done', 'ticket', 'comment']
    expect(kinds.filter((k) => groupOf(k) === null)).toEqual(['joined'])
    expect(new Set(kinds.map(groupOf).filter(Boolean))).toEqual(new Set(GROUPS))
  })
})

describe('what counts as new', () => {
  const feed = buildFeed(rows({ polls: [poll('p', 2, { status: 'closed', updated_at: at(30) })], comments: [comment('c', 20), comment('mine', 25, { member_id: 'alex' })] }))
  it('is anything after the last look that someone else did', () => {
    expect(unseenCount(feed, at(10), 'alex')).toBe(2) // Sam's comment and the result; not my own comment, not the vote I started
    expect(unseenCount(feed, at(22), 'alex')).toBe(1)
    expect(unseenCount(feed, at(40), 'alex')).toBe(0)
  })
  it('is nothing before the first look has a starting point', () => {
    expect(unseenCount(feed, null, 'alex')).toBe(0)
    expect(isNew(feed[0]!, null, null)).toBe(false)
  })
})
