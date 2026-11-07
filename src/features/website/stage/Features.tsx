import type { ReactNode } from 'react'
import { BedDouble, Check, CloudOff, FileText, Landmark, PlaneLanding, TrainFront, Utensils, Wifi } from 'lucide-react'
import { Count, Roll, Stage, States, type Act } from './kit'
import { avatarPalette } from '@/ui/avatarPalette'
import { travelerInitials } from '@/features/trips/traveler'
import { Perforation } from '../tag/parts'
import './features.css'

// The homepage feature grid (references/bento.md, "hero and strip").
//
//   Tile      Span  Kind        The one thing                         Moves (once, as it scrolls in)
//   Plan      2/3   Hero UI     a day of the plan                     dinner goes from Tentative to Booked
//   Offline   1/3   Component   the app's offline banner, saved list  Online rolls to Offline
//   Money     1/3   Stat        "3 payments" settle the trip           counts down from 7
//   Tickets   1/3   Object      a stack of tickets, top one in words   still
//   Invite    1/3   Collection  "Who are you?" names off the edge      Sam is picked
//
// Neighbors alternate kinds across and down; the hero's vote and plan card are not repeated here.
// Each picture is its own Stage at 1:1 with a compact design for the phone column; copy is page text.

const STEP = 100
const LEAD = 500
type Beat = { on: boolean }
const OFF: Beat = { on: false }
const ON: Beat = { on: true }
const beat = (i: number) => async (a: Act<Beat>) => {
  await a.wait(LEAD + i * STEP)
  a.put({ on: true })
}

function Tile({ area, lead, rest, dark, children }: { area: string; lead: string; rest: string; dark?: boolean; children: ReactNode }) {
  return (
    <article className={`sw-tile sw-tile--${area}`} data-dark={dark || undefined}>
      <h3 className="sw-tile__copy"><strong>{lead}</strong> {rest}</h3>
      <div className="sw-tile__picture" aria-hidden="true">{children}</div>
    </article>
  )
}

/* Plan: the agenda, pinned to the tile's bottom-left and cropped by it */
const DAYS = [['Sat', '13'], ['Sun', '14'], ['Mon', '15'], ['Tue', '16']] as const
function PlanPicture() {
  return (
    <Stage<Beat> width={720} height={330} compact={{ below: 600, width: 326, height: 330 }} initial={OFF} poster={ON} play="once" script={beat(0)} className="sw-feature">
      {(s, _r, layout) => (
        <div className="sw-agenda" data-compact={layout === 'compact' || undefined}>
          <div className="sw-agenda__days">
            {DAYS.map(([d, n], i) => <span key={d} className="sw-agenda__day" data-on={i === 0 || undefined}><span>{d}</span><b>{n}</b></span>)}
          </div>
          <div className="sw-agenda__title">Saturday, 13 March</div>
          {[
            { icon: <PlaneLanding size={18} />, what: 'Land at Charles de Gaulle', sub: 'Booked', time: '11:40' },
            { icon: <BedDouble size={18} />, what: 'Check in at the hotel', sub: 'Confirmation saved', time: '14:00' },
          ].map((r) => (
            <div key={r.what} className="sw-agenda__row">
              <span className="sw-agenda__icon">{r.icon}</span>
              <span className="sw-agenda__what"><span className="sw-agenda__name">{r.what}</span><span className="sw-agenda__sub">{r.sub}</span></span>
              <span className="sw-agenda__time">{r.time}</span>
            </div>
          ))}
          <div className="sw-agenda__row" data-tentative={!s.on || undefined}>
            <span className="sw-agenda__icon is-food"><Utensils size={18} /></span>
            <span className="sw-agenda__what"><span className="sw-agenda__name">Dinner by the Seine</span><span className="sw-agenda__sub"><Roll>{s.on ? 'Booked' : 'Tentative'}</Roll></span></span>
            <span className="sw-agenda__time">19:30</span>
          </div>
          <div className="sw-agenda__row is-filler">
            <span className="sw-agenda__icon"><Landmark size={18} /></span>
            <span className="sw-agenda__what"><span className="sw-agenda__bar" style={{ width: 150 }} /><span className="sw-agenda__bar is-sub" style={{ width: 70 }} /></span>
            <span className="sw-agenda__bar" style={{ width: 40 }} />
          </div>
        </div>
      )}
    </Stage>
  )
}

