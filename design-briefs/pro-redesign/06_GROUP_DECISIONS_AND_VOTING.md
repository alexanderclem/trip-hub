PHASE 06 — Make collaborative choices the distinctive Stowaway interaction
Read master, architecture, and current progress before changing source. Focus on the shared-decision loop: place idea → group preference → clear result → conscious plan decision. The voting experience should feel extraordinarily smooth but must preserve math, permissions and synchronization correctness.
Inspect
src/features/polls/{PollScreen,DecisionHandoff,SharePoll,PickStamp,rank,data,deadline}.tsx/ts, src/features/comments/, src/features/ratings/, src/features/trips/GroupDecisions.tsx, relevant itinerary/place interaction, activity feed and src/data/types.ts score semantics. Review current source, before screenshots and prior interaction-polish tests; many animations and retry states are already implemented. Do not replace correct functionality to chase a new visual trend.
Domain truth (nonnegotiable)
- Existing four-point score: 0 No way, 1 Fine, 2 Want, 3 Must-do, plus skip/no vote. Ranking: mean score, then fewer "No way" votes, then more voters. Insufficient votes flagged; closing/deadline logic uses existing code.
- Votes represent preferences. A poll can have a leader or winner without the group having purchased a ticket or actually scheduled the place. Adding to itinerary is an intentional human decision.
- Locally saved vote != server-accepted synced vote. No success animation that implies remote acceptance when the app is merely queued or has an unresolved rejection.
Implement
1. Poll discovery and comprehension
An open decision must be easy to find for a newly joined traveler, especially if a deep link from the group chat points to it. The Home priority can show one relevant pending poll; additional active polls live under a predictable, stable group-decision destination. Do not repeat the same poll full card in Home, More, Explore and Plan. Distinguish needs your vote vs already voted vs closed.
2. Fast, focused voting screen
- The poll question and participation progress establish context. The choices and four-point scoring controls should be visually dominant. Sharing is accessible but should not push the actual vote off the initial phone viewport. On active poll detail, a single compact Share action beats a huge pre-vote share panel.
- Treat option scores as an understandable small choice scale, with a visible selected state, clear labels and large targets. Avoid showing an interactive control that looks like a fake "swipe to rank" if the underlying model is per-option score. Keep accessible radio/button semantics appropriate to implementation.
- Instant local feedback but correct save states. Failed local persistence rolls back and exposes an intelligible retry. Network disconnection is a queued state, not a silent failure. Do not accidentally submit duplicate votes under fast double taps.
- Show what changing a vote means and when the poll closes. Do not reorder choices beneath users as scores update remotely.
3. Results and decision handoff
- Display clear ranking, participation, and any insufficient-vote qualification. Never invent precision, a winner or consensus when not supported. The Votes and Results view switch should retain selected state/focus semantics and not hide active actions.
- Visually reward a genuinely completed poll with restraint: one little stamp/transition is enough; no long animation or confetti that delays navigation.
- For an authorized planner, present the right next action: Add winner to plan or Review planned activity, with date/time selection and duplicate prevention. For a viewer/participant without planning access, show accurate read-only outcomes.
- Poll comments should remain in context, keyboard-reachable, and visually secondary to the primary voting action.
4. Sharing
- Invite or poll deep link should land on the right poll even if a user needs to join first; use existing target preservation.
- Make sharing one straightforward operation with native Share / Copy fallback, honest permissions warning and no fabricated privacy controls. On cancellation don't show an error.
Test matrix
- 1, 2, 8, 20 voters; open/closing/closed poll; tied and decisive results; incomplete participation; 0/1/2/3/skip choices; edited vote; multiple active polls.
- Reconnect after offline vote; delayed remote update; 4xx rejection; duplicate user action; deadline while screen open; simultaneously closing from two devices per current data model.
- Deep link as existing user and as invitee; hosted viewer vs planner; no poll; long question/option names.
- Browser history, keyboard/screen-reader control names, focus, phone 320/390, 200% zoom, dark mode, reduced motion.
- Validate scoring results against existing rank tests; do not rewrite math for presentation.
Exit bar
The group-decision experience must be the clearest differentiator in Stowaway. A new invitee should understand what to vote on, cast their preference, see the result, and know whether anything has actually entered the itinerary. No ambiguity about completion, booking, or synchronization. Record screenshots, automated results and any unfinished behavior in PROGRESS.md.
