import { describe, expect, it } from 'vitest'
import { compose, formatMoney, plan, type QueuedEvent } from './dispatch'

const ev = (kind: QueuedEvent['kind'], data: Record<string, unknown>, subs = 1): QueuedEvent => ({
  id: 1, trip_id: 'trip', trip_name: 'Guatemala SB 27', kind, data,
  subscriptions: Array.from({ length: subs }, (_, i) => ({ endpoint: `https://push.example/${i}`, p256dh: 'p', auth: 'a' })),
})

describe('compose', () => {
  it('says who logged an expense and your share, in narrow currency symbols', () => {
    expect(compose(ev('expense', { expense_id: 'e1', description: 'Dinner', by: 'Sam', currency: 'GTQ', amount_minor: 68000, share_minor: 8500 }))).toEqual({
      title: 'Sam logged Dinner', body: 'Your share: Q85.00 of Q680.00', url: '/t/trip/money/e1', tag: 'expense:e1',
    })
    expect(formatMoney(1250, 'USD')).toBe('$12.50')
    expect(formatMoney(1500, 'JPY')).toBe('¥1,500')
  })

  it('uses the phone’s leave-by time when there is one, else the start time', () => {
    expect(compose(ev('leave', { item_id: 'i1', title: 'Lancha to San Marcos', start: '10:00', leave: '09:20', note: 'Lancha from Panajachel dock' }))).toEqual({
      title: 'Leave by 09:20 for Lancha to San Marcos', body: 'Lancha from Panajachel dock · Starts 10:00', url: '/t/trip/plan/i1', tag: 'leave:i1',
    })
    expect(compose(ev('leave', { item_id: 'i1', title: 'Cooking class', start: '18:00', leave: null })).title).toBe('Cooking class starts at 18:00')
  })

  it('links votes and tasks to their screens, sharing a tag so a nudge replaces the first notice', () => {
    const vote = compose(ev('vote', { poll_id: 'p1', title: 'Volcano day?', by: 'Kim' }))
    expect(vote).toMatchObject({ title: 'New vote in Guatemala SB 27', body: 'Kim asks: Volcano day?. Tap to vote.', url: '/t/trip/more/vote/p1' })
    expect(compose(ev('vote_nudge', { poll_id: 'p1', title: 'Volcano day?' })).tag).toBe(vote.tag)
    expect(compose(ev('task', { task_id: 't1', title: 'Book shuttle', by: 'Alex', due_date: '2027-03-12' })).body).toBe('Book shuttle · due 2027-03-12')
    expect(compose(ev('task_due', { task_id: 't1', title: 'Book shuttle' })).url).toBe('/t/trip/more/tasks/t1')
  })
})

describe('votes with deadlines and comments', () => {
  it('nudges before a deadline and announces the result on the same tag as the vote', () => {
    expect(compose(ev('vote_closing', { poll_id: 'p1', title: 'Volcano day?' }))).toEqual({
      title: 'Voting closes soon', body: 'Volcano day? in Guatemala SB 27 still needs your vote.', url: '/t/trip/more/vote/p1', tag: 'vote:p1',
    })
    expect(compose(ev('vote_closed', { poll_id: 'p1', title: 'Volcano day?', winner: 'Acatenango' }))).toEqual({
      title: 'Decided: Acatenango', body: 'Volcano day? · Guatemala SB 27', url: '/t/trip/more/vote/p1', tag: 'vote:p1',
    })
    expect(compose(ev('vote_closed', { poll_id: 'p1', title: 'Volcano day?', winner: null })).title).toBe('Voting has ended')
  })

  it('opens a comment at the thing it is about', () => {
    const on = (subject_type: string) => compose(ev('comment', { comment_id: 'c1', subject_type, subject_id: 's1', subject: 'Casa del Mundo', by: 'Sam', body: 'Too far from the dock?' }))
    expect(on('poll')).toEqual({ title: 'Sam on Casa del Mundo', body: 'Too far from the dock?', url: '/t/trip/more/vote/s1', tag: 'comment:s1' })
    expect(on('place').url).toBe('/t/trip/more/places/s1')
    expect(on('item').url).toBe('/t/trip/plan/s1')
    expect(compose(ev('comment', { subject_type: 'item', subject_id: 's1', body: 'ok' })).title).toBe('Someone on Guatemala SB 27')
  })
})

describe('plan', () => {
  it('sends each event to every enabled phone of that person, and nothing when there are none', () => {
    expect(plan([ev('task_due', { task_id: 't', title: 'x' }, 2), ev('task_due', { task_id: 'u', title: 'y' }, 0)]).map((s) => s.sub.endpoint))
      .toEqual(['https://push.example/0', 'https://push.example/1'])
  })
})