/* Offline: the app's own banner, and what is saved on this phone */
function OfflinePicture() {
  return (
    <Stage<Beat> width={340} height={316} compact={{ below: 330, width: 326, height: 316 }} initial={OFF} poster={ON} play="once" script={beat(1)} className="sw-feature">
      {(s) => (
        <div className="sw-offline">
          <div className="sw-offline__banner" data-off={s.on || undefined}>
            <States className="sw-offline__icon" value={s.on ? 'off' : 'on'} states={{ on: <Wifi size={20} />, off: <CloudOff size={20} /> }} />
            <span className="sw-offline__text"><b><Roll>{s.on ? 'Offline' : 'Online'}</Roll></b> <Roll>{s.on ? '· Saved trip data still works' : '· Synced just now'}</Roll></span>
          </div>
          <div className="sw-offline__list">
            {['The plan, all 4 days', 'Everyone’s tickets', 'Map of Paris', 'Exchange rates', 'Places you saved'].map((t) => (
              <div key={t} className="sw-offline__row"><span>{t}</span><Check size={18} className="sw-offline__check" /></div>
            ))}
          </div>
        </div>
      )}
    </Stage>
  )
}

/* Money: one number, on the grid's one dark tile */
function MoneyPicture() {
  return (
    <Stage<Beat> width={340} height={170} compact={{ below: 330, width: 326, height: 170 }} initial={OFF} poster={ON} play="once" script={beat(2)} className="sw-feature">
      {(s) => (
        <div className="sw-stat">
          <span className="sw-stat__lead">8 travelers, 41 shared costs</span>
          <span className="sw-stat__number"><Count value={s.on ? 3 : 7} duration={900} /> payments</span>
          <span className="sw-stat__label">settle the whole trip</span>
        </div>
      )}
    </Stage>
  )
}

/* Tickets: paper, gathered. Only the top ticket has words */
function TicketsPicture() {
  return (
    <Stage<Beat> width={340} height={250} compact={{ below: 330, width: 326, height: 250 }} initial={OFF} poster={OFF} className="sw-feature">
      {() => (
        <div className="sw-tickets">
          <div className="sw-ticket is-back" style={{ translate: '-14px 8px', rotate: '-6deg' }} />
          <div className="sw-ticket is-back" style={{ translate: '16px -4px', rotate: '4deg' }} />
          <div className="sw-ticket" style={{ rotate: '-2deg' }}>
            <div className="sw-ticket__head">
              <span className="sw-ticket__icon"><TrainFront size={20} /></span>
              <span className="sw-ticket__what"><span className="sw-ticket__meta">Ticket · 09:00</span><span className="sw-ticket__name">Train to Versailles</span></span>
            </div>
            <div className="sw-ticket__code">QX7R2M</div>
            <div className="sw-ticket__foot"><FileText size={16} /> Saved on this phone</div>
          </div>
        </div>
      )}
    </Stage>
  )
}

/* Invite: the names a friend picks from, running off the tile's right edge */
const PEOPLE = [
  ['Maya', '#0d9488'], ['Jordan', '#2563eb'], ['Sam', '#db2777'], ['Priya', '#ea580c'],
  ['Leo', '#16a34a'], ['Ana', '#0891b2'], ['Theo', '#ca8a04'], ['Rosa', '#4f46e5'],
] as const
function InvitePicture() {
  return (
    <Stage<Beat> width={340} height={257} compact={{ below: 330, width: 326, height: 257 }} initial={OFF} poster={ON} play="once" script={beat(4)} className="sw-feature">
      {(s) => (
        <div className="sw-invite">
          <div className="sw-invite__q">Who are you?</div>
          <div className="sw-invite__names">
            {PEOPLE.map(([name, color]) => {
              const p = avatarPalette(color)
              const picked = s.on && name === 'Sam'
              return (
                <span key={name} className="sw-invite__name" data-on={picked || undefined}>
                  <span className="sw-invite__avatar" style={{ background: p.background, color: p.lightText ? '#fff' : '#000' }}>{travelerInitials(name)}</span>
                  {name}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </Stage>
  )
}

export function Features() {
  return (
    <section className="sw-features" aria-labelledby="features-title">
      <div className="tag-shell">
        <h2 id="features-title" className="sw-features__title">Everything the trip needs, behind one link</h2>
        <div className="sw-bento">
          <Tile area="plan" lead="The day-by-day plan." rest="Times, bookings and confirmations for every day.">
            <PlanPicture />
          </Tile>
          <Tile area="offline" lead="Works with no signal." rest="Save the trip before you go, and the plan and tickets keep working.">
            <OfflinePicture />
          </Tile>
          <Tile area="money" lead="Split costs as you go." rest="Log who paid, and Stowaway finds the fewest payments to settle up." dark>
            <MoneyPicture />
          </Tile>
          <Tile area="tickets" lead="Tickets on every phone." rest="Add a ticket once and the whole group has it.">
            <TicketsPicture />
          </Tile>
          <Tile area="invite" lead="One link, no app." rest="Friends open it in the browser and pick their name.">
            <InvitePicture />
          </Tile>
        </div>
      </div>
      <Perforation />
    </section>
  )
}
