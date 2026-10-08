# Stowie

Stowie is the Stowaway mark brought to life: the suitcase with two eyes peeking out of its slot.
It replaces the Trip ideas form and the opening quiz with a conversation, and later becomes a
companion on every trip tab. Decisions below were made with the owner on 8 Oct 2026.

| Decision | Choice |
|---|---|
| Conversation | **Hybrid.** Stowie leads with scripted lines and reply chips; free text is allowed everywhere. The model is called only to interpret free text and to generate or refine a trip. |
| Scope | Replaces the Trip ideas page **and** hosts the opening quiz. The sliders, group radar and draft history stay as an "Edit by hand" view. |
| Placement | A dedicated screen, and a floating companion on every trip tab. |
| Character | The existing mark, rigged as inline SVG with `motion`. Six moods. No new dependency, no new features on the face. |
| Assistant | Answers questions about the trip and proposes a small set of writes, each confirmed with a tap. |
| Thread | Private, one per trip per phone, stored locally. Never synced. |
| Voice | Warm and curious. |
| Quiz | The same 10 questions and scoring, asked by Stowie. |
| ChatGPT | Optional. A connected person's turns run on GPT-6 Luna against their own plan (phase 3). |
| Data the model may see | Plan and places; tasks, packing, votes; group preferences; money. Never tickets, booking codes, invitation links, or emergency and medical cards. |

## Phases

1. **Character, chat, ideas and quiz** on Workers AI. Built.
2. **Companion and assistant.** Floating launcher, context starters, trip Q&A, confirmed actions. Built.
3. **ChatGPT connection** and Luna.

Each phase works without the next.

## Character (`src/features/stowie/Stowie.tsx`)

The mark is redrawn as separate parts so each can move: handle, body with its slot, and a pair of
eyes clipped to the slot. `mood` picks the pose:

| Mood | When | Motion |
|---|---|---|
| `idle` | Nothing happening | Slow breathing, a blink every few seconds, an occasional glance |
| `listening` | The message box has focus | Leans in, eyes drop towards the input |
| `thinking` | Waiting on the model | Sways, eyes dart side to side, handle bobs |
| `talking` | A new line from Stowie | Quick squash and stretch |
| `delighted` | A draft arrived, something was saved | Hops; eyes become two happy arcs |
| `oops` | Something failed | One shake, then a tilted, sheepish look |

With reduced motion every mood is a still pose. Stowie is decorative (`aria-hidden`); everything
it conveys is also in the text, and the message list is a live region.

## Voice

Short lines, one question at a time, specific to what the person said. A suitcase joke is rare.
Stowie drops the character for errors, costs, safety and anything about what data is sent. It
never claims to have booked, checked or looked anything up.

## Phase 1: the planning conversation

Routes: `/inspire` and `/t/:tripId/more/ideas` open Stowie. `…/manual` under each opens the
previous form (`DiscoveryScreen`), reachable from the header and from chips.

### Engine (`script.ts`)

A pure function, `step(thread, event, ctx) → { thread, effect?, mood? }`. It owns every scripted
line, the chips, and what happens next; it never touches the network or the database, so it is
unit-tested directly. `StowieScreen` runs the effects and feeds their results back in as events.

The conversation collects a brief one slot at a time (what they imagine, destination when not in
a trip, days, budget), then generates. A draft appears as a card with **Add it to the plan**,
**Change something** and **Start a new idea**. Applying, refining and undoing reuse
`applyIdea` / `undoIdea` / `refinementPlan` unchanged, so every protection in
`docs/AI_PLANNING.md` still holds.

Without a saved travel style Stowie offers the quiz, a description in the person's own words
(the existing `profile` inference, shown as a radar card to accept), or the sliders.

### When the model is called

| Turn | Call |
|---|---|
| Tapping a chip, typing a number of days or a budget, naming a destination when asked | None |
| Free text at an open point in the conversation | `chat`: classifies it (plan, refine, preferences, other), extracts any destination, days or budget, and writes one in-character line |
| Describing a travel style | `profile` (unchanged) |
| Generating or refining | `ideas` (unchanged) |

If `chat` fails, the engine falls back to the obvious reading of the text, so a planning request
still goes ahead. Offline, Stowie says so and points at saved drafts and the hand editor; the
quiz, saved drafts, applying and undoing all work offline as before.

A typical plan costs one `chat` and one `ideas` call. The limiter allows 6 calls a minute per
person, and the account's 10,000 neurons a day are shared with ticket scanning.

### `chat` on the Worker

Added to `POST /api/travel-ai` beside `profile` and `ideas`, with the same session, origin, size
and rate checks. It uses `AI_MODEL` in JSON mode with a 300-token cap. The request carries the
text, the last six lines of the thread, and whether a profile and a draft exist. It sends no trip
data. The reply is validated against `chatReplySchema` before it reaches the phone.

### Thread storage

`stowie_threads` is a local-only Dexie table, one row per scope (a trip id, or `personal`), like
`ai_drafts`. It holds the messages (capped at 120), the current step, the brief in progress and
the chips. It is not in `SYNCED_TABLES` and has no server table. "New chat" clears it; drafts and
preferences are kept.

### Quiz

`QuizScreen` keeps its route, gate, scoring (`quiz.ts`) and saving (`profile.ts`). Only the
presentation changed: Stowie asks each question, earlier answers scroll up as a transcript, and
the radar is revealed at the end. It still needs no model and no connection once loaded.

