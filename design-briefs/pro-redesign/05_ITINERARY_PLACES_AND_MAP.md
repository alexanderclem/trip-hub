PHASE 05 — Make itinerary building, editing, places and map feel seamless
Read master + Phase 01 target + progress. Implement the primary product workflow. Keep all actual data, time-zone, routing, participation and booking semantics. This is not an assignment to invent a drag-and-drop calendar with fragile time behavior.
Product problem to solve
A group saves potential places, decides what matters, and builds a plan. Today those capabilities are implemented, but the user should experience them as one connected workflow, not bouncing around unrelated pages. A traveler should easily see where an activity happens, when it happens, whether it is confirmed, who attends, which ticket belongs to it, and how to change it safely.
Inspect
src/features/itinerary/{PlanScreen,Agenda,ItemFormScreen,ItemDetailScreen,TravelWarnings,ScheduleFixDialog,RescheduleDialog,layout,calendar,travel}.tsx/ts; src/features/places/; src/features/map/{MapScreen,PlaceSheet}.tsx; src/features/trips/SharedPlaces.tsx; src/features/destinations/; src/features/polls/DecisionHandoff.tsx; relevant time/route tests and data types. Read src/lib/time.ts contract and the March 2027 DST edge case in CLAUDE.md.
Implement the itinerary composition
A. The daily plan view
- Make the selected date extremely easy to locate/change without overwhelming the phone. Existing keyboard-operable day tablist, weather labels, focus semantics, and moving underline are worth keeping. Verify it remains usable for 2-, 7-, 14- and 21-day trips.
- Agenda/list is primary for ordinary planning and in-trip scanning. Each row's hierarchy: human-readable time → action/activity name → useful location → status/exception; add ticket/confirmation access where relevant. Don't repeat the place if it is already in the title. Time-zone text must be clear when crossed; support all-day activities and activities spanning days.
- Timeline remains an optional useful secondary view for detecting overlaps and visualizing time gaps. Do not make it the only way to edit. Both views must represent identical underlying items and respect schedule semantics.
- Visually distinguish confirmed booking, tentative plan, and a mere idea using words, not color alone. Separate "group pick" from "booked". A date marker should not imply a conflict-free day if there is an actual overlap.
- Conflict and travel-time warnings must be contextual and actionable. Preserve ScheduleFixDialog and schedule constraints. If a route estimate is uncertain or absent, don't present a confident precise departure recommendation.
B. Add/edit actions
- One clear contextual Add to this day action, with the selected date and sensible time prefilled. Full ItemFormScreen supports type, time/dates, destination, attendees, notes, ticket linkage, recurrence if existing, and advanced fields. Lead with common inputs; put optional rare inputs under one explicit disclosure.
- Immediate local confirmation after saved item; preserve pending-sync status separately. New row appears at the correct time, with restrained continuity only if user isn't in reduced-motion mode.
- Rescheduling must not silently change booking status or assume an arbitrary drag gesture changes time. If drag-and-drop is considered, require an explicit confirmation that displays new times and affected overlaps, along with a full keyboard/non-drag equivalent. If value is uncertain, keep simple edit/reschedule controls instead.
- Editing should preserve existing foreign keys, ticket relationships and per-member attendance. No lost input when choosing a place from search or switching an optional field.
C. Places ↔ map ↔ plan
- Treat saved places as a source of potential plan entries. Users should clearly see whether a place is shortlisted, planned, booked, or visited, but avoid duplicating the same status in three places. Existing catalog/rejected statuses must remain semantically correct.
- Make the relationship between place list and map obvious on phone and desktop. A selected place should retain context when switching views; the map must not swallow navigation or obscure crucial controls beneath overlays.
- A place detail should expose useful decision context: place name, category, available factual location, group rating/preferences if supported, and clear action(s): Save place, Add to plan, or Start a vote depending on permissions and state. Don't create third-party reviews or fake open hours. Preserve map deep links and offline-map data.
- Map markers and selected-place sheets must have accessible alternatives (list/search/keyboard). Do not make navigation rely on pinch/drag alone. Respect zero, one, and many places and locations where map tiles are unavailable.
D. Group decisions into the plan
- A winning vote can provide a direct Add winner to plan or Review in plan action, with date/time choices appropriate to the poll. This is a manual, explicit action. Never make the animated vote demo's apparent automatic insertion a real booking or side effect. When an item is already present, show its actual current location/date and prevent duplicates.
Professional interaction polish
- Record opening feels continuous: selected list row → detail, without scroll jumping, repeated title blocks or confusing back behavior.
- One coherent title/metadata/action structure across itinerary, place and ticket details; retain keyboard focus, accessible link semantics and skeleton/error states.
- Don't overload dense rows with five icons. Use relevant symbols only; let text carry important meaning.
- Consider a compact context panel on wide screens; don't force a desktop modal for every detail if a side panel would make sense, but do not break direct detail URLs.
Required tests and edge cases
- 0/1/40 plan items, multiple day spans, 14-day plan, long activity/location names and different attendee subsets.
- Overlaps, DST crossing, timezone differences, all-day, sequential travel, missing place coordinates, unknown route duration.
- Add/edit/reschedule/delete/undo with local saves, delayed remote sync and rejected write; preserve another user's concurrent changes according to existing rules.
- Place selection/list/map sync, selected pin deep link, offline map unavailable, cached map, phone map-sheet dismissal.
- Winner handoff, never falsely booked, no duplicates, permission-limited traveler.
- Narrow/desktop, browser back, route focus, 200% zoom, reduced motion, keyboard tablist, map non-pointer path.
Exit bar
A novice can: (1) find the day's plan, (2) add one thing, (3) see it on the map, (4) attach/open its existing ticket, and (5) understand whether it's actually booked, without coaching. This is a testable aspiration—document actual walkthrough results, not invented success. Ship all changed workflows with real local state and regression tests. Write screenshot paths, issues and remaining gaps to PROGRESS.md.
