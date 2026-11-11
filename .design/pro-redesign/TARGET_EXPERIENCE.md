# Target experience and architecture

Decision date: November 10, 2026. Governs Phases 02–09 after the Phase 01 baseline.

## One shared living plan

Stowaway helps friends turn ideas into an agreed trip, prepare their phones, travel together and settle shared costs afterward. The organizer should be able to create a useful trip with a name and their own name, then share it. A participant sees the actual trip, chooses their name and reaches the plan or shared vote. No account, quiz or installation stands between an invite and participation.

A **group decision** records preferences and an explicit choice; it does not book or schedule automatically. A **personal task** has an owner and, optionally, a due date. A **plan item** is scheduled in the trip's local time and may still be tentative. A **confirmation** is evidence a person adds, or an explicit “No booking needed” decision. An **expense** records shares and balances; a settlement record reports a payment made elsewhere. **On this phone** means the file or map was actually downloaded here. A local edit and an accepted shared edit have separate statuses.

Planning emphasizes the next unresolved decision or personal obligation. Preparing emphasizes missing essentials on this phone. Traveling emphasizes the next relevant stop, time, map, ticket and quick expense entry. Completed trips emphasize remaining balances and the recap. The destinations stay in place as the trip progresses.

## Navigation decision: retain Home / Plan / Map / Vote / More

| Task | Existing model | Candidate Home / Plan / Explore / Money / More | Decision |
| --- | --- | --- | --- |
| Find an open poll | Vote → poll: two taps from Home, including when an overdue task owns Home's priority. A contextual priority can make it one. | A contextual Home link can preserve two taps, but a fallback under More typically needs three to reach a poll. | Keep the literal Vote tab for group planning. |
| See map during travel | Map: one tap; event shortcuts preserve selected place. | Explore → map: requires a new combined surface and an extra choice unless map is default. | Keep direct Map; improve list/map links inside the existing routes. |
| Add/check expense | Home essential → Money, or More → Shared expenses. QuickAdd can open an expense. | Money: one tab from any screen. | Candidate is faster for frequent expense work, but no participant evidence establishes this outweighs voting/maps. Keep contextual travel access. |
| Saved places | Home essential or More → Places; list/map remain connected by place IDs. | Explore could unify them, but overlaps the existing destination-exploration route. | Refine literal Saved places/Map actions rather than introduce an ambiguous umbrella. |
| Tickets | Home essential, relevant event, or More → Tickets. | Still needs contextual/global access. | Preserve both stable list and event access. |

This is an evidence-informed preservation decision, not a user-tested superiority claim. No route migrations or redirects are required. Desktop retains grouped existing destinations; reduce redundant heading/action chrome before changing the rail.

## URL and entry map

Every row retains its current URL, browser-history behavior and record identifiers. `:tripId` is abbreviated as `:t` below.