### Known gaps in phase 1

- In the chat, drafts are planned for every traveler with a saved profile, balanced for the
  weakest fit. Choosing travelers, the balance mode and focus interests are in the hand editor.
- A trip with no start date cannot take a draft from the chat; Stowie sends the person to the
  hand editor, which has the date field.

## Phase 2: companion and assistant

Built. Stowie now rides along on trip tabs, answers questions from the trip, and offers to add
things.

### Companion (`StowieCompanion.tsx`, `screen.ts`)

A small Stowie sits bottom-left on trip screens, opposite the add button, and opens the trip's
conversation in a sheet (a native modal `<dialog>`: a bottom sheet on a phone, a centred panel on
wider screens). It is the same thread as More → Trip ideas; `StowieChat` is the shared body.

`screenOf(pathname)` decides where it appears. It shows on overview, plan, map, places, tickets,
money, tasks, packing and votes, and on plan-item and place detail pages. It stays away from every
form, the ticket viewer, emergency and medical cards, settings, Wrapped and the chat's own page.
On the map it fades out while the map is being dragged. Following a link from the chat closes
the sheet.

### Suggestions for the screen

The first chips come from the screen underneath, ahead of the usual ones, and are refreshed each
time the conversation is reopened (`arrive`):

| Screen | Chips |
|---|---|
| Overview | What’s next? · What’s left to do? |
| Plan | What’s next? · Fill a free afternoon |
| Map, Places | What haven’t we planned yet? |
| A place | What pairs with this? (sent with the place’s name) |
| Tickets | What’s next? |
| Money | What do I owe? |
| Tasks | What’s left to do? · What’s mine? |
| Packing | What am I missing? |
| Votes | What needs my vote? |

They appear only where anything can be said. A question Stowie has just asked (days, budget, a
confirmation) keeps its own chips.

### Answers

`chat` gained the intent `ask` and a `topics` list (plan, places, tasks, packing, votes, people,
money). The phone then builds a snapshot of just those topics from Dexie (`snapshot.ts`) and
sends it with the question to a second Worker action, `assist`, which checks trip access, answers
only from the snapshot, and is told never to guess.

| Turn | Calls |
|---|---|
| A screen chip | `assist` only: the chip already names its topics |
| A typed question | `chat`, then `assist` |
| “What do I owe?”, or any question that is only about money | None. `moneySummary` adds it up on the phone, exactly, and works offline |

The snapshot is plain text, capped per section. It leaves out, by construction: tickets and their
text, confirmation codes, item notes, invitation links, emergency numbers, medical cards, other
people’s personal packing lists, the idea pool (only picked places are listed), cancelled items
and anything deleted. `snapshot.test.ts` checks this.

### Actions (`proposal.ts`)

`assist` may suggest at most one addition: a shared task, a packing item, a tentative plan item,
or a vote. `toProposal` checks it against the trip first: an assignee must be a member, dates
must be real, a plan item needs a date inside the trip, a vote needs two different options.
Anything that fails is dropped and Stowie just answers.

What survives is shown as a card with **Yes, add it** and **No thanks**. Nothing is written
until the yes. Then `carryOut` calls the same functions the forms use (`saveTask`,
`savePackingItem`, `saveItem`, `createPoll` + `addOption`), so the row queues, syncs and can be
edited like any other. Typing something else instead of answering drops the offer. A failed save
leaves it open to retry.

### Known gaps in phase 2

- Stowie adds; it does not edit, move or delete anything, and does not log expenses.
- Plan items it adds are tentative activities with no place attached.
- “Ideas near here” was dropped: the snapshot has no coordinates. The map chip asks what is
  picked but not yet planned.
- A typed question costs two model calls. Phase 3's free-form mode would make it one.

## Phase 3: ChatGPT connection

OpenAI's Sign in with ChatGPT gained an optional plan-usage grant on 29 Sep 2026: standard OAuth,
a weekly cap per app set by the user, and requests charged to their plan. This is the opposite
direction from `docs/CHATGPT_CONNECTOR.md`, where ChatGPT reads Stowaway.

- **Seam.** The Worker picks a provider per request: Workers AI by default, OpenAI when the
  caller has a valid grant. Schemas and validation are identical for both, so the phone does not
  care which answered.
- **What changes for a connected person.** Every free-text turn goes to Luna, so the
  conversation can be fully free-form, and drafts are better and faster. Nobody else is affected.
- **Tokens.** Held server-side against the Supabase user, never in the browser or a `VITE_`
  variable. Disconnecting is in Settings beside the existing connections.
- **Fallback.** Cap reached, grant revoked or OpenAI down: that turn falls back to Workers AI
  and Stowie says so once.

**Open risk.** Launch coverage of the usage grant is reported as open-source projects, locally
run personal projects and selected private apps, for Plus and Pro subscribers, and sources
disagree on the details. Whether a hosted app like this one qualifies has to be confirmed with
OpenAI before phase 3 starts. It may also need a developer registration, which must stay within
the no-card rule in `CLAUDE.md`.

## Tests

```text
npm run typecheck
npm test                                        # script, proposal, snapshot and worker tests
npx playwright test tests/e2e/discovery.spec.ts # Stowie and the hand editor; mocked network, no live writes
```

`onboarding.spec.ts` covers the quiz inside the opening sequence against live Supabase.
