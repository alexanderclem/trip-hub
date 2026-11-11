PHASE 04 — Rebuild the trip home around what matters now
Read the master and .design/pro-redesign/ architecture/progress. This is the most important experience redesign. Implement actual components and styling. Do not resurrect the verbose overview that was already simplified on November 5.
Goal
A traveler should open their trip and answer in moments: (1) What trip am I in? (2) What needs my attention? (3) What's happening next? (4) Where can I go for everything else? The Home screen is not a sitemap or a list of every feature. It is a prioritization engine with an attractive, credible view into a real trip.
Read/trace
src/features/trips/TripOverviewScreen.tsx, TripDayPreview.tsx, JoinerWelcome.tsx, HomeScreen.tsx; src/features/itinerary/UpNextCard.tsx; src/features/trips/presentation.ts and phase.ts; src/features/tasks/, src/features/polls/, src/features/money/, src/features/offline/, src/features/activity/, src/features/tickets/ and supporting hooks. Inspect current phase logic. Avoid duplicated data fetching when adding a priority model.
Design the four lifecycle states
Planning (trip still being decided)
- A compact trip identity: readable trip name, useful destination/dates, small group avatar/count and Invite action; if the creator just made the trip, invitation is genuinely prominent. Artwork may add character on first visit or desktop, but must not bury the next task on a returning phone user.
- One top priority for this person, selected deterministically from real data: overdue assigned task, active poll requiring their vote, group needs initial invite, missing plan, their unsettled balance only if clearly relevant, etc. Use a priority order grounded in user impact; the existing focus logic is a good starting point but should be tested. Never fabricate urgency or silently skip a safety-critical issue.
- A concise upcoming itinerary/day preview: up to 2–3 genuinely relevant entries, with time and clear tentative/confirmed distinctions. Full plan is one obvious tap away.
- One quiet essentials group for saved places, tasks, tickets, expenses, with counts/urgent states where useful. Do not repeat the same poll or expense amount in several panels.
Preparing (trip approaching)
- Prioritize readiness, especially tickets not on this device, itinerary details needing confirmation and offline preparation. The same device may be ready while another is not; words must make device-local state explicit.
- Keep important tasks and schedule conflicts visible without a huge checklist of every possible preparation feature.
- Give a simple route to detailed offline setup, including what actually downloaded and what remains missing.
Traveling (on the trip)
- The next real event becomes dominant. Show activity name, time, place, relevant ticket status, and the existing travel estimate/leave-by guidance if available. No invented precise ETA or directions.
- High-value actions are contextual: Open ticket; View on map; View itinerary; Add expense. Avoid making someone search in More for their boarding pass.
- Do not show planning homework above urgent travel information. Keep room for important warnings such as missed/unavailable ticket, unsynced edit, invalid route estimate or schedule overlap.
- Past events and rarely used planning features can recede, not disappear.
Completed
- Provide a calm summary and clear paths to settle outstanding expenses, open saved documents and see trip recap. Never imply payment was sent if the app only calculated amounts owed.
Concrete UI structure (responsive, data-driven)
Phone first viewport at 390x844 should show: compact trip identity → one purpose-built priority/next action → at least the beginning of today's or upcoming plan, without horizontal overflow. Avoid hardcoding exact vertical pixel heights if accessibility/long content requires growth; the goal is prioritization, not clipping. The tab bar stays visible and should not overlap the action area.

Desktop should use available width to show the hero next event plus a secondary, quieter pane (essentials / members / next actions), not six equal cards in a dashboard grid. Preserve consistent reading order and accessible landmarks. Use real event-specific content to give texture: times, places, travelers, and status, not generic metrics.
Logic and state correctness
- Centralize selection logic in testable pure functions if it has become opaque, e.g. an array of candidate priority objects with documented precedence. Avoid mixing UI rendering and a long nested conditional without tests.
- Explicitly distinguish an item awaiting a vote, a vote with a winner, an item placed on the itinerary, and a confirmed booking. Do not create automatic transitions between these states merely for a satisfying animation.
- Critical errors (sync rejection, missing offline ticket, overdue task, schedule conflict) must remain accessible even when another priority wins the top card.
- No empty blank panels. For a brand-new trip, show invite group or save first place as the next meaningful action. For an empty but upcoming trip with no dates, do not fabricate a day preview.
- Avoid constant layout reshuffling while a user is reading. Remote updates may change counts and status in place; major priority changes should be purposeful and perceivable.
- Respect per-member itinerary participation and time-zone logic. The user's next event may differ from the entire group's next event.
Visual detail
- Strong large-but-not-oversized title; editorial spacing, restrained travel artwork, clear role labels, elegant dividers and low-contrast structure without low-contrast text.
- Use one true hero object: the thing the person needs to do. Other content becomes compact records or text links.
- Display dates and times in local trip zone where appropriate; tabular numerals and a visible context where ambiguity is possible.
- Keep motion sparse: small state transition for new priority or inserted plan item, no repeated hero animation every visit.
- Stowie appears only for rare moments, e.g. empty/new trip, not every trip opening.
Test these fixture states
1. Newly created, 1 traveler, no destination/dates/plan.
2. 8-person planning trip with 2 pending votes, 5 places, tentative plan and 1 overdue personal task.
3. Preparing trip, 3 undownloaded tickets and offline incomplete, plus a high-priority assigned task.
4. Actively traveling, next flight/train/restaurant and ticket, with route data present and route data absent.
5. Traveling with no next event; offline with unsynced local edits; restricted viewer role.
6. Completed trip with and without unsettled expenses.
7. Very long title, many travelers, many dates, no image, custom image, high-text zoom and dark mode.
Must-pass
- One clear, truthful next action, appropriate to each phase; important secondary warnings remain discoverable.
- No excessive duplicate feature summaries. Data on home is a preview, not another full management screen.
- No missing action while a user is offline or has restricted permissions.
- A user can access a ticket from a relevant next event and can open a full itinerary without searching a nested settings menu.
- Header is compact enough for a phone, but long text wraps, all controls stay reachable and no information is clipped.
- Validate representative screen recordings/screenshots at 320/390/768/1440 and test tasks/permissions, not only snapshots.
Keep a before/after contact sheet in .design/pro-redesign/, and write exact verification results and measured viewport positions only if actually measured.
