PHASE 03 — Make first-time creation, invitation and joining effortless
Read 00_MASTER_BRIEF.md, Phase 01 target architecture and Phase 02 progress, then implement. Focus on getting an actual group into a real shared trip, not making a pretty onboarding tour. Preserve existing link/identity/permission architecture.
User promises
- A new organizer can start a useful trip in under a minute without learning currency or time-zone configuration.
- A friend can tap one invite link in a group chat, identify their trip, choose their name or add themselves, and see the itinerary with minimal friction.
- An existing member reopening an invite link lands on the relevant trip/task and does not get duplicate identity prompts.
- Optional account, installation, travel-style quiz and organizer products never block ordinary joining or trip viewing.
Inspect
src/features/onboarding/WelcomeScreen.tsx; src/features/trips/{HomeScreen,CreateTripScreen,JoinByLink,JoinScreen,WhoScreen,JoinerWelcome,InviteTripCard,InviteLinks,JoinerWelcome}.tsx; src/features/install/InstallAppDialog.tsx; src/features/account/; relevant trip/action/permission code; tests for first-run and link joining. Verify actual API semantics and permission modes rather than guessing.
Implement: create a trip
1. First screen has one clear choice: Create a trip or Join trip when both are relevant. A returning user sees their trip(s) first with easy new creation and join access; no generic marketing inside the app.
2. In trip creation, prioritize Trip name and Your name, plus helpful, optional destination and dates. Existing destination search and time-zone/currency inference must still work and remain editable. Progressive disclosure of advanced fields must be discoverable, and draft-based creation must still enforce required dates. No unnecessary stepper for a simple form.
3. Use meaningful defaults, no invented trip data, and clear validation next to the relevant input. Prevent accidental duplicate creation on slow submits; preserve the existing createdTripId recovery logic. Ensure retries do not create duplicate trips.
4. After successful creation, surface the genuinely important next action: Invite your friends, using the existing share/copy affordance, with a clear secondary path to the trip workspace. Never force an invitation before the organizer can inspect the plan.
5. When people later return, avoid replaying introductory UI unless something genuinely changed.
Implement: invite and group identity
1. The invitation should show the actual trip name, dates/destination if known, and a clear invite action. Never expose secret tokens in logging or public metadata.
2. Group-mode explanation must be accurate: Anyone with the link may view and edit the group trip. Hosted-mode explanation must reflect approval and role restrictions. Add a contextual Review sharing access link only if a real settings destination supports the operation. Do not invent granular access settings.
3. Prefer native mobile Share sheet where available with robust Copy link fallback. Preserve the existing no-duplicate-link-on-iOS behavior. On successful copy, a brief status is enough. If share is canceled, do not display an error. If clipboard access fails, the link remains selectable.
4. Join link must preserve target context (including vote deep links). The join screen should provide clear connection/loading/error/retry states, including offline failure. Error copy must tell users what happened and what to do, without technical tokens.
5. In WhoScreen, existing member selection and add-name paths must be equally understandable. Preserve idempotency and the existing 20-second timeout/error recovery. Explicitly distinguish selecting someone already in the list from adding a new traveler. Large groups must remain navigable and readable.
6. First-join screen should not force installation or quiz. It should point to the plan and at most one contextual action. Correct the misleading claim that adding the app to the Home Screen automatically prepares the itinerary, map and tickets for offline use. These are different operations; explain accurate setup after join without drowning the new user in a checklist. No false Ready state.
Proposed user journey — verify and refine
- Open Stowaway → Create a trip → enter two names and optionally destination/dates → Create → Invite dialog or one clear Invite action → Share link → return to Overview.
- Tap shared URL → recognize the trip identity → Who are you? choose existing identity or add name → trip overview or requested deep link → See plan.
- Returning member on same device → reopen share link → requested vote/place/ticket where permitted, without a second joining process.
Acceptance and regression tests
1. Organizer success, duplicate tap, slow save, draft itinerary creation, optional destination empty, unusual timezone, validation errors.
2. 1-person and 12-person invite selection, long names, identity retries, no duplicate member on interrupted attempt, slow network, offline join failure/recovery.
3. Existing invitee on known trip and an invitee on a new device; deep link to a vote; invalid/expired/removed links; hosted pending/viewer permissions.
4. Native share/copy fallback and cancel; selectable invite link; user-visible status and accessible announcements.
5. First-visit compact mobile page and 200% zoom; no forced email/account/installation/quiz, no false offline promises.
6. Keyboard-only navigation, input labels, native focus management, dark mode and accessible error descriptions.
Use existing tests as a base; add automated cases for changed behavior. Capture before/after at 390 and 1440. Log any unsolved hosted-mode edge case explicitly rather than implying correctness. This phase is complete when the join-and-share flow is functional and intuitive, not when a welcome card looks attractive.