| Existing URL | Visible entry / selected phone tab | Deep-link and back behavior |
| --- | --- | --- |
| `/`, `/how-it-works`, `/pricing`, `/organizers`, `/help`, `/privacy`, `/terms` | Public website | Keep prerendered HTML and metadata. `/operators` keeps its existing redirect. Other public comparison/tool pages stay untouched. |
| `/app` | Your trips / first-time entry | Returning device sees saved trips; installed shortcuts retain the existing `/` → `/app` behavior. |
| `/new` | Create a trip | Preserve optional details and back to `/app`; successful creation opens actual trip. |
| `/join`, `/join/p/:previewKey` | Join from shared invite | Secret remains in fragment and is removed from history after parsing. Keep validation/retry and vote-target allowlist. |
| `/t/:t/who` | Choose your name | Preserve target through identity selection; do not insert quiz. |
| `/t/:t`, `/t/:t/overview` | Home / Home | Existing index redirect; personal priority and compact essentials. |
| `/t/:t/plan`, `/plan/new`, `/plan/:itemId`, `/plan/:itemId/edit` | Plan / Plan | Preserve `?day=`, place/ticket/copy/decision query contracts; record Back restores its day. |
| `/t/:t/map` | Map / Map | Preserve selected `?place=` and `?day=`. Map/list fallback remains available without a map download. |
| `/t/:t/more/vote`, `/more/vote/:pollId` | Vote / Vote | Invite `?to=vote/:pollId` lands here after joining. Winner needs a separate schedule action. |
| `/t/:t/money`, `/money/new`, `/money/:expenseId` | Shared expenses / More | Preserve edit IDs, base/local display choices, receipt links and settlement semantics. |
| `/t/:t/tickets`, `/tickets/new`, `/tickets/:attachmentId` | Tickets / More | Event ticket opens directly; unavailable file keeps a recoverable explanation and return path. |
| `/t/:t/more`, `/more/places`, `/more/places/new`, `/more/places/:placeId`, `/more/places/:placeId/edit` | More → Places / More | Saved-place identity survives map, vote and plan handoffs; preserve existing return links. |
| `/t/:t/more/explore`, `/more/ideas`, `/more/ideas/manual`, `/more/planner` | Destination exploration / trip ideas / More | These are existing discovery/agent surfaces, not aliases for Map. Preserve approved agent behavior and integrations. |
| `/t/:t/more/dates`, `/more/arrivals`, `/more/tasks`, `/more/tasks/new`, `/more/tasks/:taskId`, `/more/packing`, `/more/packing/new`, `/more/packing/:itemId` | Preparation destinations / More | Keep task filters, attendee links, dates and local persistence. |
| `/t/:t/more/emergency`, `/more/emergency/edit`, `/more/emergency/numbers`, `/more/emergency/driver`, `/more/emergency/me` | Emergency info / More | Keep accessible direct records and permissions; these are the actual router paths. |
| `/t/:t/more/settings`, `/wrapped` | Settings / recap / More | Offline preparation remains discoverable in Settings, Tickets and phase-aware Home; no new offline URL. |
| `/t/:t/activity`, `/travelers/:memberId` | Home activity / individual traveler / Home | Preserve back context and identity; do not move personal data into public previews. |
| `/t/:t/travelers` (linked but missing in router) | Home group count / intended Home | Repair the already-linked destination in Phase 02, reusing `PeopleCard` and existing member/access hooks. Keep the URL; no public roster or new data model. See UX-08. |
| `/signin`, `/auth/callback`, `/connections`, `/oauth/consent` | Optional account/connections | Preserve optionality; no auth refactor in visual work. |
| Existing `/go/*`, `/b`, `/organize/*`, `/unsubscribe`, `/t/:t/more/payments*`, `/more/import` | Organizer / existing permissions | Preserve routes and early-access boundaries; no checkout, fees, email or production payment changes. |

## Exactly five app composition patterns

| Pattern | Phone hierarchy | Desktop hierarchy | Empty / dense | Header action / FAB |
| --- | --- | --- | --- | --- |
| Action-focused Home | Compact identity and group → one readable priority or up-next → day preview → quiet essentials. | Same reading order with coherent centered working width; use a secondary column only when it carries distinct relevant material. | Empty: invite or save first place. Dense: counts and one priority; overdue remains visible. | Invite; QuickAdd only where no contextual Add replaces it. No Home FAB. |
| Time-based Plan | Title/status → accessible day strip → compact day/view tools → relevant conflict → agenda with time, title, useful location, status and ticket. | Shared day strip and readable agenda; timeline remains an explicit alternative, not mandatory. | Empty: Add to this day. Dense: compact rows, day-local conflict review and optional notes. | One contextual Add; FAB only on populated editable days, clear of record controls. |
| Map and places | Search/filter → map or readable saved-place list → selected place → related plan/vote actions. | Map and selected detail can sit side by side while maintaining one selection. | Empty: save/find a place. Unprepared offline: clear map limitation and local saved list. Dense: filter/group without stacked floating layers. | Existing task-specific search/filter; one Add where permitted. Avoid a second global plus. |
| Records and balances | Literal title → personal balance or document status → primary relevant record → scannable list → disclosed group details. | Aligned rows with tabular amounts/dates; detail follows a record, not a dashboard. | Empty: one specific Add. Dense Money: own settlement/recent expenses before other transfers. Dense Tickets: date groups/search, downloaded state. | One contextual Add, replaced by empty-state action when empty. Existing permission checks remain. |
| Lightweight first-run | Actual trip/product context → essential fields/name choice → literal completion action → optional settings. | Narrow reading/form column with purposeful context; no stretched phone cards. | Missing dates/place: say undecided. Errors: preserve input, explain retry. | Back/close and one primary submit. No FAB or global creation tools on forms. |

At 390×844, Home should keep the useful plan preview in its current early position; correcting invisible text takes precedence over adding content. At 320px and enlarged text, containers grow rather than crop important amounts, dates or status. Existing 16px form controls, native dialogs and reduced-motion behavior remain.

## Visual rules and inventory

Ocean ink is the reading color, cool thermal stock the canvas, white the light surface, coral the dominant action. Barlow carries text; Barlow Condensed is limited to travel metadata; Antonio is for actual decorative route codes with adjacent readable meaning. Page title, section, row, caption and status roles come from `tokens.css`, `themes.css` and shared primitives. Amounts and times use tabular Barlow. Keep 13px minimum readable captions and 44px controls. Foreground/background semantic pairs must change together, especially inverse surfaces.

The public tag keeps its master wordmark, eyelet, tear stubs and rare printed accents. App operational screens keep the current calmer working scale. Do not spread halftones, route codes, drop shadows or stacked cards simply to signal a redesign. Consolidate confirmed conflicting rules instead of adding an override layer.

| Keep | Refine | Remove |
| --- | --- | --- |
| Master Brand lockups; Stowie for welcome/empty/offline moments; familiar stable destinations; native modal behavior; immediate balance; exact travel state. | Priority contrast; caption/control dimensions; missing-file/readiness wording; Money ordering; next unfinished decision step; truthful website demonstration. | Obsolete inverse-text declarations, duplicated optional explanations, unnecessary routine status badges, obsolete CSS after replacement. |
| Current Plan time/title alignment and day strip; compact Home and offline summary. | Current warning grouping and contextual ticket/map access. | Any new duplicate global/contextual Add or recreated pre-November-5 dashboard. |

Reference anatomy: `state-traveling-390.png` is an effective task-first hierarchy; `plan-390.png` shows useful chronology/conflict information; `home-planning-390.png` is the priority contrast counterexample; `money-390.png` is the group-vs-personal hierarchy counterexample. Neither is an external visual template.

## Journeys, failure states and hypotheses

| Person/context | Main path | Failure/recovery | Hypothesis to validate with people |
| --- | --- | --- | --- |
| New organizer | Create → invite → save places → poll → explicit plan item. | Failed create/join preserves names; dates/destination can be added later. | Can create and locate invite without coaching or understanding feature taxonomy. |
| New participant | Invite → actual trip/name → plan or deep-linked vote. | Bad/expired link, removed/pending user and stalled identity each keep accurate recovery. | Understands group context before choosing name; vote within two obvious steps of Home. |
| Returning traveler | Your trips → phase-relevant Home → next event/ticket/map. | Overdue task or missing attachment has a specific next step. | Identifies current priority within about three seconds; a research goal, not measured here. |
| Traveling without signal | Open cached app → next event → downloaded ticket → add expense locally. | Missing ticket/map explicitly says unavailable here; prepare/retry when connected. | Can identify a usable ticket or its absence within two obvious actions. |
| Hosted viewer/traveler | Open allowed plan and documents; participate only within actual role. | Restricted edit/deep link explains permission; role changes refresh access. | Never mistakes an unavailable organizer action for a broken button. |
| Completed trip | Check balances → record an externally completed settlement → recap. | Unsettled balance remains visible; no fictional transfer success. | Can distinguish a suggestion from a recorded payment. |

Moderated tasks, with no coaching: (1) create a trip with undecided dates and invite a friend; (2) join a trip as yourself; (3) save an idea and ask the group to choose; (4) change a vote and explain whether anything has been booked; (5) put the chosen option on tomorrow's plan; (6) find the next ticket with the phone offline and explain its status; (7) add a shared café expense offline and explain whether friends can see it yet; (8) explain what remains to prepare before travel. Record completion, wrong turns, hesitation and participants' own explanations. No task-success rate is claimed from automated tests.
